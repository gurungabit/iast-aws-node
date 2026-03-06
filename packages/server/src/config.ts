import { z } from 'zod'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://iast:iast_dev@localhost:5432/iast'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  ENTRA_TENANT_ID: z.string().default(''),
  ENTRA_CLIENT_ID: z.string().default(''),
  ENTRA_AUDIENCE: z.string().default(''),

  TN3270_HOST: z.string().default('localhost'),
  TN3270_PORT: z.coerce.number().default(3270),
  TN3270_SECURE: z.string().default('true'),

  MAX_WORKERS: z.coerce.number().default(50),
  WORKER_IDLE_TIMEOUT_MS: z.coerce.number().default(30 * 60 * 1000),
  ENCRYPTION_KEY: z.string().default(''),

  POD_IP: z.string().default('127.0.0.1'),
  HEADLESS_SERVICE_HOST: z.string().default(''),

  AWS_REGION: z.string().optional(),
  EVENTBRIDGE_ROLE_ARN: z.string().optional(),
  SCHEDULE_TARGET_ARN: z.string().optional(),
  SECRETS_PREFIX: z.string().default('iast/'),
})

const parsed = envSchema.parse(process.env)

export const config = {
  port: parsed.PORT,
  host: parsed.HOST,
  databaseUrl: parsed.DATABASE_URL,
  entraTenantId: parsed.ENTRA_TENANT_ID,
  entraClientId: parsed.ENTRA_CLIENT_ID,
  entraAudience: parsed.ENTRA_AUDIENCE,
  tn3270Host: parsed.TN3270_HOST,
  tn3270Port: parsed.TN3270_PORT,
  tn3270Secure: parsed.TN3270_SECURE.toLowerCase() === 'true',
  maxWorkers: parsed.MAX_WORKERS,
  workerIdleTimeoutMs: parsed.WORKER_IDLE_TIMEOUT_MS,
  encryptionKey: parsed.ENCRYPTION_KEY,
  podIp: parsed.POD_IP,
  headlessServiceHost: parsed.HEADLESS_SERVICE_HOST,
  awsRegion: parsed.AWS_REGION,
  eventBridgeRoleArn: parsed.EVENTBRIDGE_ROLE_ARN,
  scheduleTargetArn: parsed.SCHEDULE_TARGET_ARN,
  secretsPrefix: parsed.SECRETS_PREFIX,
} as const
