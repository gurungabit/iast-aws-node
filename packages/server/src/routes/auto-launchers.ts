import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { autoLauncherService } from '../services/auto-launcher.js'
import { astConfigService } from '../services/ast-config.js'
import { terminalManager } from '../terminal/manager.js'

const errorSchema = z.object({ error: z.string() })

export async function autoLauncherRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/auto-launchers',
    {
      schema: {
        tags: ['Auto Launchers'],
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              ownerId: z.string(),
              name: z.string(),
              visibility: z.string(),
              steps: z.unknown(),
              createdAt: z.coerce.date(),
              updatedAt: z.coerce.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return autoLauncherService.findVisible(request.user.id)
    },
  )

  typed.post(
    '/auto-launchers',
    {
      schema: {
        tags: ['Auto Launchers'],
        body: z.object({
          name: z.string(),
          visibility: z.enum(['private', 'public']).optional(),
          steps: z.array(z.unknown()).optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            visibility: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const launcher = await autoLauncherService.create({
        ...request.body,
        ownerId: request.user.id,
      })
      return reply.status(201).send(launcher)
    },
  )

  typed.patch(
    '/auto-launchers/:id',
    {
      schema: {
        tags: ['Auto Launchers'],
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().optional(),
          visibility: z.enum(['private', 'public']).optional(),
          steps: z.array(z.unknown()).optional(),
        }),
        response: { 200: z.object({ id: z.string(), name: z.string() }), 404: errorSchema },
      },
    },
    async (request, reply) => {
      const launcher = await autoLauncherService.update(
        request.params.id,
        request.user.id,
        request.body,
      )
      if (!launcher) return reply.status(404).send({ error: 'Launcher not found' })
      return launcher
    },
  )

  typed.delete(
    '/auto-launchers/:id',
    {
      schema: {
        tags: ['Auto Launchers'],
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      await autoLauncherService.remove(request.params.id, request.user.id)
      reply.code(204)
      return
    },
  )

  typed.post(
    '/auto-launchers/:id/run',
    {
      schema: {
        tags: ['Auto Launchers'],
        params: z.object({ id: z.string() }),
        body: z.object({
          sessionId: z.string(),
          username: z.string(),
          password: z.string(),
          userLocalDate: z.string().optional(),
        }),
        response: {
          200: z.object({
            runId: z.string(),
            sessionId: z.string(),
            steps: z.array(
              z.object({
                astName: z.string(),
                configId: z.string(),
                order: z.number(),
                stepLabel: z.string().optional(),
                configName: z.string().optional(),
              }),
            ),
          }),
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const launcher = await autoLauncherService.findById(request.params.id)
      if (!launcher) return reply.status(404).send({ error: 'Launcher not found' })

      const { sessionId, username, password, userLocalDate } = request.body
      const steps = (launcher.steps as Array<{ astName: string; configId: string; order: number }>) ?? []
      const runId = crypto.randomUUID()

      // Load configs for each step to build params and get display names
      const resolvedSteps = await Promise.all(
        steps.map(async (s, idx) => {
          const config = await astConfigService.findById(s.configId)
          const params: Record<string, unknown> = {
            ...(config?.params ?? {}),
            username,
            password,
            userLocalDate: userLocalDate ?? new Date().toISOString().slice(0, 10),
          }
          return {
            astName: s.astName,
            configId: s.configId,
            configName: config?.name,
            order: s.order ?? idx,
            stepLabel: `Step ${idx + 1}`,
            params,
          }
        }),
      )

      await autoLauncherService.createRun({
        id: runId,
        launcherId: launcher.id,
        userId: request.user.id,
        sessionId,
        steps: resolvedSteps.map((s) => ({ ...s, status: 'pending' })),
      })

      // Get the worker for this session and kick off execution in background
      const worker = terminalManager.getWorker(sessionId)
      if (worker) {
        const execSteps = resolvedSteps.map((s) => ({
          astName: s.astName,
          configName: s.configName,
          params: s.params,
        }))
        autoLauncherService
          .executeRun(runId, worker, execSteps, sessionId, request.user.id)
          .catch((err) => {
            app.log.error({ runId, err }, 'AutoLauncher run failed')
          })
      } else {
        app.log.warn({ sessionId, runId }, 'No worker found for session — run created but not started')
      }

      const responseSteps = resolvedSteps.map((s) => ({
        astName: s.astName,
        configId: s.configId,
        order: s.order,
        stepLabel: s.stepLabel,
        configName: s.configName,
      }))

      return { runId, sessionId, steps: responseSteps }
    },
  )

  typed.get(
    '/auto-launcher-runs',
    {
      schema: {
        tags: ['Auto Launchers'],
        querystring: z.object({
          limit: z.coerce.number().default(50),
          offset: z.coerce.number().default(0),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              launcherId: z.string(),
              launcherName: z.string().nullable(),
              status: z.string(),
              steps: z.unknown(),
              currentStepIndex: z.string(),
              createdAt: z.coerce.date(),
              completedAt: z.coerce.date().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return autoLauncherService.findRunsByUser(
        request.user.id,
        request.query.limit,
        request.query.offset,
      )
    },
  )
}
