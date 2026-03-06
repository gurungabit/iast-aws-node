import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://iast:iast_dev@localhost:5432/iast'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  ENTRA_TENANT_ID: z.string().default(''),
  ENTRA_CLIENT_ID: z.string().default(''),
  ENTRA_AUDIENCE: z.string().default(''),

  MAX_WORKERS: z.coerce.number().default(50),
  ENCRYPTION_KEY: z.string().default(''),

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
  maxWorkers: parsed.MAX_WORKERS,
  encryptionKey: parsed.ENCRYPTION_KEY,
  awsRegion: parsed.AWS_REGION,
  eventBridgeRoleArn: parsed.EVENTBRIDGE_ROLE_ARN,
  scheduleTargetArn: parsed.SCHEDULE_TARGET_ARN,
  secretsPrefix: parsed.SECRETS_PREFIX,
} as const
