export interface ServerConfig {
  port: number
  host: string
  databaseUrl: string
  entraTenantId: string
  entraClientId: string
  entraAudience: string
  maxWorkers: number
  encryptionKey: string
  awsRegion?: string
  eventBridgeRoleArn?: string
  scheduleTargetArn?: string
  secretsPrefix?: string
}

export interface ClientConfig {
  apiUrl: string
  wsUrl: string
  msalClientId: string
  msalTenantId: string
  msalRedirectUri: string
  msalApiScope: string
}
