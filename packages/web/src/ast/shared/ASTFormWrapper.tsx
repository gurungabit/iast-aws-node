import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toggle } from '../../components/ui/Toggle'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ItemResultList } from '../../components/ui/ItemResultList'
import { StatusLogList } from '../../components/ui/StatusLogList'
import { Button } from '../../components/ui/Button'
import { DateTimePicker } from '../../components/ui/DateTimePicker'
import { Input } from '../../components/ui/Input'
import { CredentialsInput } from './CredentialsInput'
import { useASTStore } from '../../stores/ast-store'
import { useAST } from '../../hooks/useAST'
import { useFormField } from '../../hooks/useFormField'
import { useAuth } from '../../auth/useAuth'
import { createSchedule } from '../../services/schedules'
import {
  createAstConfig,
  cloneAstConfig,
  deleteAstConfig,
  listAstConfigs,
  runAstConfig,
  updateAstConfig,
  type AstConfigListScope,
} from '../../services/ast-configs'
import type { AstConfigTask, AstConfigVisibility, SavedAstConfigWithAccess } from '../types'
import { extractAlias, getLocalDateString } from '../types'
import { AstConfigSelector } from './AstConfigSelector'
import { OcSelector } from './OcSelector'
import { isOcCode } from './oc'
import { getAST as getASTFromRegistry } from '../registry'
import { TaskListEditor } from './TaskListEditor'

export interface CommonFormParams {
  username: string
  password: string
  testMode: boolean
  parallel: boolean
}

interface ASTFormWrapperProps {
  title: string
  description: string
  children: ReactNode
  showParallel?: boolean
  astName: string
  buildPayload: (common: CommonFormParams) => Record<string, unknown>
  getConfigParams: () => Record<string, unknown>
  applyConfigParams: (params: Record<string, unknown>) => void
  onRun: (payload: Record<string, unknown>) => void
  renderTaskInputs?: (
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) => ReactNode
  getDefaultTaskParams?: () => Record<string, unknown>
}

