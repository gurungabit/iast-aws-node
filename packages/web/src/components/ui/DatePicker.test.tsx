import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from './DatePicker'

function getRecentDate(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

describe('DatePicker', () => {
  it('renders with a label', () => {
    render(<DatePicker label="Start Date" />)
    expect(screen.getByText('Start Date')).toBeInTheDocument()
  })

  it('renders without a label', () => {
    const { container } = render(<DatePicker />)
    expect(container.querySelector('label')).toBeNull()
  })

  it('displays formatted date in the trigger button', () => {
    const date = getRecentDate(2)
    render(<DatePicker value={date} />)
    expect(screen.getByText(formatDisplay(date))).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<DatePicker error="Date is required" />)
    expect(screen.getByText('Date is required')).toBeInTheDocument()
  })

  it('shows hint when no error is present', () => {
    render(<DatePicker hint="Select a valid date" />)
    expect(screen.getByText('Select a valid date')).toBeInTheDocument()
  })

  it('hides hint when error is present', () => {
    render(<DatePicker hint="Hint text" error="Error text" />)
    expect(screen.getByText('Error text')).toBeInTheDocument()
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
  })

  it('opens calendar dropdown on click', () => {
    const date = getRecentDate(2)
    const [y, m] = date.split('-').map(Number)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    render(<DatePicker value={date} />)
    fireEvent.click(screen.getByText(formatDisplay(date)))
    expect(screen.getByText(`${monthNames[m - 1]} ${y}`)).toBeInTheDocument()
  })

  it('supports disabled state', () => {
    render(<DatePicker label="Date" disabled />)
    const button = screen.getByRole('button', { name: 'Date' })
    expect(button).toBeDisabled()
  })

  it('calls onChange when a day is selected', () => {
    const onChange = vi.fn()
    // Use today's date with allowFuture so we can click a nearby day
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const todayStr = `${y}-${m}-${String(today.getDate()).padStart(2, '0')}`

    render(<DatePicker value={todayStr} onChange={onChange} allowFuture />)

    // Open calendar
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    // Click day 1 (always exists and within range)
    fireEvent.click(screen.getByText('1'))

    expect(onChange).toHaveBeenCalledWith(`${y}-${m}-01`)
  })

  it('closes calendar after selecting a day', () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const todayStr = `${y}-${m}-${String(today.getDate()).padStart(2, '0')}`
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]

    render(<DatePicker value={todayStr} onChange={vi.fn()} allowFuture />)

    fireEvent.click(screen.getByText(formatDisplay(todayStr)))
    expect(screen.getByText(`${monthNames[today.getMonth()]} ${y}`)).toBeInTheDocument()

    fireEvent.click(screen.getByText('1'))
    expect(screen.queryByText(`${monthNames[today.getMonth()]} ${y}`)).not.toBeInTheDocument()
  })

  it('navigates to next month', () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()
    const todayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const nextMonth = m === 11 ? 0 : m + 1
    const nextYear = m === 11 ? y + 1 : y

    render(<DatePicker value={todayStr} allowFuture />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Next month'))
    expect(screen.getByText(`${monthNames[nextMonth]} ${nextYear}`)).toBeInTheDocument()
  })

  it('navigates to previous month', () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()
    const todayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const prevMonth = m === 0 ? 11 : m - 1
    const prevYear = m === 0 ? y - 1 : y

    render(<DatePicker value={todayStr} maxDaysBack={60} />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Previous month'))
    expect(screen.getByText(`${monthNames[prevMonth]} ${prevYear}`)).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    const date = getRecentDate(2)
    const [y, m] = date.split('-').map(Number)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]

    render(<DatePicker value={date} />)
    fireEvent.click(screen.getByText(formatDisplay(date)))
    expect(screen.getByText(`${monthNames[m - 1]} ${y}`)).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(`${monthNames[m - 1]} ${y}`)).not.toBeInTheDocument()
  })

  it('shows day headers', () => {
    const date = getRecentDate(2)
    render(<DatePicker value={date} />)
    fireEvent.click(screen.getByText(formatDisplay(date)))

    expect(screen.getByText('Su')).toBeInTheDocument()
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.getByText('Fr')).toBeInTheDocument()
  })

  it('passes custom className', () => {
    const { container } = render(<DatePicker className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('has no lower bound when maxDaysBack is not set', () => {
    // A date far in the past should be selectable
    render(<DatePicker value="2020-01-15" />)
    fireEvent.click(screen.getByText(formatDisplay('2020-01-15')))
    expect(screen.getByText('January 2020')).toBeInTheDocument()
    // Day 1 should not be disabled
    const day1 = screen.getByText('1')
    expect(day1).not.toBeDisabled()
  })

  it('opens month picker when clicking month/year header', () => {
    const date = getRecentDate(2)
    render(<DatePicker value={date} />)
    fireEvent.click(screen.getByText(formatDisplay(date)))

    fireEvent.click(screen.getByLabelText('Select month and year'))

    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Dec')).toBeInTheDocument()
  })

  it('selects a month from month picker and returns to day view', () => {
    const today = new Date()
    const y = today.getFullYear()
    const todayStr = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    render(<DatePicker value={todayStr} allowFuture />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Select month and year'))
    fireEvent.click(screen.getByText('Jun'))

    expect(screen.getByText(`June ${y}`)).toBeInTheDocument()
    expect(screen.getByText('Su')).toBeInTheDocument()
  })

  it('opens year picker from month view', () => {
    const today = new Date()
    const y = today.getFullYear()
    const todayStr = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    render(<DatePicker value={todayStr} allowFuture />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Select month and year'))
    fireEvent.click(screen.getByLabelText('Select year'))

    expect(screen.getByText(String(y))).toBeInTheDocument()
  })

  it('selects a year and returns to month view', () => {
    const today = new Date()
    const y = today.getFullYear()
    const todayStr = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    render(<DatePicker value={todayStr} allowFuture />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Select month and year'))
    fireEvent.click(screen.getByLabelText('Select year'))

    // Click a year in the grid
    const targetYear = y - 2
    fireEvent.click(screen.getByText(String(targetYear)))

    // Should be back in month view showing the selected year
    expect(screen.getByText(String(targetYear))).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
  })

  it('navigates year range in year picker', () => {
    const today = new Date()
    const y = today.getFullYear()
    const todayStr = `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    render(<DatePicker value={todayStr} allowFuture />)
    fireEvent.click(screen.getByText(formatDisplay(todayStr)))

    fireEvent.click(screen.getByLabelText('Select month and year'))
    fireEvent.click(screen.getByLabelText('Select year'))

    fireEvent.click(screen.getByLabelText('Previous years'))
    // Should show earlier years
    expect(screen.getByText(String(y - 16))).toBeInTheDocument()
  })
})
