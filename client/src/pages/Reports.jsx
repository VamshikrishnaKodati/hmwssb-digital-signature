import { useState } from 'react'
import { BarChart3, FileDown, Loader, ExternalLink, FileText, FileSpreadsheet, Download } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { downloadExport } from '../utils/download'

const ESTIMATE_STATUSES = ['Draft', 'Submitted', 'Reverted', 'DGM_Approved', 'GM_Recommended', 'CGM_Submitted', 'DOP_Approved', 'ED_Approved', 'MD_Approved', 'FinalApproved', 'Signed', 'TenderPublished', 'AgencySelected', 'WorkStarted', 'WorkCompleted', 'Billing', 'Completed']

const REPORTS = [
  { key: 'estimate-register', label: 'Estimate Register', desc: 'All estimates with filters', icon: BarChart3 },
  { key: 'pending', label: 'Pending Estimates', desc: 'Submitted & awaiting approval', icon: BarChart3 },
  { key: 'approved', label: 'Approved Estimates', desc: 'All approved estimates', icon: BarChart3 },
  { key: 'tender', label: 'Tender Report', desc: 'All tenders with estimate details', icon: BarChart3 },
  { key: 'agency', label: 'Agency Report', desc: 'All agencies with agreement details', icon: BarChart3 },
  { key: 'work-progress', label: 'Work Progress Report', desc: 'Stage-wise progress of works', icon: BarChart3 },
  { key: 'billing', label: 'Billing Report', desc: 'RA and Final bills', icon: BarChart3 },
  { key: 'estimate-movement', label: 'Estimate Movement', desc: 'Full workflow history', icon: BarChart3 },
]

