import { useState, useEffect } from 'react'
import { ScrollText, RefreshCw, Search } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [estimateId, setEstimateId] = useState('')

  const load = async (eid) => {
    setLoading(true)
    try {
      const res = await api.get(`/audit-logs${eid ? `?estimateId=${encodeURIComponent(eid)}` : ''}`)
      setLogs(res.data || [])
    } catch (_) { toast.error('Failed to load audit logs') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Audit Logs</h1>
          <p className="ec-page-subtitle">{logs.length} action{logs.length !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <input
              className="ec-input pl-8 w-40"
              placeholder="Estimate ID"
              value={estimateId}
              onChange={e => setEstimateId(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(estimateId.trim()) }}
            />
          </div>
          <button onClick={() => load(estimateId.trim())} className="ec-btn-sm ec-btn-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Filter
          </button>
        </div>
      </div>

      <div className="ec-card overflow-hidden">
        {loading ? (
          <div className="ec-loader"><div className="ec-spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead><tr>
                <th>Date & Time</th><th>Estimate No</th><th>Work Name</th>
                <th>User</th><th>Action</th><th>Remarks</th>
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.AuditID}>
                    <td className="whitespace-nowrap text-xs">{fmtDT(l.CreatedDate)}</td>
                    <td className="font-mono text-xs">{l.EstimateNo || `#${l.EstimateID || '—'}`}</td>
                    <td className="text-xs max-w-[200px] truncate">{l.NameOfWork || l.WorkID || '—'}</td>
                    <td className="text-xs">
                      <span className="font-medium">{l.UserName || '—'}</span>
                      {l.UserDesignation && <span className="text-[10px] text-[#94A3B8]"> · {l.UserDesignation}</span>}
                    </td>
                    <td><span className="ec-badge ec-badge-info">{l.Action}</span></td>
                    <td className="text-xs text-[#64748B] max-w-[280px]">{l.Remarks || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-xs text-slate-400">No audit entries</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
