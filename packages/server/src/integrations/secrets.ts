import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({})

export async function getSecret(secretId: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretId })
  const response = await client.send(command)
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`)
  }
  return response.SecretString
}

export async function putSecret(secretId: string, value: string): Promise<void> {
  const command = new PutSecretValueCommand({
    SecretId: secretId,
    SecretString: value,
  })
  await client.send(command)
}
