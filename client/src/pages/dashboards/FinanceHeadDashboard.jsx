import { Link } from 'react-router-dom'
import { ShieldCheck, Banknote, CheckCircle, BarChart3, FileCheck } from 'lucide-react'
import { fmtCurrency, fmt } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import { buildStages, FINANCE_HEAD_PIPELINE } from './pipelineConfig'

export default function FinanceHeadDashboard({ user, financeHeadDashboard }) {
  const fd = financeHeadDashboard || {}
  const metrics = fd.metrics || {}
  const queue = fd.queue || []

  const pendingApproval = metrics.pendingApproval || 0
  const approved = metrics.approved || 0
  const chequesIssued = metrics.chequesIssued || 0
  const pendingCheque = metrics.pendingCheque || 0
  const totalAmount = metrics.totalAmount || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Final Approval', desc: 'Approve recommended bills', icon: ShieldCheck, to: '/finance?status=Recommended', tileBg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 border-l-red-600', iconBg: 'bg-red-600', btnBg: 'bg-red-600 group-hover:bg-red-700', focusRing: 'focus-visible:ring-red-400', strong: pendingApproval > 0 },
        { label: 'Cheque Processing', desc: 'Issue cheques for approved bills', icon: Banknote, to: '/finance?status=Approved', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Finance Records', desc: 'View all records', icon: CheckCircle, to: '/finance', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <EstimatePipeline
        title="Finance Workflow Position"
        viewLink="/finance"
        stages={buildStages(FINANCE_HEAD_PIPELINE, {
          Recommended: pendingApproval,
          Approved: approved,
          ChequeIssued: chequesIssued,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Approval" value={pendingApproval} icon={ShieldCheck} bg="bg-red-600" to="/finance?status=Recommended" tip={`${fmt(pendingApproval)} bills awaiting approval`} />
          <MetricCard label="Approved" value={approved} icon={CheckCircle} bg="bg-green-600" to="/finance?status=Approved" tip={`${fmt(approved)} bills approved`} />
          <MetricCard label="Pending Cheque" value={pendingCheque} icon={FileCheck} bg="bg-amber-500" to="/finance?status=ChequeIssued" tip={`${fmt(pendingCheque)} bills pending cheque issue`} />
          <MetricCard label="Cheques Issued" value={chequesIssued} icon={Banknote} bg="bg-teal-600" to="/finance?status=ChequeIssued" tip={`${fmt(chequesIssued)} cheques issued`} />
          <MetricCard label="Total Amount" value={fmtCurrency(totalAmount)} icon={BarChart3} bg="bg-indigo-600" format={v => v} to="/finance" tip="Total finance throughput" />
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
              { key: 'Status', label: 'Status', align: 'center', render: e => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  e.Status === 'Recommended' ? 'bg-blue-100 text-blue-700' :
                  e.Status === 'Approved' ? 'bg-green-100 text-green-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{e.Status}</span>
              )},
              { key: 'action', label: 'Action', align: 'right', render: e => (
                <Link to={`/finance`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">
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