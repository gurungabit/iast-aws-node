import { useMemo, useState } from 'react'
import {
  Search,
  Download,
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
import { DatePicker } from '../../components/ui/DatePicker'
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

interface SortEntry {
  column: string
  direction: 'asc' | 'desc'
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
  'w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

const selectCls =
  'w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer'

const labelCls = 'block text-[11px] font-medium text-gray-500 dark:text-zinc-400 mb-0.5'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Filters {
  officeNum: string
  policyNumber: string
  policyItem: string
  sectionOfRout: string
  policyType: string
  status: string
  gfuDate: string
  gfuCode: string
  agentNafo: string
  description: string
  errorSearch: string
  flmpCode: string
  queueName: string
  queueDetail: string
  servOrUndr: string
  systemPolicyType: string
}

const EMPTY_FILTERS: Filters = {
  officeNum: '',
  policyNumber: '',
  policyItem: '',
  sectionOfRout: '',
  policyType: '',
  status: '',
  gfuDate: '',
  gfuCode: '',
  agentNafo: '',
  description: '',
  errorSearch: '',
  flmpCode: '',
  queueName: '',
  queueDetail: '',
  servOrUndr: '',
  systemPolicyType: '',
}

function buildFilterPayload(filters: Filters) {
  const result: Array<{ field: string; op: string; value: string }> = []

  // Select fields → exact match
  const selectFields: (keyof Filters)[] = [
    'officeNum',
    'policyItem',
    'sectionOfRout',
    'status',
    'servOrUndr',
  ]
  for (const key of selectFields) {
    if (filters[key]) result.push({ field: key, op: 'eq', value: filters[key] })
  }

  // Text fields → contains (wildcard)
  const textFields: Array<{ key: keyof Filters; field: string }> = [
    { key: 'policyNumber', field: 'policyNumber' },
    { key: 'policyType', field: 'policyType' },
    { key: 'gfuDate', field: 'gfuDate' },
    { key: 'gfuCode', field: 'gfuCode' },
    { key: 'agentNafo', field: 'agentNafo' },
    { key: 'description', field: 'description' },
    { key: 'flmpCode', field: 'flmpCode' },
    { key: 'queueName', field: 'queueName' },
    { key: 'queueDetail', field: 'queueDetail' },
    { key: 'systemPolicyType', field: 'systemPolicyType' },
  ]
  for (const { key, field } of textFields) {
    if (filters[key]) result.push({ field, op: 'contains', value: filters[key] })
  }

  // Error search → special _anyError field
  if (filters.errorSearch) {
    result.push({ field: '_anyError', op: 'contains', value: filters.errorSearch })
  }

  return result
}

export function DataInquiryModal({ isOpen, onClose }: DataInquiryModalProps): React.ReactNode {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS })
  const [sorts, setSorts] = useState<SortEntry[]>([])
  const [rows, setRows] = useState<ServerRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(500)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // ----------------------------
  // Search
  // ----------------------------
  async function doSearch(offset: number, sortOverride?: SortEntry[]) {
    setLoading(true)
    setError('')
    try {
      const result = await apiPost<{ rows: ServerRow[]; total: number }>('/data-inquiry', {
        astName: 'rout_extractor',
        filters: buildFilterPayload(filters),
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
    if (hasSearched) void doSearch(0)
  }

  function clearAll() {
    setFilters({ ...EMPTY_FILTERS })
    setSorts([])
    setRows([])
    setTotal(0)
    setHasSearched(false)
    setError('')
    setPage(0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
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
    if (hasSearched) void doSearch(0, newSorts)
  }

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
  // Render helpers
  // ----------------------------
  function renderSelect(
    label: string,
    key: keyof Filters,
    options: { value: string; label: string }[],
  ) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <select
          value={filters[key]}
          onChange={(e) => setFilter(key, e.target.value)}
          className={selectCls}
        >
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function renderText(label: string, key: keyof Filters, placeholder?: string) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <input
          type="text"
          value={filters[key]}
          onChange={(e) => setFilter(key, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? ''}
          className={inputCls}
        />
      </div>
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
        {/* Filter grid */}
        <div className="grid grid-cols-4 gap-x-3 gap-y-2">
          {/* Row 1 */}
          {renderSelect('Office', 'officeNum', OFFICE_OPTIONS)}
          {renderText('Policy (UU-HH-TTTT-C)', 'policyNumber', '*')}
          {renderSelect('Item Type', 'policyItem', ITEM_TYPE_OPTIONS)}
          {renderSelect('Section of Rout', 'sectionOfRout', SECTION_OPTIONS)}

          {/* Row 2 */}
          {renderText('Policy Type', 'policyType', '*')}
          {renderSelect('Status', 'status', STATUS_OPTIONS)}
          <div>
            <label className={labelCls}>Date</label>
            <div className="flex items-center gap-1">
              <DatePicker
                value={filters.gfuDate || undefined}
                onChange={(v) => setFilter('gfuDate', v)}
                allowFuture
                className="flex-1 [&_button]:py-1.5 [&_button]:text-sm [&_button]:rounded-md [&_button]:rounded-lg!"
              />
              {filters.gfuDate && (
                <button
                  type="button"
                  onClick={() => setFilter('gfuDate', '')}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {renderText('GFU Code', 'gfuCode', '*')}

          {/* Row 3 */}
          {renderText('Agent/AFO', 'agentNafo', '*')}
          {renderText('Description', 'description', '*')}
          {renderText('Error (any field)', 'errorSearch', '*')}
          {renderText('FLMP', 'flmpCode', '*')}

          {/* Row 4 */}
          {renderText('Queue', 'queueName', '*')}
          {renderText('Queue Detail', 'queueDetail', '*')}
          {renderSelect('S/U', 'servOrUndr', SERV_UNDR_OPTIONS)}
          {renderText('Policy Code', 'systemPolicyType', '*')}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
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

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Sort hint */}
        {hasSearched && rows.length > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Click column headers to sort. Shift+Click to add multi-column sort.
          </p>
        )}

        {/* Results table */}
        {hasSearched && rows.length > 0 && (
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div className="overflow-scroll max-h-[45vh] scrollbar-visible">
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
          <div className="sticky bottom-0 flex items-center justify-between gap-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 -mx-6 px-6 -mb-6">
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
              Use the filters above and click Search to query policy data.
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Leave filters empty to search all records. Text fields support wildcard matching.
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
              Try clearing some filters to broaden the search.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
