import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from './progress.js'
import type { ASTName } from '../types.js'
import { runLoginAST } from './login.js'
import { runBiRenewAST } from './bi-renew.js'
import { runRoutExtractorAST } from './rout-extractor.js'

export interface ASTContext {
  checkpoint: () => Promise<void>
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
