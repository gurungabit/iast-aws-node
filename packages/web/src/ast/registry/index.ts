import type { ComponentType } from 'react'

export interface ASTRegistryEntry {
  name: string
  label: string
  description: string
  FormComponent: ComponentType<ASTFormProps>
}

export interface ASTFormProps {
  sessionId: string
  onRun: (params: Record<string, unknown>) => void
  disabled?: boolean
}

const registry = new Map<string, ASTRegistryEntry>()

export function registerAST(entry: ASTRegistryEntry) {
  registry.set(entry.name, entry)
}

export function getAST(name: string): ASTRegistryEntry | undefined {
  return registry.get(name)
}

export function getAllASTs(): ASTRegistryEntry[] {
  return Array.from(registry.values())
}
