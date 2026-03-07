import { useRef, useMemo, useState } from 'react'
import {
  Search,
  Download,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { apiPost } from '../../services/api'
import { cn } from '../../utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataInquiryModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ServerRow {
  id: string
  policyNumber: string
  executionDate: string
  data: Record<string, unknown> | null
}

interface FilterEntry {
  id: string
  field: string
  op: 'eq' | 'neq' | 'contains' | 'starts_with'
  value: string
}

interface SortEntry {
  column: string
  direction: 'asc' | 'desc'
}

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'select'
  options?: { value: string; label: string }[]
}

interface ColDef {
  key: string
  label: string
  minW: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFICE_OPTIONS = [
  { value: '01', label: '01 Illinois' },
  { value: '02', label: '02 North Coast' },
  { value: '03', label: '03 Canadian' },
  { value: '04', label: '04 Michigan' },
  { value: '05', label: '05 North Central' },
  { value: '06', label: '06 West Central' },
  { value: '07', label: '07 Eastern' },
  { value: '08', label: '08 North Texas' },
  { value: '09', label: '09 Alabama-Mississippi' },
  { value: '11', label: '11 South Central' },
  { value: '12', label: '12 Greater California' },
  { value: '13', label: '13 Pennsylvania' },
  { value: '14', label: '14 Missouri' },
  { value: '15', label: '15 Pacific Northwest' },
  { value: '16', label: '16 Ohio' },
  { value: '17', label: '17 Northeastern' },
  { value: '18', label: '18 Indiana' },
  { value: '19', label: '19 Florida' },
  { value: '20', label: '20 Mountain States' },
  { value: '21', label: '21 Seaboard' },
  { value: '22', label: '22 Mid-South' },
  { value: '23', label: '23 South Coast' },
  { value: '24', label: '24 Sunland' },
  { value: '25', label: '25 South Texas' },
  { value: '26', label: '26 Oklahoma-Kansas' },
  { value: '27', label: '27 Georgia-SC' },
  { value: '28', label: '28 North Atlantic' },
]

const ITEM_TYPE_OPTIONS = [
  { value: 'ECHOPT', label: 'ECHOPT' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'GFU', label: 'GFU' },
  { value: 'INTPT', label: 'INTPT' },
  { value: 'MPPPT', label: 'MPPPT' },
  { value: 'MVR', label: 'MVR' },
  { value: 'PLUA', label: 'PLUA' },
  { value: 'QUOTE', label: 'QUOTE' },
  { value: 'STS', label: 'STS' },
]

const SECTION_OPTIONS = [
  { value: 'ROUTED ITEMS', label: 'ROUTED ITEMS' },
  { value: 'ECHO POLICY TRANSACTIONS', label: 'ECHO POLICY TRANSACTIONS' },
  { value: 'ERROR MEMOS', label: 'ERROR MEMOS' },
  { value: 'GENERAL FOLLOW UP MEMOS', label: 'GENERAL FOLLOW UP MEMOS' },
  { value: 'INTERNET POLICY TRANSACTIONS', label: 'INTERNET POLICY TRANSACTIONS' },
  { value: 'MONTHLY PAYMENT POLICY TRANSACTIONS', label: 'MONTHLY PAYMENT POLICY TRANSACTIONS' },
  { value: 'MOTOR VEHICLE REPORTS', label: 'MOTOR VEHICLE REPORTS' },
  { value: 'PLUP ACTIVITY MESSAGES', label: 'PLUP ACTIVITY MESSAGES' },
  { value: 'QUOTE RESULTS', label: 'QUOTE RESULTS' },
  { value: 'STATE TO STATE TRANSFERS', label: 'STATE TO STATE TRANSFERS' },
]

const STATUS_OPTIONS = [
  { value: 'A', label: 'A - ACTIVE' },
  { value: 'C', label: 'C - CARED' },
  { value: 'D', label: 'D - DONE' },
  { value: 'E', label: 'E - SEND' },
  { value: 'P', label: 'P - PEND' },
  { value: 'W', label: 'W - WORK' },
]

const SERV_UNDR_OPTIONS = [
  { value: 'S', label: 'S - SER' },
  { value: 'U', label: 'U - UND' },
]

const TEXT_OPS = [
  { value: 'contains', label: 'contains' },
  { value: 'eq', label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'neq', label: 'not equal' },
] as const

const FILTER_FIELDS: FieldDef[] = [
  { key: 'officeNum', label: 'Office', type: 'select', options: OFFICE_OPTIONS },
  { key: 'policyNumber', label: 'Policy Number', type: 'text' },
  { key: 'policyItem', label: 'Item Type', type: 'select', options: ITEM_TYPE_OPTIONS },
  { key: 'sectionOfRout', label: 'Section', type: 'select', options: SECTION_OPTIONS },
  { key: 'policyType', label: 'Policy Type', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'gfuDate', label: 'GFU Date', type: 'text' },
  { key: 'gfuCode', label: 'GFU Code', type: 'text' },
  { key: 'agentNafo', label: 'Agent/AFO', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: '_anyError', label: 'Error Code (any)', type: 'text' },
  { key: 'flmpCode', label: 'FLMP', type: 'text' },
  { key: 'queueName', label: 'Queue', type: 'text' },
  { key: 'queueDetail', label: 'Queue Detail', type: 'text' },
  { key: 'servOrUndr', label: 'Serv/Undr', type: 'select', options: SERV_UNDR_OPTIONS },
  { key: 'systemPolicyType', label: 'Policy Code', type: 'text' },
]

const TABLE_COLUMNS: ColDef[] = [
  { key: 'officeNum', label: 'Office', minW: 55 },
  { key: 'policyNumber', label: 'Policy', minW: 105 },
  { key: 'policyItem', label: 'Item', minW: 55 },
  { key: 'sectionOfRout', label: 'Section', minW: 115 },
  { key: 'policyType', label: 'Pol Type', minW: 62 },
  { key: 'status', label: 'Status', minW: 48 },
  { key: 'gfuDate', label: 'Date', minW: 75 },
  { key: 'gfuCode', label: 'GFU', minW: 46 },
  { key: 'agentNafo', label: 'Agent', minW: 62 },
  { key: 'description', label: 'Description', minW: 150 },
  { key: 'errorCode1', label: 'Err 1', minW: 50 },
  { key: 'errorCode2', label: 'Err 2', minW: 50 },
  { key: 'errorCode3', label: 'Err 3', minW: 50 },
  { key: 'errorCode4', label: 'Err 4', minW: 50 },
  { key: 'errorCode5', label: 'Err 5', minW: 50 },
  { key: 'errorCode6', label: 'Err 6', minW: 50 },
  { key: 'errorCode7', label: 'Err 7', minW: 50 },
  { key: 'errorCode8', label: 'Err 8', minW: 50 },
  { key: 'flmpCode', label: 'FLMP', minW: 50 },
  { key: 'queueName', label: 'Queue', minW: 70 },
  { key: 'queueDetail', label: 'Q Detail', minW: 70 },
  { key: 'servOrUndr', label: 'S/U', minW: 36 },
  { key: 'systemPolicyType', label: 'Pol Code', minW: 58 },
  { key: 'systemFormLine', label: 'Form', minW: 42 },
]

const PAGE_SIZE_OPTIONS = [100, 250, 500, 1000]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

function daysAgoStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0] ?? ''
}

