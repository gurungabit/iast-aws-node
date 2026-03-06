import type { ReactNode } from 'react'
import { ASTEventBridge } from './ASTEventBridge'

export function ASTProvider({ children }: { children: ReactNode }) {
  return <ASTEventBridge>{children}</ASTEventBridge>
}
