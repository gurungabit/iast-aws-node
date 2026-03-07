import { DatePicker } from '../../components/ui/DatePicker'
import { useAST } from '../../hooks/useAST'
import { useFormField } from '../../hooks/useFormField'
import { useAuth } from '../../auth/useAuth'
import { ASTFormWrapper, type CommonFormParams } from '../shared'
import { useASTRegistry } from '../registry'
import { getDefaultDate } from './types'
import { buildBiRenewPayload } from './payload'
import type { AstConfigTask } from '../types'

const AST_ID = 'bi_renew'

export function BiRenewASTForm(): React.ReactNode {
  const { executeAST } = useAST()
  const { user } = useAuth()
  const { getAST } = useASTRegistry()
  const astConfig = getAST(AST_ID)

  const [missedRunDate, setMissedRunDate] = useFormField<string>(
    'biRenew.missedRunDate',
    getDefaultDate(),
  )

  function getConfigParams(): Record<string, unknown> {
    return { missedRunDate }
  }

  function applyConfigParams(params: Record<string, unknown>) {
    setMissedRunDate(
      typeof params.missedRunDate === 'string' ? params.missedRunDate : getDefaultDate(),
    )
  }

  function buildPayload(common: CommonFormParams): Record<string, unknown> {
    const category = astConfig?.category ?? 'auto'
    return buildBiRenewPayload({
      common,
      userId: user?.id || 'anonymous',
      category,
      configParams: { missedRunDate },
    })
  }

  function handleRun(payload: Record<string, unknown>) {
    executeAST('bi_renew', payload)
  }

  function getDefaultTaskParams(): Record<string, unknown> {
    return { missedRunDate: getDefaultDate() }
  }

  function renderTaskInputs(
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) {
    const date = typeof task.params.missedRunDate === 'string' ? task.params.missedRunDate : ''
    return (
      <div className="max-w-xs">
        <DatePicker
          label="Missed Run Date"
          value={date}
          onChange={(val: string) => onParamsChange({ ...task.params, missedRunDate: val })}
          maxDaysBack={10}
          allowFuture={false}
          hint="Select a date up to 10 days in the past"
        />
      </div>
    )
  }

  return (
    <ASTFormWrapper
      title="BI Renew"
      description="Process BI renewal pending records"
      showParallel={astConfig?.supportsParallel ?? false}
      astName="bi_renew"
      buildPayload={buildPayload}
      getConfigParams={getConfigParams}
      applyConfigParams={applyConfigParams}
      onRun={handleRun}
      renderTaskInputs={renderTaskInputs}
      getDefaultTaskParams={getDefaultTaskParams}
    >
      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label="Missed Run Date"
          value={missedRunDate}
          onChange={(val: string) => setMissedRunDate(val)}
          maxDaysBack={10}
          allowFuture={false}
          hint="Select a date up to 10 days in the past"
        />
      </div>
    </ASTFormWrapper>
  )
}
