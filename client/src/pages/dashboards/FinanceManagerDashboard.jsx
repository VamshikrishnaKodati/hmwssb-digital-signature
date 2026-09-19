import { Link } from 'react-router-dom'
import { ClipboardCheck, Send, CheckCircle, BarChart3 } from 'lucide-react'
import { fmtCurrency } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import StatusBadge from '../../components/shared/StatusBadge'
import { buildStages, FINANCE_MANAGER_PIPELINE } from './pipelineConfig'

export default function FinanceManagerDashboard({ user, financeManagerDashboard }) {
  const fd = financeManagerDashboard || {}
  const metrics = fd.metrics || {}
  const queue = fd.queue || []

  const pendingVerification = metrics.pendingVerification || 0
  const pendingRecommendation = metrics.pendingRecommendation || 0
  const recommended = metrics.recommended || 0
  const amountPending = metrics.amountPending || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Verification', desc: 'Verify submitted bills', icon: ClipboardCheck, to: '/finance?status=Verification', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: pendingVerification > 0 },
        { label: 'Recommend', desc: 'Recommend verified bills', icon: Send, to: '/finance?status=Verification', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Finance Records', desc: 'View all records', icon: CheckCircle, to: '/finance', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <EstimatePipeline
        title="Finance Workflow Position"
        viewLink="/finance"
        stages={buildStages(FINANCE_MANAGER_PIPELINE, {
          Verification: pendingVerification,
          Recommendation: pendingRecommendation,
          Recommended: recommended,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label="Pending Verification" value={pendingVerification} icon={ClipboardCheck} bg="bg-amber-500" to="/finance?status=Verification" tip={`${pendingVerification} bills awaiting verification`} />
          <MetricCard label="Pending Recommendation" value={pendingRecommendation} icon={Send} bg="bg-blue-600" to="/finance?status=Recommended" tip={`${pendingRecommendation} bills awaiting recommendation`} />
          <MetricCard label="Recommended" value={recommended} icon={CheckCircle} bg="bg-green-600" to="/finance?status=Recommended" tip={`${recommended} bills recommended`} />
          <MetricCard label="Amount Pending" value={fmtCurrency(amountPending)} icon={BarChart3} bg="bg-teal-600" format={v => v} to="/finance?status=Verification,Recommended" tip="Amount awaiting verification / recommendation" />
        </div>
      </div>

      {queue.length > 0 && (
        <div data-testid="dashboard-queue">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">My Finance Queue</h2>
          <QueueTable
            viewLink="/finance"
            viewLabel="All finance records"
            columns={[
              { key: 'BillNo', label: 'Bill No.', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.BillNo || '—'}</span> },
              { key: 'EstimateNo', label: 'Estimate', render: e => <span className="text-xs text-[#475569]">{e.EstimateNo}</span> },
              { key: 'NameOfWork', label: 'Work', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#475569] truncate block max-w-[200px]">{e.NameOfWork}</span> },
              { key: 'Amount', label: 'Amount', align: 'right', render: e => <span className="text-sm font-semibold text-[#2563EB]">{fmtCurrency(e.Amount)}</span> },
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
      )}
    </div>
  )
}