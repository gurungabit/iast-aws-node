import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from './progress.js'
import type { ASTName } from '../types.js'
import { runLoginAST } from './login/index.js'
import { runBiRenewAST } from './bi-renew/index.js'
import { runRoutExtractorAST } from './rout-extractor/index.js'

export interface ASTContext {
  checkpoint: () => Promise<void>
  /** Set of policy numbers already completed in a previous execution (for resume) */
  completedPolicies: Set<string>
}

export async function executeAST(
  ati: Ati,
  astName: ASTName,
  params: Record<string, unknown>,
  reporter: ProgressReporter,
  ctx: ASTContext,
) {
  switch (astName) {
    case 'login':
      return runLoginAST(ati, params, reporter, ctx)
    case 'bi-renew':
      return runBiRenewAST(ati, params, reporter, ctx)
    case 'rout-extractor':
      return runRoutExtractorAST(ati, params, reporter, ctx)
    default:
      throw new Error(`Unknown AST: ${astName}`)
  }
}
