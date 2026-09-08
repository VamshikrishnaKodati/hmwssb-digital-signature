import { Link } from 'react-router-dom'
import { ClipboardCheck, Send, CheckCircle, BarChart3 } from 'lucide-react'
import { fmtCurrency, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import StatusBadge from '../../components/shared/StatusBadge'

export default function FinanceManagerDashboard({ user, financeManagerDashboard }) {
  const fd = financeManagerDashboard || {}
  const metrics = fd.metrics || {}
  const queue = fd.queue || []

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {(metrics.pendingVerification || 0) + (metrics.pendingRecommendation || 0) > 0
            ? <>{(metrics.pendingVerification || 0) + (metrics.pendingRecommendation || 0)} bill{(metrics.pendingVerification || 0) + (metrics.pendingRecommendation || 0) !== 1 ? 's' : ''} pending action</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending items.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label="Pending Verification" value={metrics.pendingVerification || 0} icon={ClipboardCheck} bg="bg-amber-500" to="/finance?status=Verification" tip={`${metrics.pendingVerification || 0} bills awaiting verification`} />
          <MetricCard label="Pending Recommendation" value={metrics.pendingRecommendation || 0} icon={Send} bg="bg-blue-600" to="/finance?status=Recommended" tip={`${metrics.pendingRecommendation || 0} bills awaiting recommendation`} />
          <MetricCard label="Recommended" value={metrics.recommended || 0} icon={CheckCircle} bg="bg-green-600" to="/finance?status=Recommended" tip={`${metrics.recommended || 0} bills recommended`} />
          <MetricCard label="Amount Pending" value={fmtCurrency(metrics.amountPending || 0)} icon={BarChart3} bg="bg-teal-600" format={v => v} to="/finance?status=Verification,Recommended" tip="Amount awaiting verification / recommendation" />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Verification', desc: 'Verify submitted bills', icon: ClipboardCheck, to: '/finance?status=Verification', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: (metrics.pendingVerification || 0) > 0 },
        { label: 'Recommend', desc: 'Recommend verified bills', icon: Send, to: '/finance?status=Verification', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Finance Records', desc: 'View all records', icon: CheckCircle, to: '/finance', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <QueueTable
        title="My Finance Queue"
        viewLink="/finance"
        emptyMessage="No finance items pending your action"
        columns={[
          { key: 'BillNo', label: 'Bill No.', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.BillNo || '—'}</span> },
          { key: 'EstimateNo', label: 'Estimate', render: e => <span className="text-xs text-[#64748B]">{e.EstimateNo}</span> },
          { key: 'NameOfWork', label: 'Work', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[200px]">{e.NameOfWork}</span> },
          { key: 'Amount', label: 'Amount', align: 'right', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.Amount)}</span> },
          { key: 'Status', label: 'Status', align: 'center', render: e => <StatusBadge status={e.Status} /> },
          { key: 'action', label: 'Action', align: 'right', render: e => (
            <Link to={`/finance`} onClick={ev => ev.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Process
            </Link>
          )},
        ]}
        rows={queue}
      />
    </div>
  )
}
