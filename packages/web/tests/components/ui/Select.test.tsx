import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from '@src/components/ui/Select'

const options = [
  { value: '01', label: '01 Illinois' },
  { value: '02', label: '02 North Coast' },
  { value: '03', label: '03 Canadian' },
]

describe('Select', () => {
  it('renders with placeholder', () => {
    render(<Select options={options} value="" onChange={() => {}} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('renders selected option label', () => {
    render(<Select options={options} value="02" onChange={() => {}} />)
    expect(screen.getByText('02 North Coast')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<Select options={options} value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.getByText('01 Illinois')).toBeInTheDocument()
    expect(screen.getByText('02 North Coast')).toBeInTheDocument()
    expect(screen.getByText('03 Canadian')).toBeInTheDocument()
  })

  it('calls onChange when an option is selected', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('03 Canadian'))
    expect(onChange).toHaveBeenCalledWith('03')
  })

  it('closes dropdown after selecting an option', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('01 Illinois'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('filters options by search text', () => {
    render(<Select options={options} value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'canadian' } })
    expect(screen.getByText('03 Canadian')).toBeInTheDocument()
    expect(screen.queryByText('01 Illinois')).not.toBeInTheDocument()
    expect(screen.queryByText('02 North Coast')).not.toBeInTheDocument()
  })

  it('shows "No results" when search matches nothing', () => {
    render(<Select options={options} value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'zzz' } })
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('clears value when clear button is clicked', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="01" onChange={onChange} clearable />)
    const buttons = screen.getAllByRole('button')
    // Second role="button" is the clear button (span)
    const clearBtn = buttons.find((b) => b.tagName === 'SPAN')!
    fireEvent.click(clearBtn)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('does not show clear button when clearable is false', () => {
    render(<Select options={options} value="01" onChange={() => {}} clearable={false} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
  })

  it('does not open when disabled', () => {
    render(<Select options={options} value="" onChange={() => {}} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('hides search input when searchable is false', () => {
    render(<Select options={options} value="" onChange={() => {}} searchable={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    // Options should still be visible
    expect(screen.getByText('01 Illinois')).toBeInTheDocument()
  })

  it('selects option with Enter key', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="" onChange={onChange} />)
    const trigger = screen.getByRole('button')
    // Open with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const input = screen.getByPlaceholderText('Search...')
    // First option is highlighted by default, press Enter
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('01')
  })

  it('navigates options with arrow keys', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    const input = screen.getByPlaceholderText('Search...')
    // Move down to second option
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('02')
  })

  it('closes dropdown with Escape key', () => {
    render(<Select options={options} value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <Select options={options} value="" onChange={() => {}} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('highlights the currently selected option', () => {
    render(<Select options={options} value="02" onChange={() => {}} clearable={false} />)
    fireEvent.click(screen.getByRole('button'))
    // The option in the dropdown list (not the trigger label)
    const listItems = screen.getAllByText('02 North Coast')
    const dropdownItem = listItems.find((el) => el.tagName === 'BUTTON')!
    expect(dropdownItem.className).toContain('bg-blue')
  })

  it('wraps around when arrowing past last option', () => {
    const onChange = vi.fn()
    render(<Select options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    const input = screen.getByPlaceholderText('Search...')
    // Arrow down 3 times to wrap to first
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('01')
  })
})
