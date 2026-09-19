import { Link } from 'react-router-dom'
import { Inbox, CheckCircle, Clock, FileText } from 'lucide-react'
import { fmtCurrency } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import StatusBadge from '../../components/shared/StatusBadge'
import { buildStages, FINANCE_CLERK_PIPELINE } from './pipelineConfig'

export default function FinanceClerkDashboard({ user, queues, financeClerkDashboard }) {
  const fd = financeClerkDashboard || {}
  const metrics = fd.metrics || {}
  const queue = fd.queue || []

  const pendingInward = metrics.pendingInward || 0
  const inwardToday = metrics.inwardToday || 0
  const pendingVerification = metrics.pendingVerification || 0
  const processed = metrics.processed || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Inward Register', desc: 'Record new bill inward', icon: Inbox, to: '/finance?status=SubmittedToFinance', tileBg: 'bg-indigo-50 hover:bg-indigo-100', border: 'border-indigo-200 border-l-indigo-600', iconBg: 'bg-indigo-600', btnBg: 'bg-indigo-600 group-hover:bg-indigo-700', focusRing: 'focus-visible:ring-indigo-400', strong: pendingInward > 0 },
        { label: 'Pending Verification', desc: 'Verify inwarded bills', icon: FileText, to: '/finance?status=Verification', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Finance Records', desc: 'View all finance records', icon: CheckCircle, to: '/finance', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <EstimatePipeline
        title="Finance Workflow Position"
        viewLink="/finance"
        stages={buildStages(FINANCE_CLERK_PIPELINE, {
          PendingInward: pendingInward,
          Verification: pendingVerification,
          Processed: processed,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label="Pending Inward" value={pendingInward} icon={Inbox} bg="bg-indigo-600" to="/finance?status=SubmittedToFinance" tip={`${pendingInward} bills awaiting inward`} />
          <MetricCard label="Inward Today" value={inwardToday} icon={Clock} bg="bg-blue-600" to="/finance" tip={`${inwardToday} inwarded today`} />
          <MetricCard label="Pending Verification" value={pendingVerification} icon={FileText} bg="bg-amber-500" to="/finance?status=Verification" tip={`${pendingVerification} bills in verification`} />
          <MetricCard label="Processed" value={processed} icon={CheckCircle} bg="bg-green-600" to="/finance?status=Verification,Recommended,Approved" tip={`${processed} bills processed`} />
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
              { key: 'NameOfWork', label: 'Work Name', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#475569] truncate block max-w-[200px]">{e.NameOfWork}</span> },
              { key: 'Amount', label: 'Amount', align: 'right', render: e => <span className="text-sm font-semibold text-[#2563EB]">{fmtCurrency(e.Amount)}</span> },
              { key: 'Status', label: 'Status', align: 'center', render: e => <StatusBadge status={e.Status} /> },
              { key: 'action', label: 'Action', align: 'right', render: e => (
                <Link to={e.FinanceID == null ? '/finance?status=SubmittedToFinance' : '/finance'} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  {e.FinanceID == null ? 'Record Inward' : 'Process'}
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