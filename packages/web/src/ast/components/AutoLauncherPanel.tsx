import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, RefreshCw, Trash2 } from 'lucide-react'

import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusLogList } from '../../components/ui/StatusLogList'
import { ItemResultList } from '../../components/ui/ItemResultList'

import { useASTStore, type AutoLauncherStepState } from '../../stores/ast-store'
import { useAutoLauncherDraftStore, type DraftStep } from '../../stores/auto-launcher-draft-store'
import { useAuth } from '../../auth/useAuth'
import { CredentialsInput } from '../shared/CredentialsInput'
import { getVisibleASTs, getAST } from '../registry'
import type { SavedAstConfigWithAccess } from '../types'
import { extractAlias, getLocalDateString } from '../types'
import { listAstConfigs } from '../../services/ast-configs'
import {
  getAutoLaunchers,
  createAutoLauncher,
  updateAutoLauncher,
  deleteAutoLauncher,
  runAutoLauncher,
  type AutoLauncherDto,
} from '../../services/auto-launchers'

// ---------------------------------------------------------------------------
// SortableStepRow
// ---------------------------------------------------------------------------

function SortableStepRow(props: {
  step: DraftStep
  index: number
  astLabel: string
  onRemove: (stepId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.step.stepId,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md"
    >
      <div className="flex items-center gap-2 p-2">
        <div
          className="text-gray-500 dark:text-zinc-400 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
            {props.index + 1}. {props.astLabel}
          </div>
          <div className="text-xs text-gray-600 dark:text-zinc-400 truncate">
            {props.step.configName ?? props.step.configId}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => props.onRemove(props.step.stepId)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AutoLauncherPanel (main)
// ---------------------------------------------------------------------------

export const AutoLauncherPanel = memo(function AutoLauncherPanel() {
  const activeTabId = useASTStore((s) => s.activeTabId)
  const astStatus = useASTStore((s) => {
    const tabId = s.activeTabId
    if (!tabId) return 'idle'
    return s.tabs[tabId]?.status ?? 'idle'
  })
  const credentials = useASTStore((s) => {
    const tabId = s.activeTabId
    if (!tabId) return { username: '', password: '' }
    return s.tabs[tabId]?.credentials ?? { username: '', password: '' }
  })
  const setCredentials = useASTStore((s) => s.setCredentials)

  const { user } = useAuth()

  // Auto-populate username from email alias (same as AST forms)
  useEffect(() => {
    if (activeTabId && !credentials.username && user?.email) {
      const alias = extractAlias(user.email).toUpperCase()
      if (alias) setCredentials(activeTabId, { username: alias })
    }
  }, [activeTabId, credentials.username, user?.email, setCredentials])

  const upsertDraft = useAutoLauncherDraftStore((s) => s.upsertDraft)
  const resetDraft = useAutoLauncherDraftStore((s) => s.resetDraft)

  const [launchersMine, setLaunchersMine] = useState<AutoLauncherDto[]>([])
  const [launchersPublic, setLaunchersPublic] = useState<AutoLauncherDto[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedLauncher, setSelectedLauncher] = useState<AutoLauncherDto | null>(null)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [steps, setSteps] = useState<DraftStep[]>([])

  const [newStepAstName, setNewStepAstName] = useState<string | null>(null)
  const [newStepConfigId, setNewStepConfigId] = useState<string | null>(null)
  const [availableConfigs, setAvailableConfigs] = useState<SavedAstConfigWithAccess[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const [isDraftHydrated, setIsDraftHydrated] = useState(false)

  const isAstBusy = astStatus === 'running' || astStatus === 'paused'
  const isCredsValid = credentials.username.trim().length > 0 && credentials.password.trim().length > 0
  const isLauncherValid = name.trim().length > 0 && steps.length > 0
  const showCancel = selectedLauncher !== null || name.trim().length > 0 || steps.length > 0

  const allASTs = useMemo(() => getVisibleASTs(), [])
  const astOptions = useMemo(
    () => allASTs.map((a) => ({ value: a.id, label: a.name })),
    [allASTs],
  )

  const configOptions = useMemo(
    () => availableConfigs.map((c) => ({ value: c.configId, label: c.configurationName })),
    [availableConfigs],
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ---- Data fetching ----

  const refreshLists = useCallback(async () => {
    try {
      setLoadingLists(true)
      setListError(null)
      const all = await getAutoLaunchers()
      // Split mine vs public (public = not owned by me but visible)
      // Since the API returns all visible launchers, we need the userId.
      // We don't have userId easily here, so split by ownerId heuristic:
      // If we have a selectedLauncher from "mine", its ownerId matches.
      // Simpler: show all in one list and let the user decide.
      // Actually, we separate by assuming the first fetch tells us our id.
      setLaunchersMine(all.filter((l) => l.visibility === 'private'))
      setLaunchersPublic(all.filter((l) => l.visibility === 'public'))
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load launchers')
    } finally {
      setLoadingLists(false)
    }
  }, [])

  useEffect(() => {
    void refreshLists()
  }, [refreshLists])

  // ---- Per-tab draft hydration ----

  useEffect(() => {
    setIsDraftHydrated(false)
  }, [activeTabId])

  useEffect(() => {
    if (!activeTabId) return

    let existing = useAutoLauncherDraftStore.getState().drafts[activeTabId]
    if (!existing) {
      resetDraft(activeTabId)
      existing = useAutoLauncherDraftStore.getState().drafts[activeTabId]
    }
    if (!existing) return

    setSelectedLauncher(existing.selectedLauncher)
    setName(existing.name)
    setVisibility(existing.visibility)
    setSteps(existing.steps)
    setNewStepAstName(existing.newStepAstName)
    setNewStepConfigId(existing.newStepConfigId)
    setIsDraftHydrated(true)
  }, [activeTabId, resetDraft])

  // Persist draft changes
  useEffect(() => {
    if (!activeTabId || !isDraftHydrated) return
    upsertDraft(activeTabId, {
      selectedLauncher,
      name,
      visibility,
      steps,
      newStepAstName,
      newStepConfigId,
    })
  }, [
    activeTabId,
    isDraftHydrated,
    selectedLauncher,
    name,
    visibility,
    steps,
    newStepAstName,
    newStepConfigId,
    upsertDraft,
  ])

  // ---- Load configs when AST changes ----

  useEffect(() => {
    if (!newStepAstName) {
      setAvailableConfigs([])
      return
    }
    setLoadingConfigs(true)
    listAstConfigs(newStepAstName)
      .then(setAvailableConfigs)
      .catch(() => setAvailableConfigs([]))
      .finally(() => setLoadingConfigs(false))
  }, [newStepAstName])

  // ---- Editor actions ----

  const resetEditor = useCallback(() => {
    if (activeTabId) resetDraft(activeTabId)
    setSelectedLauncher(null)
    setName('')
    setVisibility('private')
    setSteps([])
    setNewStepAstName(null)
    setNewStepConfigId(null)
    setSaveError(null)
    setSaveSuccess(null)
    setRunError(null)
  }, [activeTabId, resetDraft])

  const loadLauncherIntoEditor = useCallback((launcher: AutoLauncherDto) => {
    setSelectedLauncher(launcher)
    setName(launcher.name)
    setVisibility(launcher.visibility as 'private' | 'public')

    const launcherSteps = (launcher.steps as Array<{ astName: string; configId: string; order: number }>) ?? []
    const sorted = [...launcherSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const baseSteps: DraftStep[] = sorted.map((s, idx) => ({
      stepId: `${s.configId}-${idx}`,
      astName: s.astName,
      configId: s.configId,
      order: idx,
    }))
    setSteps(baseSteps)

    // Enrich steps with config names in background
    const uniqueAsts = [...new Set(sorted.map((s) => s.astName))]
    void Promise.all(
      uniqueAsts.map((astName) =>
        listAstConfigs(astName).catch(() => [] as SavedAstConfigWithAccess[]),
      ),
    ).then((results) => {
      const configMap = new Map<string, SavedAstConfigWithAccess>()
      for (const configs of results) {
        for (const c of configs) configMap.set(c.configId, c)
      }
      setSteps((prev) =>
        prev.map((s) => {
          const cfg = configMap.get(s.configId)
          if (!cfg) return s
          return { ...s, configName: cfg.configurationName }
        }),
      )
    })

    setNewStepAstName(null)
    setNewStepConfigId(null)
    setSaveError(null)
    setSaveSuccess(null)
    setRunError(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSteps((prev) => {
      const oldIndex = prev.findIndex((s) => s.stepId === String(active.id))
      const newIndex = prev.findIndex((s) => s.stepId === String(over.id))
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }))
    })
  }, [])

  const addStep = useCallback(() => {
    if (!newStepAstName || !newStepConfigId) return
    const cfg = availableConfigs.find((c) => c.configId === newStepConfigId)
    setSteps((prev) => [
      ...prev,
      {
        stepId: `${newStepConfigId}-${Date.now()}`,
        astName: newStepAstName,
        configId: newStepConfigId,
        configName: cfg?.configurationName,
        order: prev.length,
      },
    ])
    setNewStepConfigId(null)
  }, [availableConfigs, newStepAstName, newStepConfigId])

  const removeStep = useCallback((stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.stepId !== stepId).map((s, i) => ({ ...s, order: i })))
  }, [])

  const handleSave = useCallback(async () => {
    setSaveError(null)
    setSaveSuccess(null)

    try {
      if (!name.trim()) throw new Error('Name is required')
      if (steps.length === 0) throw new Error('Add at least one step')

      const payloadSteps = steps.map((s, idx) => ({
        astName: s.astName,
        configId: s.configId,
        order: idx,
      }))

      if (!selectedLauncher) {
        const created = await createAutoLauncher({
          name,
          visibility,
          steps: payloadSteps,
        })
        setSelectedLauncher(created as unknown as AutoLauncherDto)
        setSaveSuccess('Created')
        await refreshLists()
        return
      }

      await updateAutoLauncher(selectedLauncher.id, {
        name,
        visibility,
        steps: payloadSteps,
      })
      setSaveSuccess('Saved')
      await refreshLists()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [name, refreshLists, selectedLauncher, steps, visibility])

  const handleDeleteLauncher = useCallback(
    async (launcher: AutoLauncherDto) => {
      setSaveError(null)
      setSaveSuccess(null)
      try {
        await deleteAutoLauncher(launcher.id)
        if (selectedLauncher?.id === launcher.id) resetEditor()
        await refreshLists()
        setSaveSuccess('Deleted')
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [refreshLists, resetEditor, selectedLauncher?.id],
  )

  const handleRun = useCallback(async () => {
    setRunError(null)
    try {
      if (!activeTabId) throw new Error('No active session')
      if (!selectedLauncher) throw new Error('Save the launcher before running')
      if (!credentials.username || !credentials.password) throw new Error('Username and password are required')
      if (steps.length === 0) throw new Error('Add at least one step')

      setIsRunning(true)
      useASTStore.getState().clearLogs(activeTabId)
      useASTStore.getState().addStatusMessage(activeTabId, 'Starting AutoLauncher run...')

      const result = await runAutoLauncher(selectedLauncher.id, {
        sessionId: activeTabId,
        username: credentials.username,
        password: credentials.password,
        userLocalDate: getLocalDateString(),
      })

      useASTStore.getState().beginAutoLauncherRun(activeTabId, {
        runId: result.runId,
        launcherId: selectedLauncher.id,
        steps: result.steps.map((s) => ({
          astName: s.astName,
          configId: s.configId,
          order: s.order,
          stepLabel: s.stepLabel,
          configName: s.configName,
        })),
        displayName: selectedLauncher.name,
      })

      useASTStore.getState().addStatusMessage(activeTabId, `AutoLauncher "${selectedLauncher.name}" started`)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to run')
    } finally {
      setIsRunning(false)
    }
  }, [activeTabId, credentials, selectedLauncher, steps])

  const astLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allASTs) map.set(a.id, a.name)
    return map
  }, [allASTs])

  const liveOutput = activeTabId ? <AutoLauncherLiveOutput tabId={activeTabId} /> : null

  // ---- Render ----

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100">AutoLauncher</div>
          <div className="text-xs text-gray-600 dark:text-zinc-400">
            Run multiple saved AST configs in order
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshLists()}
            disabled={loadingLists}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer select-none disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLists ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={resetEditor}
            className="px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer select-none bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
          >
            New
          </button>
        </div>
      </div>

      {listError && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs">
          {listError}
        </div>
      )}

      {/* Runtime Credentials (shared with AST forms) */}
      <Card title="Runtime Credentials" description="Shared across AST tabs (never saved)">
        <CredentialsInput
          username={credentials.username}
          password={credentials.password}
          onUsernameChange={(v) => { if (activeTabId) setCredentials(activeTabId, { username: v }) }}
          onPasswordChange={(v) => { if (activeTabId) setCredentials(activeTabId, { password: v }) }}
          disabled={isRunning || isAstBusy}
        />
      </Card>

      {/* Launcher Browser */}
      <div className="grid grid-cols-2 gap-3">
        <Card title="My Launchers">
          <div className="space-y-1.5">
            {launchersMine.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-zinc-400">None yet</div>
            ) : (
              launchersMine.map((l) => (
                <LauncherRow
                  key={l.id}
                  launcher={l}
                  isSelected={selectedLauncher?.id === l.id}
                  onEdit={loadLauncherIntoEditor}
                  onDelete={handleDeleteLauncher}
                />
              ))
            )}
          </div>
        </Card>
        <Card title="Public Launchers">
          <div className="space-y-1.5">
            {launchersPublic.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-zinc-400">None available</div>
            ) : (
              launchersPublic.map((l) => (
                <LauncherRow
                  key={l.id}
                  launcher={l}
                  isSelected={selectedLauncher?.id === l.id}
                  onEdit={loadLauncherIntoEditor}
                  onDelete={handleDeleteLauncher}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Editor Card */}
      <Card
        title={selectedLauncher ? `Edit: ${selectedLauncher.name}` : 'Create Launcher'}
        description="Build an ordered list of steps (drag to reorder)"
        footer={
          <div className="flex gap-2">
            {showCancel && (
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={isRunning || isAstBusy}
                onClick={resetEditor}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={!isLauncherValid || isRunning || isAstBusy}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              isLoading={isRunning}
              disabled={!isLauncherValid || !isCredsValid || isRunning || isAstBusy}
              onClick={() => void handleRun()}
            >
              {isRunning ? 'Running...' : 'Run'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {liveOutput}

          {/* Feedback */}
          {(saveError || saveSuccess || runError) && (
            <div className="space-y-1.5">
              {saveError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
                  {saveError}
                </div>
              )}
              {runError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
                  {runError}
                </div>
              )}
              {saveSuccess && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-xs">
                  {saveSuccess}
                </div>
              )}
            </div>
          )}

          {/* Name + Visibility */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My launcher"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Visibility
              </label>
              <Select
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'public', label: 'Public' },
                ]}
                value={visibility}
                onChange={(v) => setVisibility(v as 'private' | 'public')}
                searchable={false}
                clearable={false}
                size="sm"
              />
            </div>
          </div>

          {/* Step Builder */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">Add Step</div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">
                  AST
                </label>
                <Select
                  options={astOptions}
                  value={newStepAstName ?? ''}
                  onChange={(v) => {
                    setNewStepAstName(v || null)
                    setNewStepConfigId(null)
                  }}
                  placeholder="Select AST..."
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">
                  Saved Config
                </label>
                <Select
                  options={configOptions}
                  value={newStepConfigId ?? ''}
                  onChange={(v) => setNewStepConfigId(v || null)}
                  placeholder={loadingConfigs ? 'Loading...' : 'Select config...'}
                  disabled={!newStepAstName || loadingConfigs}
                  size="sm"
                />
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={addStep}
                disabled={!newStepConfigId || !newStepAstName}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">Steps</div>
            {steps.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-zinc-400">No steps yet</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps.map((s) => s.stepId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {steps.map((s, idx) => (
                      <SortableStepRow
                        key={s.stepId}
                        step={s}
                        index={idx}
                        astLabel={astLabels.get(s.astName) ?? s.astName}
                        onRemove={removeStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
})

// ---------------------------------------------------------------------------
// LauncherRow
// ---------------------------------------------------------------------------

function LauncherRow(props: {
  launcher: AutoLauncherDto
  isSelected: boolean
  onEdit: (l: AutoLauncherDto) => void
  onDelete: (l: AutoLauncherDto) => void
}) {
  const { launcher, isSelected, onEdit, onDelete } = props

  return (
    <div
      className={`p-2 rounded-md border transition-colors ${
        isSelected
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium text-gray-900 dark:text-zinc-100 truncate">
            {launcher.name}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400">
            {launcher.visibility}
          </div>
        </div>
        <button
          type="button"
          title="Edit"
          onClick={() => onEdit(launcher)}
          className="p-1 rounded transition-colors cursor-pointer text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Delete"
          onClick={() => void onDelete(launcher)}
          className="p-1 rounded transition-colors cursor-pointer text-gray-500 hover:text-red-700 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AutoLauncherLiveOutput
// ---------------------------------------------------------------------------

const AutoLauncherLiveOutput = memo(function AutoLauncherLiveOutput(props: { tabId: string }) {
  const astStatus = useASTStore((s) => s.tabs[props.tabId]?.status ?? 'idle')
  const runningAstName = useASTStore((s) => s.tabs[props.tabId]?.runningAST ?? null)
  const astProgress = useASTStore((s) => s.tabs[props.tabId]?.progress ?? null)
  const astStatusMessages = useASTStore((s) => s.tabs[props.tabId]?.statusMessages ?? [])
  const astItemResults = useASTStore((s) => s.tabs[props.tabId]?.itemResults ?? [])
  const astLastResult = useASTStore((s) => s.tabs[props.tabId]?.lastResult ?? null)
  const autoLauncherRun = useASTStore((s) => s.tabs[props.tabId]?.autoLauncherRun ?? null)

  const isAstBusy = astStatus === 'running' || astStatus === 'paused'
  const hasLogs = astStatusMessages.length > 0 || astItemResults.length > 0

  const handleClearLogs = useCallback(() => {
    useASTStore.getState().clearLogs(props.tabId)
    useASTStore.getState().clearAutoLauncherRun(props.tabId)
  }, [props.tabId])

  const hasOutput = hasLogs || isAstBusy || astProgress !== null || Boolean(astLastResult?.error) || autoLauncherRun !== null
  if (!hasOutput) return null

  const activeStepIndex = autoLauncherRun
    ? Math.max(
        autoLauncherRun.steps.findIndex((s) => s.status === 'running'),
        autoLauncherRun.nextStepIndex > 0 ? autoLauncherRun.nextStepIndex - 1 : 0,
      )
    : -1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={astStatus} />
        <div className="flex items-center gap-2 min-w-0">
          {runningAstName && (
            <div className="text-xs text-gray-600 dark:text-zinc-400 truncate">{runningAstName}</div>
          )}
          {!isAstBusy && (hasLogs || autoLauncherRun) && (
            <Button variant="danger" size="sm" onClick={handleClearLogs}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {astLastResult?.error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
          {astLastResult.error}
        </div>
      )}

      {autoLauncherRun && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
              {autoLauncherRun.displayName ?? 'AutoLauncher'} — Steps
            </div>
            <div className={`text-[11px] font-medium ${
              autoLauncherRun.status === 'completed' ? 'text-green-600 dark:text-green-400'
              : autoLauncherRun.status === 'failed' ? 'text-red-600 dark:text-red-400'
              : 'text-blue-600 dark:text-blue-400'
            }`}>
              {autoLauncherRun.status}
            </div>
          </div>

          {autoLauncherRun.lastError && (
            <div className="text-[11px] text-red-700 dark:text-red-400">{autoLauncherRun.lastError}</div>
          )}

          <div className="space-y-1">
            {autoLauncherRun.steps.map((step, idx) => (
              <StepStatusRow
                key={`${String(step.order)}:${step.astName}:${step.configId}`}
                step={step}
                index={idx}
                isActive={idx === activeStepIndex && autoLauncherRun.status === 'running'}
              />
            ))}
          </div>
        </div>
      )}

      {(isAstBusy || astProgress) && (
        <ProgressBar
          value={astProgress?.percentage ?? 0}
          label={
            astProgress
              ? autoLauncherRun && autoLauncherRun.steps.length > 0
                ? `Step ${String(activeStepIndex + 1)} of ${String(autoLauncherRun.steps.length)} - Processing ${String(astProgress.current)} of ${String(astProgress.total)}`
                : `Processing ${String(astProgress.current)} of ${String(astProgress.total)}`
              : 'Processing...'
          }
          currentItem={astProgress?.currentItem}
          message={astProgress?.message}
          variant={astProgress?.itemStatus === 'failed' ? 'error' : 'default'}
        />
      )}

      {hasLogs && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">Logs & Results</div>

          {astStatusMessages.length > 0 && (
            <StatusLogList messages={astStatusMessages} maxHeight="140px" />
          )}

          {astItemResults.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-zinc-500 mb-1">Results</div>
              <ItemResultList
                items={astItemResults.map((r) => ({
                  itemId: r.policyNumber ?? r.id,
                  status: r.status === 'failure' ? 'failed' : (r.status as 'success' | 'failed' | 'skipped'),
                  durationMs: r.durationMs,
                  error: r.error,
                }))}
                maxHeight="220px"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// StepStatusRow
// ---------------------------------------------------------------------------

function StepStatusRow(props: {
  step: AutoLauncherStepState
  index: number
  isActive: boolean
}) {
  const { step, index, isActive } = props
  const astDef = getAST(step.astName)

  const statusText =
    step.status === 'pending' ? 'Pending'
    : step.status === 'running' ? 'Running'
    : step.status === 'success' ? 'Success'
    : 'Failed'

  const statusClass =
    step.status === 'success' ? 'text-green-700 dark:text-green-400'
    : step.status === 'failed' ? 'text-red-700 dark:text-red-400'
    : step.status === 'running' ? 'text-blue-700 dark:text-blue-400'
    : 'text-gray-500 dark:text-zinc-400'

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${
        isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-zinc-900/20'
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs text-gray-800 dark:text-zinc-200 truncate">
          {step.stepLabel ?? `Step ${index + 1}`}: {step.configName ?? astDef?.name ?? step.astName}
        </div>
        {step.error && (
          <div className="text-[11px] text-red-700 dark:text-red-400 truncate">{step.error}</div>
        )}
      </div>
      <div className={`text-xs font-medium flex-shrink-0 ${statusClass}`}>{statusText}</div>
    </div>
  )
}
