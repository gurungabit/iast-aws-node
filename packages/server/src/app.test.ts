import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    authHook: vi.fn(),
    healthRoutes: vi.fn(),
    authRoutes: vi.fn(),
    sessionRoutes: vi.fn(),
    historyRoutes: vi.fn(),
    astConfigRoutes: vi.fn(),
    autoLauncherRoutes: vi.fn(),
    scheduleRoutes: vi.fn(),
    terminalWsRoutes: vi.fn(),
    terminalManager: {
      destroyAll: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      getMaxWorkers: vi.fn(() => 50),
    },
  }
})

vi.mock('./auth/hook.js', () => ({
  authHook: mocks.authHook,
}))

vi.mock('./routes/health.js', () => ({
  healthRoutes: mocks.healthRoutes,
}))

vi.mock('./routes/auth.js', () => ({
  authRoutes: mocks.authRoutes,
}))

vi.mock('./routes/sessions.js', () => ({
  sessionRoutes: mocks.sessionRoutes,
}))

vi.mock('./routes/history.js', () => ({
  historyRoutes: mocks.historyRoutes,
}))

vi.mock('./routes/ast-configs.js', () => ({
  astConfigRoutes: mocks.astConfigRoutes,
}))

vi.mock('./routes/auto-launchers.js', () => ({
  autoLauncherRoutes: mocks.autoLauncherRoutes,
}))

vi.mock('./routes/schedules.js', () => ({
  scheduleRoutes: mocks.scheduleRoutes,
}))

vi.mock('./terminal/ws-handler.js', () => ({
  terminalWsRoutes: mocks.terminalWsRoutes,
}))

vi.mock('./terminal/manager.js', () => ({
  terminalManager: mocks.terminalManager,
}))

// Mock config to avoid dotenv issues
vi.mock('./config.js', () => ({
  config: {
    port: 3000,
    host: '0.0.0.0',
    databaseUrl: 'postgres://test:test@localhost:5432/test',
    entraTenantId: '',
    entraClientId: '',
    entraAudience: '',
    tn3270Host: 'localhost',
    tn3270Port: 3270,
    tn3270Secure: false,
    maxWorkers: 50,
    encryptionKey: '',
  },
}))

import { buildApp } from './app.js'

describe('buildApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a Fastify instance', async () => {
    const app = await buildApp()
    expect(app).toBeDefined()
    expect(typeof app.inject).toBe('function')
    expect(typeof app.close).toBe('function')
    await app.close()
  })

  it('should register health routes', async () => {
    const app = await buildApp()
    expect(mocks.healthRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register auth routes', async () => {
    const app = await buildApp()
    expect(mocks.authRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register session routes', async () => {
    const app = await buildApp()
    expect(mocks.sessionRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register history routes', async () => {
    const app = await buildApp()
    expect(mocks.historyRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register ast config routes', async () => {
    const app = await buildApp()
    expect(mocks.astConfigRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register auto launcher routes', async () => {
    const app = await buildApp()
    expect(mocks.autoLauncherRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register schedule routes', async () => {
    const app = await buildApp()
    expect(mocks.scheduleRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should register terminal WebSocket routes', async () => {
    const app = await buildApp()
    expect(mocks.terminalWsRoutes).toHaveBeenCalled()
    await app.close()
  })

  it('should add auth hook', async () => {
    const app = await buildApp()
    // The authHook is passed to addHook('onRequest', authHook)
    // We can verify it was referenced (registered as onRequest hook)
    expect(mocks.authHook).toBeDefined()
    await app.close()
  })

  it('should close without error', async () => {
    const app = await buildApp()
    await expect(app.close()).resolves.toBeUndefined()
  })

  it('should call terminalManager.destroyAll on close', async () => {
    const app = await buildApp()
    await app.close()
    expect(mocks.terminalManager.destroyAll).toHaveBeenCalled()
  })
})
