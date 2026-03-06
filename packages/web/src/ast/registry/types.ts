import type { ComponentType } from 'react'

export type ASTCategory = 'auto' | 'fire'

export const CATEGORY_AUTH_GROUP: Record<ASTCategory, string> = {
  auto: '@OOAUTO',
  fire: '@OOFIRE',
}

export interface ASTConfig {
  id: string
  name: string
  description: string
  category: ASTCategory
  enabled: boolean
  visible: boolean
  keywords: string[]
  version?: string
  author?: string
  supportsParallel?: boolean
  component: ComponentType
}

export interface CategoryInfo {
  id: ASTCategory
  name: string
  description: string
}

export const CATEGORY_INFO: Record<ASTCategory, CategoryInfo> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    description: 'Auto insurance automation scripts',
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    description: 'Fire/property insurance automation scripts',
  },
}
