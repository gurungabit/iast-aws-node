import { eq, and, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { autoLaunchers, autoLauncherRuns } from '../db/schema/index.js'
import { executionService } from './execution.js'
import type { Worker } from 'worker_threads'

interface AutoLauncherStep {
  astName: string
  configName?: string
  params: Record<string, unknown>
}

interface RunStep extends AutoLauncherStep {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionId?: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export const autoLauncherService = {
  async create(data: { ownerId: string; name: string; visibility?: string; steps?: unknown[] }) {
    const [launcher] = await db
      .insert(autoLaunchers)
      .values({
        ownerId: data.ownerId,
        name: data.name,
        visibility: data.visibility ?? 'private',
        steps: data.steps ?? [],
      })
      .returning()
    return launcher
  },

  async findVisible(userId: string) {
    return db
      .select()
      .from(autoLaunchers)
      .where(or(eq(autoLaunchers.ownerId, userId), eq(autoLaunchers.visibility, 'public')))
  },

  async findById(id: string) {
    const [launcher] = await db
      .select()
      .from(autoLaunchers)
      .where(eq(autoLaunchers.id, id))
      .limit(1)
    return launcher ?? null
  },

  async update(
    id: string,
    ownerId: string,
    data: { name?: string; visibility?: string; steps?: unknown[] },
  ) {
    const [launcher] = await db
      .update(autoLaunchers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(autoLaunchers.id, id), eq(autoLaunchers.ownerId, ownerId)))
      .returning()
    return launcher ?? null
  },

  async remove(id: string, ownerId: string) {
    const result = await db
      .delete(autoLaunchers)
      .where(and(eq(autoLaunchers.id, id), eq(autoLaunchers.ownerId, ownerId)))
      .returning()
    return result.length > 0
  },

  async createRun(data: {
    id: string
    launcherId: string
    userId: string
    sessionId: string
    steps: unknown[]
  }) {
    const [run] = await db.insert(autoLauncherRuns).values(data).returning()
    return run
  },

  async updateRun(
    runId: string,
    data: { status?: string; steps?: unknown[]; currentStepIndex?: string; completedAt?: Date },
  ) {
    const [run] = await db
      .update(autoLauncherRuns)
      .set(data)
      .where(eq(autoLauncherRuns.id, runId))
      .returning()
    return run ?? null
  },

  async findRunsByUser(userId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(autoLauncherRuns)
      .where(eq(autoLauncherRuns.userId, userId))
      .limit(limit)
      .offset(offset)
  },

  /**
   * Execute an AutoLauncher run: iterate steps sequentially,
   * sending each AST to the worker thread and waiting for completion.
   * Creates execution records per step for history tracking.
   */
  async executeRun(
    runId: string,
    worker: Worker,
    steps: AutoLauncherStep[],
    sessionId: string,
    userId?: string,
  ): Promise<void> {
    const runSteps: RunStep[] = steps.map((s) => ({
      ...s,
      status: 'pending' as const,
    }))

    await this.updateRun(runId, { status: 'running', steps: runSteps })

    for (let i = 0; i < runSteps.length; i++) {
      const step = runSteps[i]
      const executionId = `${runId}-step-${i}`
      const today = new Date().toISOString().slice(0, 10)

      step.status = 'running'
      step.executionId = executionId
      step.startedAt = new Date().toISOString()

      await this.updateRun(runId, {
        currentStepIndex: String(i),
        steps: runSteps,
      })

      // Create execution record for history tracking
      try {
        await executionService.create({
          id: executionId,
          sessionId,
          userId: userId ?? 'unknown',
          astName: step.astName,
          executionDate: (step.params.userLocalDate as string) ?? today,
          runId,
        })
      } catch (err) {
        console.error(
          `Failed to create execution record for step ${i}:`,
          err instanceof Error ? err.message : String(err),
        )
      }

      try {
        // Send AST run command to worker
        worker.postMessage({
          type: 'ast.run',
          astName: step.astName,
          params: step.params,
          executionId,
        })

        // Wait for AST completion
        await waitForAstComplete(worker, executionId)

        step.status = 'completed'
        step.completedAt = new Date().toISOString()
      } catch (err) {
        step.status = 'failed'
        step.error = String(err)
        step.completedAt = new Date().toISOString()

        // Mark remaining steps as cancelled
        for (let j = i + 1; j < runSteps.length; j++) {
          runSteps[j].status = 'cancelled'
        }

        await this.updateRun(runId, {
          status: 'failed',
          steps: runSteps,
          completedAt: new Date(),
        })
        return
      }

      await this.updateRun(runId, { steps: runSteps })
    }

    await this.updateRun(runId, {
      status: 'completed',
      steps: runSteps,
      completedAt: new Date(),
    })
  },
}

/** Wait for ast.complete message from a worker for a specific executionId */
function waitForAstComplete(worker: Worker, executionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        worker.off('message', handler)
        reject(new Error(`AST execution ${executionId} timed out after 30 minutes`))
      },
      30 * 60 * 1000,
    )

    function handler(msg: { type: string; executionId?: string; status?: string; error?: string }) {
      if (msg.type === 'ast.complete' && msg.executionId === executionId) {
        clearTimeout(timeout)
        worker.off('message', handler)

        if (msg.status === 'failed') {
          reject(new Error(msg.error ?? 'AST execution failed'))
        } else if (msg.status === 'cancelled') {
          reject(new Error('AST execution cancelled'))
        } else {
          resolve()
        }
      }
    }

    worker.on('message', handler)
  })
}