const EXPORT_FILES = [
  { key: 'pdf', label: 'Download Complete PDF', desc: 'Single printable document with all sections', color: 'ec-btn-primary' },
  { key: 'excel', label: 'Download Complete Excel', desc: 'Workbook with all estimate sheets', color: 'ec-btn-success' },
]

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeReport, setActiveReport] = useState('')
  const [exportEstimateId, setExportEstimateId] = useState('')
  const [exporting, setExporting] = useState('')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '' })

  const loadReport = async (key, filterParams = filters) => {
    setLoading(true)
    setActiveReport(key)
    try {
      const params = new URLSearchParams()
      if (key === 'estimate-register') {
        if (filterParams.dateFrom) params.set('dateFrom', filterParams.dateFrom)
        if (filterParams.dateTo) params.set('dateTo', filterParams.dateTo)
        if (filterParams.status) params.set('status', filterParams.status)
      }
      const qs = params.toString()
      const res = await api.get(`/reports/${key}${qs ? `?${qs}` : ''}`)
      setData(res.data)
    } catch (_) {
      toast.error('Failed to load report')
      setData(null)
    }
    setLoading(false)
  }

  const applyFilters = () => { if (activeReport === 'estimate-register') loadReport(activeReport) }

  const exportCsv = () => {
    if (!data || data.length === 0) return toast.error('No data to export')
    const cols = Object.keys(data[0]).filter(k => !k.includes('Password'))
    const escape = (v) => {
      const s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : (v == null ? '' : String(v))
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = [cols.join(','), ...data.map(r => cols.map(c => escape(r[c])).join(','))]
    const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeReport || 'report'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const handleExport = async (format) => {
    let id = exportEstimateId
    if (!id) {
      if (data && data.length > 0 && data[0].EstimateID) {
        id = data[0].EstimateID
        setExportEstimateId(id)
      } else {
        toast.error('Enter an Estimate ID to export')
        return
      }
    }
    setExporting(format)
    try {
      const name = await downloadExport(`/exports/${id}/${format === 'pdf' ? 'pdf' : 'excel'}`, `${id.replace(/\//g, '_')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(`${name} downloaded`)
    } catch (_) { toast.error('Export failed — check Estimate ID') }
    setExporting('')
  }

  const isCurrency = (c) => /amount|total|value|cost/i.test(c)

  const renderTable = () => {
    if (!data || data.length === 0) return <p className="text-center py-8 text-sm text-[#94A3B8]">No data</p>
    const cols = Object.keys(data[0]).filter(k => !k.includes('Password'))
    return (
      <div className="overflow-x-auto">
        <table className="ec-table">
          <thead>
            <tr>{cols.map(c => <th key={c} className="whitespace-nowrap text-xs">{c.replace(/([A-Z])/g, ' $1').trim()}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {cols.map(c => {
                  const val = row[c]
                  const display = typeof val === 'number' && isCurrency(c)
                    ? `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : typeof val === 'boolean' ? (val ? '✓' : '✗')
                    : String(val ?? '').substring(0, 60)
                  return <td key={c} className="whitespace-nowrap text-xs">{display}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <h1 className="ec-page-title">Reports & Exports</h1>
        <p className="ec-page-subtitle">View reports and generate estimate documents</p>
      </div>

      {/* Export Section */}
      <div className="ec-card mb-6">
        <div className="ec-card-header">
          <FileDown className="w-4 h-4 text-[#1E3A5F]" />
          <span className="ec-card-title">Export Estimate Documents</span>
        </div>
        <div className="ec-card-body">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="ec-form-group mb-0">
              <label htmlFor="exportEstimateId" className="ec-label">Estimate ID</label>
              <input id="exportEstimateId" name="exportEstimateId" type="text" value={exportEstimateId}
                onChange={e => setExportEstimateId(e.target.value.replace(/[^a-zA-Z0-9\-]/g, '').trimStart())}
                onBlur={e => setExportEstimateId(e.target.value.trim())}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('export-first-btn')?.click() }}
                className="ec-input w-40" placeholder="Enter Estimate ID"
                autoComplete="off" spellCheck={false} />
            </div>
            <span className="text-xs text-[#64748B] self-end mb-1">Generate:</span>
            {EXPORT_FILES.map((exp, i) => (
              <button key={exp.key} id={i === 0 ? 'export-first-btn' : undefined} onClick={() => {
                handleExport(exp.key)
              }} disabled={!!exporting}
                className={`${exp.color} ec-btn-xs`}>
                {exporting === exp.key ? <Loader className="w-3 h-3 animate-spin" /> : exp.key === 'pdf' ? <FileText className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                {exp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Filters (estimate register only) */}
      {activeReport === 'estimate-register' && (
        <div className="ec-card mb-6">
          <div className="ec-card-header"><span className="ec-card-title">Filters</span></div>
          <div className="ec-card-body">
            <div className="flex flex-wrap items-end gap-3">
              <div className="ec-form-group mb-0">
                <label className="ec-label">From Date</label>
                <input type="date" className="ec-input" value={filters.dateFrom}
                  onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
              </div>
              <div className="ec-form-group mb-0">
                <label className="ec-label">To Date</label>
                <input type="date" className="ec-input" value={filters.dateTo}
                  onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
              </div>
              <div className="ec-form-group mb-0">
                <label className="ec-label">Status</label>
                <select className="ec-select" value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">All</option>
                  {ESTIMATE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={applyFilters} className="ec-btn-sm ec-btn-primary">Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {REPORTS.map(r => {
          const isActive = activeReport === r.key
          return (
            <button key={r.key} onClick={() => loadReport(r.key)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-md'
                  : 'bg-white border-[#E2E8F0] hover:border-[#1E3A5F]/30 hover:shadow-sm'
              }`}>
              <p className="font-medium text-sm">{r.label}</p>
              <p className={`text-xs mt-1 ${isActive ? 'text-blue-200' : 'text-[#64748B]'}`}>{r.desc}</p>
            </button>
          )
        })}
      </div>

      {loading && <div className="ec-loader"><div className="ec-spinner" /></div>}

      {data && !loading && (
        <div className="ec-card">
          <div className="ec-card-header">
            <span className="ec-card-title">{REPORTS.find(r => r.key === activeReport)?.label}</span>
            <div className="flex items-center gap-2">
              {data.length > 0 && (
                <button onClick={exportCsv} className="ec-btn-sm ec-btn-ghost">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
              <button onClick={() => setData(null)} className="text-xs text-[#64748B] hover:text-[#1E3A5F]">Clear</button>
            </div>
          </div>
          <div className="ec-card-body">{renderTable()}</div>
        </div>
      )}
    </div>
  )
}