export function ASTFormWrapper({
  title,
  description,
  children,
  showParallel = false,
  astName,
  buildPayload,
  getConfigParams,
  applyConfigParams,
  onRun,
  renderTaskInputs,
  getDefaultTaskParams,
}: ASTFormWrapperProps): React.ReactNode {
  const activeTabId = useASTStore((state) => state.activeTabId)
  const tabState = useASTStore((state) => (activeTabId ? state.tabs[activeTabId] : null))
  const setCredentials = useASTStore((state) => state.setCredentials)
  const setFormOptions = useASTStore((state) => state.setFormOptions)
  const clearAutoLauncherRun = useASTStore((state) => state.clearAutoLauncherRun)

  const {
    status,
    isRunning,
    lastResult,
    progress,
    itemResults,
    statusMessages,
    controlAST,
    clearLogs,
  } = useAST()

  const [scheduleMode, setScheduleMode] = useFormField<boolean>('schedule.enabled', false)
  const [scheduledTime, setScheduledTime] = useFormField<string>('schedule.time', '')
  const [_timezone, setTimezone] = useFormField<string>('schedule.timezone', 'America/Chicago')
  const [notifyEmail, setNotifyEmail] = useFormField<string>('schedule.email', '')

  const [selectedConfigId, setSelectedConfigId] = useFormField<string>(
    `astConfig.${astName}.selectedId`,
    '',
  )
  const [configurationName, setConfigurationName] = useFormField<string>(
    `astConfig.${astName}.configurationName`,
    '',
  )
  const [oc, setOc] = useFormField<string>(`astConfig.${astName}.oc`, '')
  const [visibility, setVisibility] = useFormField<AstConfigVisibility>(
    `astConfig.${astName}.visibility`,
    'private',
  )

  const supportsMultiTask = Boolean(renderTaskInputs && getDefaultTaskParams)
  const [multiTask, setMultiTask] = useFormField<boolean>(`astConfig.${astName}.multiTask`, false)
  const [tasks, setTasks] = useFormField<AstConfigTask[]>(`astConfig.${astName}.tasks`, [])
  const isMultiTaskActive = supportsMultiTask && multiTask

  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSuccess, setConfigSuccess] = useState<string | null>(null)
  const [configs, setConfigs] = useState<SavedAstConfigWithAccess[]>([])
  const [isDeletingConfig, setIsDeletingConfig] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isRunningMultiTask, setIsRunningMultiTask] = useState(false)

  const credentials = tabState?.credentials ?? { username: '', password: '' }
  const formOptions = tabState?.formOptions ?? { testMode: false, parallel: false }

  const { user } = useAuth()
  useEffect(() => {
    if (activeTabId && !credentials.username && user?.email) {
      const alias = extractAlias(user.email).toUpperCase()
      if (alias) setCredentials(activeTabId, { username: alias })
    }
  }, [activeTabId, credentials.username, user?.email, setCredentials])

  const autoLauncherRun = tabState?.autoLauncherRun ?? null
  const isMultiTaskRun = autoLauncherRun?.source === 'multiTaskConfig'
  const isAutoLauncherRun = autoLauncherRun !== null && !isMultiTaskRun
  const hasAutoLauncherOutput = isAutoLauncherRun
  const autoLauncherIsRunning = autoLauncherRun?.status === 'running'
  const autoLauncherActiveStep = useMemo(() => {
    if (!autoLauncherRun) return null
    const running = autoLauncherRun.steps.find((s) => s.status === 'running')
    if (running) return running
    const idx = Math.max(
      0,
      autoLauncherRun.nextStepIndex > 0 ? autoLauncherRun.nextStepIndex - 1 : 0,
    )
    return autoLauncherRun.steps[idx] ?? null
  }, [autoLauncherRun])

  const isCredentialsValid =
    credentials.username.trim().length > 0 && credentials.password.trim().length > 0
  const isConfigMetaValid = configurationName.trim().length > 0 && isOcCode(oc)
  const hasLogs = statusMessages.length > 0 || itemResults.length > 0
  const showMultiTaskProgress = isMultiTaskRun && autoLauncherRun !== null
  const showLogs = hasLogs && !hasAutoLauncherOutput && !showMultiTaskProgress

  const selectedConfig = useMemo(() => {
    if (!selectedConfigId) return null
    return configs.find((c) => c.configId === selectedConfigId) ?? null
  }, [configs, selectedConfigId])

  const canEditSelected = selectedConfig?.canEdit ?? true
  const isUpdatingExisting = Boolean(selectedConfigId && selectedConfig?.canEdit)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const scope: AstConfigListScope = 'all'
        const items = await listAstConfigs(astName, scope)
        if (!cancelled) setConfigs(items)
      } catch (err) {
        if (!cancelled)
          setConfigError(err instanceof Error ? err.message : 'Failed to load configs')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [astName])

  function handleSetUsername(username: string) {
    if (activeTabId) setCredentials(activeTabId, { username })
  }
  function handleSetPassword(password: string) {
    if (activeTabId) setCredentials(activeTabId, { password })
  }
  function handleSetTestMode(testMode: boolean) {
    if (activeTabId) setFormOptions(activeTabId, { testMode })
  }
  function handleSetParallel(parallel: boolean) {
    if (activeTabId) setFormOptions(activeTabId, { parallel })
  }

  const handleDateTimeChange = useCallback(
    (isoString: string, tz: string) => {
      setScheduledTime(isoString)
      setTimezone(tz)
    },
    [setScheduledTime, setTimezone],
  )

  function getCommonParams(): CommonFormParams {
    return {
      username: credentials.username,
      password: credentials.password,
      testMode: formOptions.testMode,
      parallel: formOptions.parallel,
    }
  }

  function applyConfigSelection(config: SavedAstConfigWithAccess) {
    setSelectedConfigId(config.configId)
    setConfigurationName(config.configurationName)
    setOc(config.oc)
    setVisibility(config.visibility)
    if (activeTabId) {
      setFormOptions(activeTabId, { parallel: config.parallel, testMode: config.testMode })
    }
    setMultiTask(config.multiTask ?? false)
    setTasks(config.tasks ?? [])
    applyConfigParams(config.params)
    setConfigError(null)
    setConfigSuccess(null)
  }

  function clearConfigSelection() {
    setSelectedConfigId('')
    setConfigurationName('')
    setOc('')
    setVisibility('private')
    setMultiTask(false)
    setTasks([])
    if (activeTabId) setFormOptions(activeTabId, { parallel: false, testMode: false })
    applyConfigParams({})
    setConfigError(null)
    setConfigSuccess(null)
  }

  async function refreshConfigs() {
    const items = await listAstConfigs(astName, 'all')
    setConfigs(items)
  }

  async function saveConfig(): Promise<SavedAstConfigWithAccess> {
    setIsSavingConfig(true)
    setConfigError(null)
    setConfigSuccess(null)

    try {
      if (!isConfigMetaValid) throw new Error('Configuration Name and OC are required')

      const paramsToSave = getConfigParams()
      const category = getASTFromRegistry(astName)?.category
      if (!category) throw new Error(`AST "${astName}" is not registered`)

      const multiTaskFields = isMultiTaskActive
        ? { multiTask: true as const, tasks }
        : { multiTask: false as const, tasks: undefined }

      let saved: SavedAstConfigWithAccess
      if (selectedConfigId && selectedConfig) {
        if (selectedConfig.canEdit) {
          saved = await updateAstConfig(astName, selectedConfigId, {
            configurationName,
            oc,
            parallel: formOptions.parallel,
            testMode: formOptions.testMode,
            visibility,
            params: paramsToSave,
            ...multiTaskFields,
          })
        } else {
          const cloned = await cloneAstConfig(astName, selectedConfigId, { configurationName })
          setSelectedConfigId(cloned.configId)
          setVisibility('private')
          saved = await updateAstConfig(astName, cloned.configId, {
            configurationName,
            oc,
            parallel: formOptions.parallel,
            testMode: formOptions.testMode,
            visibility: 'private',
            params: paramsToSave,
            ...multiTaskFields,
          })
        }
      } else {
        saved = await createAstConfig({
          astName,
          category,
          configurationName,
          oc,
          parallel: formOptions.parallel,
          testMode: formOptions.testMode,
          visibility,
          params: paramsToSave,
          ...multiTaskFields,
        })
      }

      setSelectedConfigId(saved.configId)
      setConfigSuccess(`Saved config: ${saved.configurationName}`)
      await refreshConfigs()
      return saved
    } finally {
      setIsSavingConfig(false)
    }
  }

  async function handleSchedule() {
    setIsScheduling(true)
    setScheduleError(null)
    setScheduleSuccess(null)

    try {
      const configIdToUse = selectedConfigId ? selectedConfigId : (await saveConfig()).configId
      const fullPayload = buildPayload(getCommonParams())
      fullPayload.oc = oc
      fullPayload.configId = configIdToUse

      const result = await createSchedule({
        astName,
        scheduledTime,
        credentials: { userId: credentials.username, password: credentials.password },
        params: fullPayload,
      })

      setScheduleSuccess(`Scheduled! ID: ${result.id}`)
      setScheduleMode(false)
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setIsScheduling(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  const primaryActionLabel = isMultiTaskActive
    ? isUpdatingExisting
      ? 'Update and Run All'
      : 'Save and Run All'
    : scheduleMode
      ? isUpdatingExisting
        ? 'Update and Schedule'
        : 'Save and Schedule'
      : isUpdatingExisting
        ? 'Update and Run'
        : 'Save and Run'

  async function handleSaveOnly() {
    try {
      await saveConfig()
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save config')
    }
  }

  async function handleDeleteConfig() {
    if (!selectedConfigId || !selectedConfig?.isOwner) return
    setShowDeleteConfirm(false)
    setIsDeletingConfig(true)
    setConfigError(null)
    setConfigSuccess(null)
    try {
      await deleteAstConfig(astName, selectedConfigId)
      setSelectedConfigId('')
      setConfigurationName('')
      setOc('')
      setVisibility('private')
      setConfigSuccess('Config deleted')
      await refreshConfigs()
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to delete config')
    } finally {
      setIsDeletingConfig(false)
    }
  }

  async function handleDeleteConfigById(configId: string) {
    setConfigError(null)
    setConfigSuccess(null)
    try {
      await deleteAstConfig(astName, configId)
      if (configId === selectedConfigId) {
        setSelectedConfigId('')
        setConfigurationName('')
        setOc('')
        setVisibility('private')
      }
      setConfigSuccess('Config deleted')
      await refreshConfigs()
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to delete config')
    }
  }

  async function handleSaveAndRun() {
    setScheduleError(null)
    setScheduleSuccess(null)
    try {
      if (!isCredentialsValid) throw new Error('Username and password are required to run')
      const payload = buildPayload(getCommonParams())
      payload.oc = oc
      if (selectedConfigId) payload.configId = selectedConfigId
      if (configurationName) payload.configName = configurationName
      onRun(payload)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to run')
    }
  }

  async function handleSaveAndRunAll() {
    setConfigError(null)
    setConfigSuccess(null)
    setIsRunningMultiTask(true)
    try {
      if (!activeTabId) throw new Error('No active session. Open a terminal tab first.')
      if (!isCredentialsValid) throw new Error('Username and password are required to run')
      if (tasks.length === 0) throw new Error('Add at least one task before running')

      const saved = await saveConfig()

      useASTStore.getState().clearLogs(activeTabId)
      useASTStore
        .getState()
        .addStatusMessage(
          activeTabId,
          `Starting multi-task run: ${saved.configurationName} (${String(tasks.length)} tasks)`,
        )

      const result = await runAstConfig(astName, saved.configId, {
        username: credentials.username,
        password: credentials.password,
        sessionId: activeTabId,
        userLocalDate: getLocalDateString(),
      })

      useASTStore.getState().beginAutoLauncherRun(activeTabId, {
        runId: result.runId,
        launcherId: saved.configId,
        steps: result.steps
          ? result.steps.map((s) => ({
              astName: s.astName,
              configId: s.configId,
              order: s.order,
              stepLabel: s.stepLabel,
              taskLabel: s.taskLabel,
              configName: s.configName,
            }))
          : tasks
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((_t, idx) => ({
                astName,
                configId: saved.configId,
                order: idx,
              })),
        source: 'multiTaskConfig',
        displayName: saved.configurationName,
      })

      useASTStore
        .getState()
        .addStatusMessage(
          activeTabId,
          `Multi-task run kicked off (runId=${result.runId}). Terminal will process tasks sequentially.`,
        )

      setConfigSuccess(`Running ${String(result.taskCount)} task(s) sequentially`)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to run')
    } finally {
      setIsRunningMultiTask(false)
    }
  }

  return (
    <Card
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <StatusBadge
              status={
                status as
                  | 'idle'
                  | 'running'
                  | 'paused'
                  | 'completed'
                  | 'success'
                  | 'failed'
                  | 'timeout'
                  | 'cancelled'
              }
            />
            {lastResult?.duration && !isRunning && (
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {lastResult.duration.toFixed(1)}s
              </span>
            )}
          </div>
          {lastResult?.message && !isRunning && (
            <p className="text-xs text-gray-600 dark:text-zinc-400 break-words">
              {lastResult.message}
            </p>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          {/* Config Selection */}
          <div className="pb-4 border-b border-gray-200 dark:border-zinc-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Existing configurations
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <AstConfigSelector
                    value={selectedConfigId || null}
                    configs={configs}
                    placeholder="Select existing config"
                    disabled={isRunning || isScheduling || isSavingConfig || isDeletingConfig}
                    onChange={(id) => {
                      setShowDeleteConfirm(false)
                      if (!id) {
                        clearConfigSelection()
                        return
                      }
                      const found = configs.find((c) => c.configId === id)
                      if (found) applyConfigSelection(found)
                    }}
                    onDelete={(id) => void handleDeleteConfigById(id)}
                  />
                </div>
                {isUpdatingExisting && selectedConfig?.isOwner && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      title="Delete config"
                      disabled={isRunning || isScheduling || isSavingConfig || isDeletingConfig}
                      className="p-2 rounded cursor-pointer text-zinc-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      onClick={() => setShowDeleteConfirm((v) => !v)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {showDeleteConfirm && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-64 p-3 rounded-lg border border-red-200 dark:border-red-800/60 bg-white dark:bg-zinc-800 shadow-lg">
                        <p className="text-xs text-gray-700 dark:text-zinc-300 mb-2">
                          Delete{' '}
                          <strong className="text-gray-900 dark:text-zinc-100">
                            {selectedConfig!.configurationName}
                          </strong>
                          ? This cannot be undone.
                        </p>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            isLoading={isDeletingConfig}
                            onClick={() => void handleDeleteConfig()}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedConfig && !canEditSelected && (
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                  This is a public config. Saving will clone it into a private copy.
                </p>
              )}
            </div>
          </div>

          {/* Credentials */}
          <CredentialsInput
            username={credentials.username}
            password={credentials.password}
            onUsernameChange={handleSetUsername}
            onPasswordChange={handleSetPassword}
            disabled={isRunning || isScheduling}
          />

          {/* Config Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Configuration Name"
                value={configurationName}
                onChange={(e) => setConfigurationName(e.target.value)}
                placeholder="e.g. BI Renew - Michigan"
                disabled={isRunning || isScheduling || isSavingConfig}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  OC<span className="text-red-500 ml-0.5">*</span>
                </label>
                <OcSelector
                  value={oc}
                  onChange={setOc}
                  disabled={isRunning || isScheduling || isSavingConfig}
                  placeholder="Select OC..."
                />
              </div>
            </div>
          </div>

          {/* AST-specific inputs or Task List */}
          {isMultiTaskActive && renderTaskInputs && getDefaultTaskParams ? (
            <TaskListEditor
              tasks={tasks}
              onChange={setTasks}
              renderTaskInputs={renderTaskInputs}
              getDefaultTaskParams={getDefaultTaskParams}
              disabled={isRunning || isScheduling || isSavingConfig || isRunningMultiTask}
            />
          ) : (
            children
          )}

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supportsMultiTask && (
              <Toggle
                label="Multi-Task Mode"
                description="Run the same AST multiple times with different parameters"
                checked={multiTask}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMultiTask(e.target.checked)
                }
                disabled={isRunning || isScheduling || isRunningMultiTask}
              />
            )}
            <Toggle
              label="Public Config"
              description="Public configs can be used by others but not edited"
              checked={visibility === 'public'}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setVisibility(e.target.checked ? 'public' : 'private')
              }
              disabled={isRunning || isScheduling || isSavingConfig}
            />
            <Toggle
              label="Schedule for Later"
              description="Run this automation at a specific time"
              checked={scheduleMode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setScheduleMode(e.target.checked)
              }
              disabled={isRunning || isScheduling || isMultiTaskActive}
            />
            <Toggle
              label="Test Mode"
              description="Run without making actual changes"
              checked={formOptions.testMode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleSetTestMode(e.target.checked)
              }
              disabled={isRunning || isScheduling}
            />
            {showParallel && (
              <Toggle
                label="Parallel Processing"
                description="Process items concurrently (faster but uses more resources)"
                checked={formOptions.parallel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleSetParallel(e.target.checked)
                }
                disabled={isRunning || isScheduling}
              />
            )}
          </div>

          {scheduleMode && (
            <div className="pl-4 border-l-2 border-blue-500 space-y-3">
              <DateTimePicker value={scheduledTime || null} onChange={handleDateTimeChange} />
              <Input
                label="Notify Email (optional)"
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={isRunning || isScheduling}
              />
            </div>
          )}

          {/* Progress Bar + Controls */}
          {isRunning && progress && (
            <div className="space-y-2">
              <ProgressBar
                value={progress.percentage}
                label={`Processing ${String(progress.current)} of ${String(progress.total)}`}
                currentItem={progress.currentItem}
                message={progress.message}
                variant={progress.itemStatus === 'failed' ? 'error' : 'default'}
              />
              <div className="flex items-center gap-2">
                {status === 'paused' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => controlAST('resume')}
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Resume
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => controlAST('pause')}
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                    </svg>
                    Pause
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger-outline"
                  size="sm"
                  onClick={() => controlAST('cancel')}
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  Cancel
                </Button>
                {status === 'paused' && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    Paused
                  </span>
                )}
              </div>
            </div>
          )}

          {scheduleSuccess && (
            <div className="p-2 text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400">
              {scheduleSuccess}
            </div>
          )}
          {scheduleError && (
            <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
              {scheduleError}
            </div>
          )}
          {lastResult?.error && (
            <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
              {lastResult.error}
            </div>
          )}

          {hasAutoLauncherOutput ? (
            <div className="p-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-300">
              <div className="font-medium">AutoLauncher output is active for this session.</div>
              <div className="mt-1 text-blue-700 dark:text-blue-300">
                runId={autoLauncherRun?.runId}
                {autoLauncherActiveStep ? ` step=${autoLauncherActiveStep.astName}` : ''}
                {autoLauncherIsRunning ? ' (running)' : ''}
              </div>
              <div className="mt-1 text-blue-700 dark:text-blue-300">
                Use the AutoLauncher tab to view progress. You can run an AST manually after the
                AutoLauncher finishes, or open a new terminal tab/session to run concurrently.
              </div>
              {!autoLauncherIsRunning && activeTabId ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      clearLogs()
                      clearAutoLauncherRun(activeTabId)
                    }}
                  >
                    Clear AutoLauncher Output
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                isLoading={isSavingConfig}
                disabled={!isConfigMetaValid || isRunning || isScheduling || isRunningMultiTask}
                onClick={() => void handleSaveOnly()}
              >
                {isUpdatingExisting ? 'Update config' : 'Save as config'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="flex-1"
                isLoading={isRunning || isScheduling || isSavingConfig || isRunningMultiTask}
                disabled={
                  !isConfigMetaValid ||
                  !isCredentialsValid ||
                  isRunning ||
                  isScheduling ||
                  isRunningMultiTask
                }
                onClick={() => {
                  if (isMultiTaskActive) void handleSaveAndRunAll()
                  else if (scheduleMode) void handleSchedule()
                  else void handleSaveAndRun()
                }}
              >
                {isRunningMultiTask
                  ? 'Submitting...'
                  : isScheduling
                    ? 'Scheduling...'
                    : isRunning
                      ? 'Processing...'
                      : primaryActionLabel}
              </Button>
            </div>
            {configSuccess && (
              <div className="p-2 text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400">
                {configSuccess}
              </div>
            )}
            {configError && (
              <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
                {configError}
              </div>
            )}
          </div>

          {/* Multi-Task Run Progress */}
          {showMultiTaskProgress && autoLauncherRun && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {autoLauncherRun.displayName ?? 'Multi-Task Run'}
                  </div>
                  <div className="flex items-center gap-2">
                    {!autoLauncherIsRunning && activeTabId && (
                      <Button
                        type="button"
                        variant="danger-outline"
                        size="sm"
                        onClick={() => {
                          clearLogs()
                          clearAutoLauncherRun(activeTabId)
                        }}
                      >
                        Clear Results
                      </Button>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        autoLauncherRun.status === 'running'
                          ? 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40'
                          : autoLauncherRun.status === 'completed'
                            ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40'
                            : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
                      }`}
                    >
                      {autoLauncherRun.status === 'completed'
                        ? 'All tasks complete'
                        : autoLauncherRun.status === 'failed'
                          ? 'Failed'
                          : `Running task ${String(autoLauncherRun.steps.filter((s) => s.status === 'success' || s.status === 'failed').length + 1)} of ${String(autoLauncherRun.steps.length)}`}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  {autoLauncherRun.steps.map((step, idx) => (
                    <div
                      key={`${String(step.order)}-${String(idx)}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                        step.status === 'running'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : step.status === 'success'
                            ? 'bg-green-50 dark:bg-green-900/10'
                            : step.status === 'failed'
                              ? 'bg-red-50 dark:bg-red-900/10'
                              : 'bg-transparent'
                      }`}
                    >
                      <span className="shrink-0 w-4 text-center">
                        {step.status === 'running' ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        ) : step.status === 'success' ? (
                          <span className="text-green-600 dark:text-green-400">&#10003;</span>
                        ) : step.status === 'failed' ? (
                          <span className="text-red-600 dark:text-red-400">&#10007;</span>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-600" />
                        )}
                      </span>
                      <span
                        className={`font-medium ${
                          step.status === 'running'
                            ? 'text-blue-800 dark:text-blue-200'
                            : step.status === 'success'
                              ? 'text-green-800 dark:text-green-300'
                              : step.status === 'failed'
                                ? 'text-red-800 dark:text-red-300'
                                : 'text-gray-600 dark:text-zinc-400'
                        }`}
                      >
                        Task {String(idx + 1)}
                      </span>
                      {step.error && (
                        <span className="text-red-600 dark:text-red-400 truncate ml-1">
                          — {step.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {autoLauncherRun.lastError && (
                  <div className="mt-2 p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
                    {autoLauncherRun.lastError}
                  </div>
                )}
              </div>
              {statusMessages.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-1">Status Log</h4>
                  <StatusLogList messages={statusMessages} maxHeight="150px" />
                </div>
              )}
              {itemResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-1">Results</h4>
                  <ItemResultList
                    items={itemResults.map((r) => ({
                      itemId: r.policyNumber || r.id,
                      status:
                        r.status === 'failure'
                          ? 'failed'
                          : r.status === 'error'
                            ? 'failed'
                            : (r.status as
                                | 'success'
                                | 'failed'
                                | 'skipped'
                                | 'pending'
                                | 'running'),
                      durationMs: r.durationMs,
                      error: r.error,
                    }))}
                    maxHeight="250px"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logs and Results - below the form (single mode) */}
        {showLogs && (
          <div className="space-y-3 border-t border-gray-200 dark:border-zinc-700 pt-4">
            {!isRunning && (
              <Button type="button" variant="danger-outline" size="sm" onClick={clearLogs}>
                Clear Run Output
              </Button>
            )}
            {statusMessages.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-1">Status Log</h4>
                <StatusLogList messages={statusMessages} maxHeight="150px" />
              </div>
            )}
            {itemResults.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-1">Results</h4>
                <ItemResultList
                  items={itemResults.map((r) => ({
                    itemId: r.policyNumber || r.id,
                    status:
                      r.status === 'failure'
                        ? 'failed'
                        : r.status === 'error'
                          ? 'failed'
                          : (r.status as 'success' | 'failed' | 'skipped' | 'pending' | 'running'),
                    durationMs: r.durationMs,
                    error: r.error,
                  }))}
                  maxHeight="250px"
                />
              </div>
            )}
          </div>
        )}
      </form>
    </Card>
  )
}
