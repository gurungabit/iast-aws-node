import type { Ati } from 'tnz3270-node'
import type { MessagePort } from 'worker_threads'
import { ProgressReporter } from './progress.js'
import { executeAST } from './executor.js'
import type { ASTName } from '../types.js'

let currentReporter: ProgressReporter | null = null
let paused = false
let cancelled = false

export async function runAST(
  ati: Ati,
  astName: string,
  params: Record<string, unknown>,
  executionId: string,
  port: MessagePort,
) {
  // Normalize: frontend sends underscores (rout_extractor), server uses hyphens (rout-extractor)
  const normalizedName = astName.replace(/_/g, '-') as ASTName
  paused = false
  cancelled = false

  const reporter = new ProgressReporter(executionId, port)
  currentReporter = reporter

  reporter.reportStatus('running', normalizedName)

  try {
    await executeAST(ati, normalizedName, params, reporter, {
      checkpoint: async () => {
        if (cancelled) throw new Error('AST_CANCELLED')
        while (paused) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (cancelled) throw new Error('AST_CANCELLED')
        }
      },
    })
    reporter.reportComplete('completed')
  } catch (err) {
    const message = String(err)
    if (message.includes('AST_CANCELLED')) {
      reporter.reportComplete('cancelled')
    } else {
      reporter.reportComplete('failed', message)
    }
  } finally {
    currentReporter = null
  }
}

export function controlAST(action: 'pause' | 'resume' | 'cancel') {
  switch (action) {
    case 'pause':
      paused = true
      currentReporter?.reportStatus('paused', '')
      break
    case 'resume':
      paused = false
      currentReporter?.reportStatus('running', '')
      break
    case 'cancel':
      cancelled = true
      break
  }
}
