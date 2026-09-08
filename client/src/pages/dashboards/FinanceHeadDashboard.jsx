import { Link } from 'react-router-dom'
import { ShieldCheck, Banknote, CheckCircle, BarChart3, FileCheck } from 'lucide-react'
import { fmtCurrency, fmt, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import StatusBadge from '../../components/shared/StatusBadge'

export default function FinanceHeadDashboard({ user, financeHeadDashboard }) {
  const fd = financeHeadDashboard || {}
  const metrics = fd.metrics || {}
  const queue = fd.queue || []

  const pendingApproval = metrics.pendingApproval || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {pendingApproval > 0
            ? <>{pendingApproval} bill{pendingApproval !== 1 ? 's' : ''} awaiting your approval</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending actions.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Approval" value={pendingApproval} icon={ShieldCheck} bg="bg-red-600" to="/finance?status=Recommended" tip={`${fmt(pendingApproval)} bills awaiting approval`} />
          <MetricCard label="Approved" value={metrics.approved || 0} icon={CheckCircle} bg="bg-green-600" to="/finance?status=Approved" tip={`${fmt(metrics.approved || 0)} bills approved`} />
          <MetricCard label="Pending Cheque" value={metrics.pendingCheque || 0} icon={FileCheck} bg="bg-amber-500" to="/finance?status=ChequeIssued" tip={`${fmt(metrics.pendingCheque || 0)} bills pending cheque issue`} />
          <MetricCard label="Cheques Issued" value={metrics.chequesIssued || 0} icon={Banknote} bg="bg-teal-600" to="/finance?status=ChequeIssued" tip={`${fmt(metrics.chequesIssued || 0)} cheques issued`} />
          <MetricCard label="Total Amount" value={fmtCurrency(metrics.totalAmount || 0)} icon={BarChart3} bg="bg-indigo-600" format={v => v} to="/finance" tip="Total finance throughput" />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Final Approval', desc: 'Approve recommended bills', icon: ShieldCheck, to: '/finance?status=Recommended', tileBg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 border-l-red-600', iconBg: 'bg-red-600', btnBg: 'bg-red-600 group-hover:bg-red-700', focusRing: 'focus-visible:ring-red-400', strong: pendingApproval > 0 },
        { label: 'Cheque Processing', desc: 'Issue cheques for approved bills', icon: Banknote, to: '/finance?status=Approved', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Finance Records', desc: 'View all records', icon: CheckCircle, to: '/finance', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
      ]} />

      <QueueTable
        title="My Finance Queue"
        viewLink="/finance"
        emptyMessage="No finance items in your queue"
        columns={[
          { key: 'BillNo', label: 'Bill No.', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.BillNo || '—'}</span> },
          { key: 'EstimateNo', label: 'Estimate', render: e => <span className="text-xs text-[#64748B]">{e.EstimateNo}</span> },
          { key: 'NameOfWork', label: 'Work', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[200px]">{e.NameOfWork}</span> },
          { key: 'Amount', label: 'Amount', align: 'right', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.Amount)}</span> },
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
  )
}
