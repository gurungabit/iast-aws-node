import { ASTSelector } from './ASTSelector'
import { AutoLauncherPanel } from './AutoLauncherPanel'
import { useASTRegistry } from '../registry'
import { Card } from '../../components/ui/Card'
import { useFormField } from '../../hooks/useFormField'
import { useASTStore } from '../../stores/ast-store'

// Register all ASTs
import '../login/register'
import '../bi-renew/register'
import '../rout-extractor/register'

export function ASTPanel(): React.ReactNode {
  const activeTabId = useASTStore((s) => s.activeTabId)
  const selectedASTId = useASTStore((s) =>
    activeTabId ? (s.tabs[activeTabId]?.selectedASTId ?? null) : null,
  )
  const setSelectedASTId = useASTStore((s) => s.setSelectedASTId)
  const { getAST } = useASTRegistry()

  const [panelMode, setPanelMode] = useFormField<'ast' | 'autolauncher'>('astPanelMode', 'ast')

  const selectedAST = selectedASTId ? getAST(selectedASTId) : null

  function handleSelect(id: string | null) {
    if (!activeTabId) return
    setSelectedASTId(activeTabId, id)
  }

  return (
    <div className="space-y-4">
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

      {panelMode === 'autolauncher' && <AutoLauncherPanel />}

      {panelMode === 'ast' && (
        <>
          <div>
            <label className="block text-left text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Select Automation
            </label>
            <ASTSelector
              value={selectedASTId}
              onChange={handleSelect}
              placeholder="Search for an AST..."
            />
          </div>

          {selectedAST ? (
            <selectedAST.component />
          ) : (
            <Card
              title="No AST Selected"
              description="Choose an automation from the dropdown above"
            >
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400 dark:text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  Select an AST to view its configuration and run it
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
