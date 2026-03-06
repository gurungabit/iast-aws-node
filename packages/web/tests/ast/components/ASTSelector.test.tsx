import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockUseASTRegistry = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    searchResults: [
      { id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire', enabled: true, visible: true, keywords: [], component: () => null },
      { id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto', enabled: true, visible: true, keywords: [], component: () => null },
    ],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    getAST: vi.fn((id: string) => {
      if (id === 'login') return { id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire', enabled: true, visible: true, keywords: [], component: () => null }
      if (id === 'bi_renew') return { id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto', enabled: true, visible: true, keywords: [], component: () => null }
      return undefined
    }),
    groupedASTs: {
      auto: [{ id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto', enabled: true, visible: true, keywords: [], component: () => null }],
      fire: [{ id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire', enabled: true, visible: true, keywords: [], component: () => null }],
    },
  }),
)

vi.mock('@src/ast/registry', () => ({
  useASTRegistry: mockUseASTRegistry,
  CATEGORY_AUTH_GROUP: { auto: '@OOAUTO', fire: '@OOFIRE' },
}))

vi.mock('@src/ast/registry/types', () => ({
  CATEGORY_INFO: {
    auto: { id: 'auto', name: 'Auto', description: 'Auto insurance' },
    fire: { id: 'fire', name: 'Fire', description: 'Fire insurance' },
  },
}))

import { ASTSelector } from '@src/ast/components/ASTSelector'

describe('ASTSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseASTRegistry.mockReturnValue({
      searchResults: [
        { id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire', enabled: true, visible: true, keywords: [], component: () => null },
        { id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto', enabled: true, visible: true, keywords: [], component: () => null },
      ],
      searchQuery: '',
      setSearchQuery: vi.fn(),
      getAST: vi.fn((id: string) => {
        if (id === 'login') return { id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire' }
        if (id === 'bi_renew') return { id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto' }
        return undefined
      }),
      groupedASTs: {
        auto: [{ id: 'bi_renew', name: 'BI Renew', description: 'BI Renewal', category: 'auto', enabled: true, visible: true, keywords: [] }],
        fire: [{ id: 'login', name: 'TSO Login', description: 'TSO Login', category: 'fire', enabled: true, visible: true, keywords: [] }],
      },
    })
  })

  it('renders trigger button with placeholder', () => {
    render(<ASTSelector value={null} onChange={vi.fn()} />)
    expect(screen.getByText('Select Automation')).toBeDefined()
  })

  it('renders custom placeholder', () => {
    render(<ASTSelector value={null} onChange={vi.fn()} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeDefined()
  })

  it('shows dropdown with search when clicked', () => {
    render(<ASTSelector value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select Automation'))
    expect(screen.getByPlaceholderText('Search...')).toBeDefined()
  })

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn()
    render(<ASTSelector value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('Select Automation'))
    // Options should be visible since searchResults are populated
    // Use getAllByText since grouped view may show name in multiple places
    const loginOptions = screen.getAllByText('TSO Login')
    fireEvent.click(loginOptions[0])
    expect(onChange).toHaveBeenCalledWith('login')
  })

  it('shows selected AST name in trigger', () => {
    render(<ASTSelector value="login" onChange={vi.fn()} />)
    expect(screen.getByText('TSO Login')).toBeDefined()
  })

  it('respects disabled prop', () => {
    render(<ASTSelector value={null} onChange={vi.fn()} disabled />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })
})
