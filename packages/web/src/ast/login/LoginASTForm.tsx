import { useMemo } from 'react'
import { useAST } from '../../hooks/useAST'
import { useFormField } from '../../hooks/useFormField'
import { useAuth } from '../../auth/useAuth'
import { ASTFormWrapper, type CommonFormParams } from '../shared'
import { useASTRegistry } from '../registry'
import { parsePolicyNumbers } from './types'
import { buildLoginPayload } from './payload'
import type { AstConfigTask } from '../types'

const AST_ID = 'login'

export function LoginASTForm(): React.ReactNode {
  const { executeAST } = useAST()
  const { user } = useAuth()
  const { getAST } = useASTRegistry()
  const astConfig = getAST(AST_ID)

  const [policyInput, setPolicyInput] = useFormField<string>('login.policyNumbers', '')

  const { validPolicies, invalidCount } = useMemo(() => {
    const parsed = parsePolicyNumbers(policyInput)
    const parts = policyInput.split(/[,\s\n]+/).filter(Boolean)
    return { validPolicies: parsed, invalidCount: parts.length - parsed.length }
  }, [policyInput])

  function getConfigParams(): Record<string, unknown> {
    return { policyInput }
  }

  function applyConfigParams(params: Record<string, unknown>) {
    setPolicyInput(typeof params.policyInput === 'string' ? params.policyInput : '')
  }

  function buildPayload(common: CommonFormParams): Record<string, unknown> {
    const category = astConfig?.category ?? 'fire'
    return buildLoginPayload({
      common,
      userId: user?.id || 'anonymous',
      category,
      configParams: { policyInput },
    })
  }

  function handleRun(payload: Record<string, unknown>) {
    executeAST('login', payload)
  }

  function getDefaultTaskParams(): Record<string, unknown> {
    return { policyInput: '' }
  }

  function renderTaskInputs(
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) {
    const taskPolicyInput =
      typeof task.params.policyInput === 'string' ? task.params.policyInput : ''
    const parsed = parsePolicyNumbers(taskPolicyInput)
    const parts = taskPolicyInput.split(/[,\s\n]+/).filter(Boolean)
    const taskInvalidCount = parts.length - parsed.length

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
          Policy Numbers
          {parsed.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-zinc-500">
              ({parsed.length} valid)
            </span>
          )}
        </label>
        <textarea
          className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
          rows={3}
          placeholder="Enter 9-char policy numbers (comma, space, or newline separated)"
          value={taskPolicyInput}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onParamsChange({ ...task.params, policyInput: e.target.value })
          }
        />
        {taskInvalidCount > 0 && (
          <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
            {taskInvalidCount} invalid policy number(s) will be skipped
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          Optional. Leave empty for login-only test.
        </p>
      </div>
    )
  }

  return (
    <ASTFormWrapper
      title="TSO Login"
      description="Automated TSO login with policy processing"
      showParallel={astConfig?.supportsParallel ?? false}
      astName="login"
      buildPayload={buildPayload}
      getConfigParams={getConfigParams}
      applyConfigParams={applyConfigParams}
      onRun={handleRun}
      renderTaskInputs={renderTaskInputs}
      getDefaultTaskParams={getDefaultTaskParams}
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
          Policy Numbers
          {validPolicies.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-zinc-500">
              ({validPolicies.length} valid)
            </span>
          )}
        </label>
        <textarea
          className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
          rows={3}
          placeholder="Enter 9-char policy numbers (comma, space, or newline separated)"
          value={policyInput}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPolicyInput(e.target.value)}
        />
        {invalidCount > 0 && (
          <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
            {invalidCount} invalid policy number(s) will be skipped
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          Optional. Leave empty for login-only test.
        </p>
      </div>
    </ASTFormWrapper>
  )
}
