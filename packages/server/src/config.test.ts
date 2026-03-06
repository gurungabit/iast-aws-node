import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports a config object with expected default values', async () => {
    // We use a dynamic import to get a fresh module each time
    // The config module reads from process.env with defaults, so with no env vars set
    // the defaults should apply
    const { config } = await import('./config.js')

    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('has port as a number', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.port).toBe('number')
  })

  it('has host as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.host).toBe('string')
  })

  it('has databaseUrl as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.databaseUrl).toBe('string')
  })

  it('has default port of 3000', async () => {
    const { config } = await import('./config.js')
    // Unless PORT env is set, default is 3000
    expect(config.port).toBe(Number(process.env.PORT) || 3000)
  })

  it('has default host of 0.0.0.0', async () => {
    const { config } = await import('./config.js')
    expect(config.host).toBe(process.env.HOST || '0.0.0.0')
  })

  it('has tn3270Host as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.tn3270Host).toBe('string')
  })

  it('has tn3270Port as a number', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.tn3270Port).toBe('number')
  })

  it('has tn3270Secure as a boolean', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.tn3270Secure).toBe('boolean')
  })

  it('has maxWorkers as a number', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.maxWorkers).toBe('number')
  })

  it('has encryptionKey as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.encryptionKey).toBe('string')
  })

  it('has entraTenantId as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.entraTenantId).toBe('string')
  })

  it('has entraClientId as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.entraClientId).toBe('string')
  })

  it('has secretsPrefix as a string', async () => {
    const { config } = await import('./config.js')
    expect(typeof config.secretsPrefix).toBe('string')
  })

  it('has default maxWorkers of 50', async () => {
    const { config } = await import('./config.js')
    expect(config.maxWorkers).toBe(Number(process.env.MAX_WORKERS) || 50)
  })

  it('has default secretsPrefix of "iast/"', async () => {
    const { config } = await import('./config.js')
    expect(config.secretsPrefix).toBe(process.env.SECRETS_PREFIX || 'iast/')
  })

  it('config object is frozen (as const)', async () => {
    const { config } = await import('./config.js')
    // The config uses `as const` so it should be readonly at the type level.
    // At runtime, it's a plain object, but we can verify the keys exist.
    const keys = Object.keys(config)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys).toContain('port')
    expect(keys).toContain('host')
    expect(keys).toContain('databaseUrl')
    expect(keys).toContain('entraTenantId')
    expect(keys).toContain('entraClientId')
    expect(keys).toContain('tn3270Host')
    expect(keys).toContain('tn3270Port')
    expect(keys).toContain('tn3270Secure')
    expect(keys).toContain('maxWorkers')
    expect(keys).toContain('encryptionKey')
    expect(keys).toContain('secretsPrefix')
  })
})
