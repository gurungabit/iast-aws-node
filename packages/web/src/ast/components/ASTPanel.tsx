import { useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { ASTSelector } from './ASTSelector'
import { getAST } from '../registry'
import { useAST } from '../../hooks/useAST'
import { useASTStore } from '../../stores/ast-store'
import { Button } from '../../components/ui/Button'
import { cn, formatDuration } from '../../utils'

// Register all ASTs
import '../login/register'
import '../bi-renew/register'
import '../rout-extractor/register'

interface ASTPanelProps {
  sessionId: string
}

export function ASTPanel({ sessionId }: ASTPanelProps) {
  const [panelMode, setPanelMode] = useState<'ast' | 'autolauncher'>('ast')
  const [selectedAST, setSelectedAST] = useState<string | null>('login')
  const { runAST, controlAST, execution } = useAST(sessionId)

  const ast = selectedAST ? getAST(selectedAST) : null
  const isRunning = execution?.status === 'running' || execution?.status === 'paused'

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelMode('ast')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer select-none ${
            panelMode === 'ast'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          AST
        </button>
        <button
          type="button"
          onClick={() => setPanelMode('autolauncher')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer select-none ${
            panelMode === 'autolauncher'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          AutoLauncher
        </button>
      </div>

      {panelMode === 'autolauncher' && (
        <div className="text-sm text-gray-500 dark:text-zinc-400">
          AutoLauncher panel coming soon.
        </div>
      )}

      {panelMode === 'ast' && (
        <>
          {/* AST selector */}
          <div>
            <label className="block text-left text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Select Automation
            </label>
            <ASTSelector selected={selectedAST} onSelect={setSelectedAST} />
          </div>

          {/* AST form or execution view */}
          {isRunning || (execution && execution.status !== 'idle') ? (
            <ExecutionView sessionId={sessionId} execution={execution!} onControl={controlAST} />
          ) : ast ? (
            <ast.FormComponent
              sessionId={sessionId}
              onRun={(params) => runAST(ast.name, params)}
              disabled={isRunning}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

interface ExecutionViewProps {
  sessionId: string
  execution: NonNullable<ReturnType<typeof useASTStore.getState>['executions'] extends Map<string, infer V> ? V : never>
  onControl: (action: 'pause' | 'resume' | 'cancel') => void
}

function ExecutionView({ sessionId, execution, onControl }: ExecutionViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const clearExecution = useASTStore((s) => s.clearExecution)

  const virtualizer = useVirtualizer({
    count: execution.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  const isActive = execution.status === 'running' || execution.status === 'paused'
  const progressPct = execution.progress.total > 0
    ? Math.round((execution.progress.current / execution.progress.total) * 100)
    : 0

  return (
    <div className="flex flex-col gap-2">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">{execution.progress.message}</span>
          <span className={cn(
            'font-medium',
            execution.status === 'completed' ? 'text-green-600 dark:text-green-400' :
            execution.status === 'failed' ? 'text-red-600 dark:text-red-400' :
            execution.status === 'cancelled' ? 'text-yellow-600 dark:text-yellow-400' :
            'text-blue-600 dark:text-blue-400'
          )}>
            {execution.status} {progressPct > 0 && `(${progressPct}%)`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              execution.status === 'completed' ? 'bg-green-500' :
              execution.status === 'failed' ? 'bg-red-500' :
              'bg-blue-500'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {isActive && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onControl(execution.status === 'paused' ? 'resume' : 'pause')}
            >
              {execution.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => onControl('cancel')}>
              Cancel
            </Button>
          </>
        )}
        {!isActive && (
          <Button variant="ghost" size="sm" onClick={() => clearExecution(sessionId)}>
            Clear
          </Button>
        )}
      </div>

      {/* Error */}
      {execution.error && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-600 dark:text-red-300">
          {execution.error}
        </div>
      )}

      {/* Results - virtual scrolling */}
      <div className="text-[10px] text-gray-500 dark:text-zinc-500">
        {execution.items.length} results
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = execution.items[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/50 px-1 text-xs"
              >
                <span className="font-mono text-gray-900 dark:text-gray-300">{item.policyNumber}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">{formatDuration(item.durationMs)}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      item.status === 'success' && 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                      item.status === 'failure' && 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                      item.status === 'error' && 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
                      item.status === 'skipped' && 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                    )}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
