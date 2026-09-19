import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { fmtCurrency, fmtDays } from './utils'

// Shared "Attention Required — Escalated" panel for the approval dashboards.
// Fed the same `escalated` rows the dashboard stats compute, so the badge
// count always equals the rows shown.
export default function AttentionRequired({ rows = [] }) {
  if (rows.length === 0) return null
  const n = rows.length
  return (
    <div data-testid="attention-required">
      <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Attention Required — Escalated</h2>
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F172A]">{n} estimate{n !== 1 ? 's' : ''} waiting &gt; 3 days</p>
            <p className="text-[11px] text-[#475569]">These estimates exceed the review SLA and require immediate attention.</p>
          </div>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {rows.slice(0, 5).map(e => (
            <Link key={e.EstimateID} to={`/estimates/${e.EstimateID}`} className="flex items-center justify-between py-2.5 hover:bg-red-50/50 transition-colors rounded px-2 -mx-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span>
                <span className="text-xs text-[#475569] truncate max-w-[200px]">{e.NameOfWork}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-[#2563EB]">{fmtCurrency(e.GrandTotal)}</span>
                <span className="text-xs font-medium text-red-600">{fmtDays(e.daysWaiting)} waiting</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}