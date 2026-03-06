import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

describe('DateTimePicker', () => {
  let mockOnChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnChange = vi.fn()
  })

  it('renders date, time, and timezone labels', () => {
    render(<DateTimePicker value={null} onChange={mockOnChange} />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Timezone')).toBeInTheDocument()
  })

  it('renders time input and timezone select', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    const timeInput = container.querySelector('input[type="time"]')
    const select = container.querySelector('select')
    expect(timeInput).toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })

  it('renders custom DatePicker for date selection', () => {
    render(<DateTimePicker value={null} onChange={mockOnChange} />)
    // DatePicker renders a button with label "Date"
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument()
  })

  it('timezone dropdown shows all 6 options', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    const select = container.querySelector('select')!
    const options = select.querySelectorAll('option')
    expect(options).toHaveLength(6)
  })

  it('timezone dropdown contains expected timezone labels', () => {
    render(<DateTimePicker value={null} onChange={mockOnChange} />)
    expect(screen.getByText('Eastern (ET)')).toBeInTheDocument()
    expect(screen.getByText('Central (CT)')).toBeInTheDocument()
    expect(screen.getByText('Mountain (MT)')).toBeInTheDocument()
    expect(screen.getByText('Pacific (PT)')).toBeInTheDocument()
    expect(screen.getByText('Arizona (MST)')).toBeInTheDocument()
    expect(screen.getByText('UTC')).toBeInTheDocument()
  })

  it('sets default time to 09:00 when value is null', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
    expect(timeInput.value).toBe('09:00')
  })

  it('parses existing value time correctly', () => {
    const isoValue = '2025-06-15T14:30:00.000Z'
    const { container } = render(<DateTimePicker value={isoValue} onChange={mockOnChange} />)
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
    const parsed = new Date(isoValue)
    expect(timeInput.value).toBe(parsed.toTimeString().slice(0, 5))
  })

  it('calls onChange when time is changed', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    mockOnChange.mockClear()
    const timeInput = container.querySelector('input[type="time"]')!
    fireEvent.change(timeInput, { target: { value: '15:45' } })
    expect(mockOnChange).toHaveBeenCalled()
  })

  it('calls onChange when timezone is changed', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    mockOnChange.mockClear()
    const select = container.querySelector('select')!
    fireEvent.change(select, { target: { value: 'UTC' } })
    expect(mockOnChange).toHaveBeenCalled()
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
    expect(lastCall[1]).toBe('UTC')
  })

  it('applies custom className', () => {
    const { container } = render(
      <DateTimePicker value={null} onChange={mockOnChange} className="my-custom-class" />,
    )
    expect(container.firstElementChild!.className).toContain('my-custom-class')
  })

  it('onChange receives an ISO string', () => {
    render(<DateTimePicker value={null} onChange={mockOnChange} />)
    // onChange is called on mount due to useEffect
    expect(mockOnChange).toHaveBeenCalled()
    const isoStr = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
    expect(isoStr).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('renders a select element for timezone', () => {
    const { container } = render(<DateTimePicker value={null} onChange={mockOnChange} />)
    const selects = container.querySelectorAll('select')
    expect(selects).toHaveLength(1)
  })
})
