import { Landmark, Repeat, Receipt, Layers, Wallet } from 'lucide-react'
import { fmtCurrency } from '../../components/dashboard/utils'

// Compact financial summary for the bill review workbench. Uses ONLY the
// numbers already computed by the backend (financialSummary) — never recalculates.
export default function BillFinancialSummary({ fs }) {
  if (!fs) return null
  const rows = [
    { icon: Landmark, color: 'bg-[#2563EB]', bg: 'bg-[#2563EB]/10', label: 'Approved Estimate', value: fmtCurrency(fs.approvedEstimate || 0) },
    { icon: Repeat, color: 'bg-[#475569]', bg: 'bg-[#475569]/10', label: 'Previously Billed', value: fmtCurrency(fs.previousBilled || 0) },
    { icon: Receipt, color: 'bg-[#1D4ED8]', bg: 'bg-blue-50', label: 'Current Bill', value: fmtCurrency(fs.currentBill || 0) },
    { icon: Layers, color: 'bg-[#7C3AED]', bg: 'bg-violet-50', label: 'Cumulative Billed', value: fmtCurrency(fs.cumulativeBilled || 0) },
    {
      icon: Wallet, color: 'bg-[#059669]', bg: 'bg-emerald-50',
      label: 'Remaining Balance',
      value: fs.remainingBalance != null ? fmtCurrency(fs.remainingBalance) : '—',
    },
  ]
  return (
    <section>
      <p className="bi-section-label">Financial Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {rows.map(r => (
          <div key={r.label} className="bi-metric flex items-center gap-3">
            <span className={`bi-metric-icon ${r.bg}`}><r.icon className="w-4 h-4" style={{ color: r.color }} /></span>
            <div className="min-w-0">
              <p className="bi-metric-value text-[15px]">{r.value}</p>
              <p className="bi-metric-label">{r.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
