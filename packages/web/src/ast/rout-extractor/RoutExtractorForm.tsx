import { useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Input } from '../../components/ui/Input'
import { Toggle } from '../../components/ui/Toggle'
import { useAST } from '../../hooks/useAST'
import { useFormField } from '../../hooks/useFormField'
import { useAuth } from '../../auth/useAuth'
import { ASTFormWrapper, type CommonFormParams } from '../shared'
import { useASTRegistry } from '../registry'
import {
  ROUT_SECTIONS,
  getDefaultConfigParams,
  type Missing412Strategy,
  type NavigationMethod,
  type SourceMode,
} from './types'
import { buildRoutExtractorPayload } from './payload'
import { DataInquiryModal } from './DataInquiryModal'
import type { AstConfigTask } from '../types'

const AST_ID = 'rout_extractor'
const defaults = getDefaultConfigParams()

export function RoutExtractorForm(): React.ReactNode {
  const { executeAST } = useAST()
  const { user } = useAuth()
  const { getAST } = useASTRegistry()
  const astConfig = getAST(AST_ID)

  const [sourceMode, setSourceMode] = useFormField<SourceMode>(
    'routExtractor.sourceMode',
    defaults.sourceMode as SourceMode,
  )
  const [sections, setSections] = useFormField<string[]>(
    'routExtractor.sections',
    defaults.sections as string[],
  )
  const [statusActive, setStatusActive] = useFormField<boolean>(
    'routExtractor.statusActive',
    defaults.statusActive as boolean,
  )
  const [statusPended, setStatusPended] = useFormField<boolean>(
    'routExtractor.statusPended',
    defaults.statusPended as boolean,
  )
  const [statusOther, setStatusOther] = useFormField<boolean>(
    'routExtractor.statusOther',
    defaults.statusOther as boolean,
  )
  const [unitExclusions, setUnitExclusions] = useFormField<string>(
    'routExtractor.unitExclusions',
    defaults.unitExclusions as string,
  )
  const [navigationMethod, setNavigationMethod] = useFormField<NavigationMethod>(
    'routExtractor.navigationMethod',
    defaults.navigationMethod as NavigationMethod,
  )
  const [navigateAllOccs, setNavigateAllOccs] = useFormField<boolean>(
    'routExtractor.navigateAllOccs',
    defaults.navigateAllOccs as boolean,
  )
  const [startOcc, setStartOcc] = useFormField<number>(
    'routExtractor.startOcc',
    defaults.startOcc as number,
  )
  const [endOcc, setEndOcc] = useFormField<number>(
    'routExtractor.endOcc',
    defaults.endOcc as number,
  )
  const [supvIds, setSupvIds] = useFormField<string>(
    'routExtractor.supvIds',
    defaults.supvIds as string,
  )
  const [updateRouteItems, setUpdateRouteItems] = useFormField<boolean>(
    'routExtractor.updateRouteItems',
    defaults.updateRouteItems as boolean,
  )
  const [file412Path, setFile412Path] = useFormField<string>(
    'routExtractor.file412Path',
    defaults.file412Path as string,
  )
  const [missing412Strategy, setMissing412Strategy] = useFormField<Missing412Strategy>(
    'routExtractor.missing412Strategy',
    defaults.missing412Strategy as Missing412Strategy,
  )

  // File upload state (transient, not persisted)
  const [file412Content, setFile412Content] = useState<string>('')
  const [file412FileName, setFile412FileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Data Inquiry modal
  const [inquiryOpen, setInquiryOpen] = useState(false)

  function toggleSection(section: string) {
    const next = sections.includes(section)
      ? sections.filter((s: string) => s !== section)
      : [...sections, section]
    setSections(next)
  }

  function selectAllSections() {
    setSections([...ROUT_SECTIONS])
  }

  function clearAllSections() {
    setSections([])
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setFile412Content('')
      setFile412FileName('')
      return
    }
    setFile412FileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setFile412Content(btoa(text))
    }
    reader.readAsText(file, 'latin-1')
  }

  function clearFile() {
    setFile412Content('')
    setFile412FileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function getConfigParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {
      sourceMode,
      sections,
      statusActive,
      statusPended,
      statusOther,
      unitExclusions,
      navigationMethod,
      navigateAllOccs,
      startOcc,
      endOcc,
      supvIds,
      updateRouteItems,
      file412Path,
      missing412Strategy,
    }
    if (file412Content) {
      params.file412Content = file412Content
      params.file412FileName = file412FileName
    }
    return params
  }

  function applyConfigParams(params: Record<string, unknown>) {
    const d = getDefaultConfigParams()
    setSourceMode((params.sourceMode as SourceMode) ?? (d.sourceMode as SourceMode))
    setSections(
      Array.isArray(params.sections) ? (params.sections as string[]) : (d.sections as string[]),
    )
    setStatusActive(
      typeof params.statusActive === 'boolean' ? params.statusActive : (d.statusActive as boolean),
    )
    setStatusPended(
      typeof params.statusPended === 'boolean' ? params.statusPended : (d.statusPended as boolean),
    )
    setStatusOther(
      typeof params.statusOther === 'boolean' ? params.statusOther : (d.statusOther as boolean),
    )
    setUnitExclusions(
      typeof params.unitExclusions === 'string'
        ? params.unitExclusions
        : (d.unitExclusions as string),
    )
    setNavigationMethod(
      (params.navigationMethod as NavigationMethod) ?? (d.navigationMethod as NavigationMethod),
    )
    setNavigateAllOccs(
      typeof params.navigateAllOccs === 'boolean'
        ? params.navigateAllOccs
        : (d.navigateAllOccs as boolean),
    )
    setStartOcc(typeof params.startOcc === 'number' ? params.startOcc : (d.startOcc as number))
    setEndOcc(typeof params.endOcc === 'number' ? params.endOcc : (d.endOcc as number))
    setSupvIds(typeof params.supvIds === 'string' ? params.supvIds : (d.supvIds as string))
    setUpdateRouteItems(
      typeof params.updateRouteItems === 'boolean'
        ? params.updateRouteItems
        : (d.updateRouteItems as boolean),
    )
    setFile412Path(
      typeof params.file412Path === 'string' ? params.file412Path : (d.file412Path as string),
    )
    setMissing412Strategy(
      (params.missing412Strategy as Missing412Strategy) ??
        (d.missing412Strategy as Missing412Strategy),
    )
  }

  function buildPayload(common: CommonFormParams): Record<string, unknown> {
    const category = astConfig?.category ?? 'fire'
    return buildRoutExtractorPayload({
      common,
      userId: user?.id || 'anonymous',
      category,
      configParams: getConfigParams(),
    })
  }

  function handleRun(payload: Record<string, unknown>) {
    executeAST('rout_extractor', payload)
  }

  function getDefaultTaskParams(): Record<string, unknown> {
    return getDefaultConfigParams()
  }

  function renderTaskInputs(
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) {
    const taskSourceMode = (task.params.sourceMode as SourceMode) ?? '412'
    return (
      <div className="space-y-2">
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name={`task-source-${String(task.order)}`}
              value="412"
              checked={taskSourceMode === '412'}
              onChange={() => onParamsChange({ ...task.params, sourceMode: '412' })}
            />
            412 File
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name={`task-source-${String(task.order)}`}
              value="rout"
              checked={taskSourceMode === 'rout'}
              onChange={() => onParamsChange({ ...task.params, sourceMode: 'rout' })}
            />
            ROUT System
          </label>
        </div>
      </div>
    )
  }

  return (
    <ASTFormWrapper
      title="RoutExtractor"
      description="Extract ROUT data from 412 files or host screen scraping"
      showParallel={astConfig?.supportsParallel ?? false}
      astName={AST_ID}
      buildPayload={buildPayload}
      getConfigParams={getConfigParams}
      applyConfigParams={applyConfigParams}
      onRun={handleRun}
      renderTaskInputs={renderTaskInputs}
      getDefaultTaskParams={getDefaultTaskParams}
    >
      <div className="space-y-4">
        {/* Data Inquiry Button */}
        <div className="flex">
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Search className="h-4 w-4" />}
            onClick={() => setInquiryOpen(true)}
          >
            Data Inquiry
          </Button>
        </div>

        {/* Source Mode */}
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
            Data Source
          </span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="sourceMode"
                value="412"
                checked={sourceMode === '412'}
                onChange={() => setSourceMode('412')}
                className="accent-blue-600"
              />
              <span className="text-gray-700 dark:text-zinc-300">412 File Import</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="sourceMode"
                value="rout"
                checked={sourceMode === 'rout'}
                onChange={() => setSourceMode('rout')}
                className="accent-blue-600"
              />
              <span className="text-gray-700 dark:text-zinc-300">ROUT Screen Scraping</span>
            </label>
          </div>
        </div>

        {/* Sections */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Sections to Extract
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                onClick={selectAllSections}
              >
                Select All
              </button>
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                onClick={clearAllSections}
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {ROUT_SECTIONS.map((section) => (
              <Checkbox
                key={section}
                label={section.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                checked={sections.includes(section)}
                onChange={() => toggleSection(section)}
              />
            ))}
          </div>
        </div>

        {/* 412 Rout Status */}
        {sourceMode === '412' && (
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              412 Rout Status
            </span>
            <div className="flex gap-4">
              <Checkbox
                label="Active"
                checked={statusActive}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStatusActive(e.target.checked)
                }
              />
              <Checkbox
                label="Pended"
                checked={statusPended}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStatusPended(e.target.checked)
                }
              />
              <Checkbox
                label="Other (all)"
                checked={statusOther}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStatusOther(e.target.checked)
                }
              />
            </div>
          </div>
        )}

        {/* Unit Exclusions */}
        <Input
          label="Unit Exclusions"
          value={unitExclusions}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnitExclusions(e.target.value)}
          placeholder="e.g. 01;05;09"
          hint="Semicolon-separated PUI codes to exclude"
        />

        {/* 412 Mode Options */}
        {sourceMode === '412' && (
          <div className="space-y-3 pl-3 border-l-2 border-blue-500">
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                412 File
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Choose File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.412"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                {file412FileName && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400">
                    <span className="truncate max-w-48">{file412FileName}</span>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 cursor-pointer"
                      title="Remove file"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
                {!file412FileName && (
                  <span className="text-xs text-gray-500 dark:text-zinc-500">
                    No file selected — will use auto-resolved path
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                Upload a 412 file, or leave empty to auto-resolve from the corporate FTP share
              </p>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Missing File Strategy
              </span>
              <select
                value={missing412Strategy}
                onChange={(e) => setMissing412Strategy(e.target.value as Missing412Strategy)}
                className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="stop">Stop execution</option>
                <option value="use_rout">Fall back to ROUT screen</option>
                <option value="wait">Wait and retry</option>
              </select>
            </div>
            <Toggle
              label="Update Missing Policy Types from PDQ"
              description="Look up blank policy types from PDQ screen during extraction"
              checked={updateRouteItems}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUpdateRouteItems(e.target.checked)
              }
            />
          </div>
        )}

        {/* ROUT Mode Options */}
        {sourceMode === 'rout' && (
          <div className="space-y-3 pl-3 border-l-2 border-green-500">
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Navigation Method
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="navigationMethod"
                    value="occ"
                    checked={navigationMethod === 'occ'}
                    onChange={() => setNavigationMethod('occ')}
                    className="accent-green-600"
                  />
                  <span className="text-gray-700 dark:text-zinc-300">OCC (Occurrence)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="navigationMethod"
                    value="supv"
                    checked={navigationMethod === 'supv'}
                    onChange={() => setNavigationMethod('supv')}
                    className="accent-green-600"
                  />
                  <span className="text-gray-700 dark:text-zinc-300">SUPV (Supervisor)</span>
                </label>
              </div>
            </div>

            {navigationMethod === 'occ' && (
              <div className="space-y-3">
                <Toggle
                  label="Navigate All OCCs"
                  description="Cycle through all occurrences (1-11)"
                  checked={navigateAllOccs}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNavigateAllOccs(e.target.checked)
                  }
                />
                {!navigateAllOccs && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start OCC"
                      type="number"
                      value={String(startOcc)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setStartOcc(Math.max(1, Math.min(11, Number(e.target.value))))
                      }
                    />
                    <Input
                      label="End OCC"
                      type="number"
                      value={String(endOcc)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEndOcc(Math.max(1, Math.min(11, Number(e.target.value))))
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {navigationMethod === 'supv' && (
              <Input
                label="Supervisor IDs"
                value={supvIds}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupvIds(e.target.value)}
                placeholder="e.g. SMITH;JONES"
                hint="Semicolon-separated supervisor user IDs"
              />
            )}
          </div>
        )}
      </div>

      {/* Data Inquiry Modal */}
      <DataInquiryModal isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </ASTFormWrapper>
  )
}
