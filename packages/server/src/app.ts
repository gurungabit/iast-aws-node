import Fastify from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyCors from '@fastify/cors'
import fastifyWebsocket from '@fastify/websocket'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { authHook } from './auth/hook.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/sessions.js'
import { historyRoutes } from './routes/history.js'
import { astConfigRoutes } from './routes/ast-configs.js'
import { autoLauncherRoutes } from './routes/auto-launchers.js'
import { scheduleRoutes } from './routes/schedules.js'
import { terminalWsRoutes } from './terminal/ws-handler.js'
import { terminalManager } from './terminal/manager.js'

export async function buildApp() {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Plugins
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  })
  await app.register(fastifyWebsocket)
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'IAST API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearer: [] }],
    },
  })
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' })

  // Auth hook
  app.addHook('onRequest', authHook)

  // Routes
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(sessionRoutes)
  await app.register(historyRoutes)
  await app.register(astConfigRoutes)
  await app.register(autoLauncherRoutes)
  await app.register(scheduleRoutes)

  // WebSocket terminal routes
  await app.register(terminalWsRoutes)

  // Wire metrics to TerminalManager
  app.addHook('onClose', () => {
    terminalManager.destroyAll()
  })

  return app
}