function cellValue(data: Record<string, unknown> | null, key: string): string {
  if (!data) return ''
  const v = data[key]
  if (v == null) return ''
  return String(v)
}

function exportCsv(rows: ServerRow[]): void {
  const headers = TABLE_COLUMNS.map((c) => c.label)
  const csvRows = [headers.join(',')]
  for (const row of rows) {
    const values = TABLE_COLUMNS.map((col) => {
      const val = cellValue(row.data, col.key)
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    })
    csvRows.push(values.join(','))
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `data-inquiry-${todayStr()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

const selectCls =
  'w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataInquiryModal({ isOpen, onClose }: DataInquiryModalProps): React.ReactNode {
  const filterIdRef = useRef(0)
  const fieldMap = useMemo(() => new Map(FILTER_FIELDS.map((f) => [f.key, f])), [])

  // Date range
  const [dateFrom, setDateFrom] = useState(daysAgoStr(7))
  const [dateTo, setDateTo] = useState(todayStr())

  // Filters
  const [filters, setFilters] = useState<FilterEntry[]>([])

  // Sort
  const [sorts, setSorts] = useState<SortEntry[]>([])

  // Data
  const [rows, setRows] = useState<ServerRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(500)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ----------------------------
  // Search
  // ----------------------------
  async function doSearch(offset: number, sortOverride?: SortEntry[]) {
    setLoading(true)
    setError('')
    try {
      const result = await apiPost<{ rows: ServerRow[]; total: number }>('/data-inquiry', {
        astName: 'rout_extractor',
        dateFrom,
        dateTo,
        filters: filters
          .filter((f) => f.value.trim() !== '')
          .map((f) => ({ field: f.field, op: f.op, value: f.value })),
        sort: sortOverride ?? sorts,
        limit: pageSize,
        offset,
      })
      setRows(result.rows)
      setTotal(result.total)
      setPage(Math.floor(offset / pageSize))
      setHasSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    void doSearch(0)
  }

  function handlePageChange(newPage: number) {
    void doSearch(newPage * pageSize)
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setPage(0)
    if (hasSearched) {
      void doSearch(0)
    }
  }

  // ----------------------------
  // Filters
  // ----------------------------
  function addFilter() {
    filterIdRef.current++
    setFilters((prev) => [
      ...prev,
      {
        id: String(filterIdRef.current),
        field: FILTER_FIELDS[0].key,
        op: FILTER_FIELDS[0].type === 'select' ? 'eq' : 'contains',
        value: '',
      },
    ])
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  function updateFilterField(id: string, newField: string) {
    const def = fieldMap.get(newField)
    setFilters((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              field: newField,
              op: (def?.type === 'select' ? 'eq' : 'contains') as FilterEntry['op'],
              value: '',
            }
          : f,
      ),
    )
  }

  function updateFilterOp(id: string, op: FilterEntry['op']) {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, op } : f)))
  }

  function updateFilterValue(id: string, value: string) {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)))
  }

  function clearAll() {
    setFilters([])
    setSorts([])
    setRows([])
    setTotal(0)
    setHasSearched(false)
    setError('')
    setPage(0)
  }

  // ----------------------------
  // Sort
  // ----------------------------
  function handleSort(column: string, shiftKey: boolean) {
    let newSorts: SortEntry[]
    const existing = sorts.findIndex((s) => s.column === column)

    if (existing >= 0) {
      const current = sorts[existing]
      if (current.direction === 'asc') {
        newSorts = sorts.map((s, i) => (i === existing ? { ...s, direction: 'desc' as const } : s))
      } else {
        newSorts = sorts.filter((_, i) => i !== existing)
      }
    } else if (shiftKey) {
      newSorts = [...sorts, { column, direction: 'asc' as const }]
    } else {
      newSorts = [{ column, direction: 'asc' as const }]
    }

    setSorts(newSorts)
    if (hasSearched) {
      void doSearch(0, newSorts)
    }
  }

  // ----------------------------
  // Render helpers
  // ----------------------------
  function renderSortIndicator(column: string) {
    const idx = sorts.findIndex((s) => s.column === column)
    if (idx < 0) {
      return <ArrowUpDown className="h-3 w-3 opacity-30 flex-shrink-0" />
    }
    const dir = sorts[idx].direction
    return (
      <span className="inline-flex items-center gap-px text-blue-600 dark:text-blue-400 flex-shrink-0">
        {sorts.length > 1 && (
          <span className="text-[9px] font-bold leading-none">{String(idx + 1)}</span>
        )}
        {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      </span>
    )
  }

  // ----------------------------
  // Footer
  // ----------------------------
  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min((page + 1) * pageSize, total)
  const recordInfo =
    total === 0
      ? hasSearched
        ? 'No results'
        : ''
      : `${String(rangeStart)}-${String(rangeEnd)} of ${total.toLocaleString()}`

  const footer = (
    <>
      <span className="text-sm text-gray-500 dark:text-zinc-400 mr-auto font-medium tabular-nums">
        {recordInfo}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<Download className="h-3.5 w-3.5" />}
        onClick={() => exportCsv(rows)}
        disabled={rows.length === 0}
      >
        Export CSV
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
    </>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Inquiry" size="full" footer={footer}>
      <div className="space-y-4">
        {/* Date range + search controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className={cn(inputCls, 'w-36')}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              max={todayStr()}
              className={cn(inputCls, 'w-36')}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={
              loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )
            }
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<X className="h-3.5 w-3.5" />}
            onClick={clearAll}
          >
            Clear All
          </Button>
        </div>

        {/* Filter builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Filters
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={addFilter}
            >
              Add Filter
            </Button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 italic">
              No filters applied. Click &quot;Add Filter&quot; to narrow results.
            </p>
          )}

          {filters.map((filter) => {
            const def = fieldMap.get(filter.field)
            const isSelect = def?.type === 'select'
            return (
              <div key={filter.id} className="flex items-center gap-2">
                {/* Field */}
                <select
                  value={filter.field}
                  onChange={(e) => updateFilterField(filter.id, e.target.value)}
                  className={cn(selectCls, 'w-40 flex-shrink-0')}
                >
                  {FILTER_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>

                {/* Operator (text fields only) */}
                {!isSelect && (
                  <select
                    value={filter.op}
                    onChange={(e) => updateFilterOp(filter.id, e.target.value as FilterEntry['op'])}
                    className={cn(selectCls, 'w-28 flex-shrink-0')}
                  >
                    {TEXT_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}

                {/* Value */}
                {isSelect ? (
                  <select
                    value={filter.value}
                    onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                    className={cn(selectCls, 'flex-1 min-w-0')}
                  >
                    <option value="">(any)</option>
                    {def.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch()
                    }}
                    placeholder="Value..."
                    className={cn(inputCls, 'flex-1 min-w-0')}
                  />
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.id)}
                  className="p-1 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 cursor-pointer rounded transition-colors"
                  title="Remove filter"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Hint for sort */}
        {hasSearched && rows.length > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Click column headers to sort. Shift+Click to add multi-column sort.
          </p>
        )}

        {/* Results table */}
        {hasSearched && rows.length > 0 && (
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[48vh]">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                    {TABLE_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-2 py-2.5 whitespace-nowrap"
                        style={{ minWidth: col.minW }}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleSort(col.key, e.shiftKey)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-zinc-200 transition-colors select-none"
                        >
                          <span>{col.label}</span>
                          {renderSortIndicator(col.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'transition-colors',
                        idx % 2 === 0
                          ? 'bg-white dark:bg-zinc-900'
                          : 'bg-gray-50/60 dark:bg-zinc-800/25',
                        'hover:bg-blue-50/70 dark:hover:bg-blue-900/15',
                      )}
                    >
                      {TABLE_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className="px-2 py-1.5 text-xs text-gray-700 dark:text-zinc-300 whitespace-nowrap truncate max-w-[200px]"
                          style={{ minWidth: col.minW }}
                          title={cellValue(row.data, col.key)}
                        >
                          {cellValue(row.data, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {hasSearched && total > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-zinc-400">Per page:</span>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handlePageSizeChange(size)}
                  className={cn(
                    'px-2 py-0.5 text-xs rounded cursor-pointer transition-colors',
                    pageSize === size
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800',
                  )}
                >
                  {String(size)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0 || loading}
                className="px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600 dark:text-zinc-400 tabular-nums">
                Page {String(page + 1)} of {String(totalPages)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && !hasSearched && (
          <div className="text-center py-16">
            <Search className="h-8 w-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Select a date range and click Search to query policy data.
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Add filters to narrow results by office, policy, section, and more.
            </p>
          </div>
        )}

        {!loading && hasSearched && rows.length === 0 && !error && (
          <div className="text-center py-16">
            <Search className="h-8 w-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              No policies found matching the current criteria.
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Try adjusting the date range or removing some filters.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
