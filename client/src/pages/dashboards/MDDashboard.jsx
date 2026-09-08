import { Link } from 'react-router-dom'
import { Clock, RotateCcw, Send, Eye, AlertTriangle, CheckCircle, BarChart3, Users } from 'lucide-react'
import { fmt, fmtCurrency, fmtDays, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'
import StatusBadge from '../../components/shared/StatusBadge'

export default function MDDashboard({ user, queues, dashboardData }) {
  const dd = dashboardData || {}
  const metrics = dd.metrics || {}
  const queue = dd.queue || []
  const oldestWaiting = dd.oldestWaiting

  const pendingReview = metrics.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || 0
  const approvedByMe = metrics.approvedByMe || 0
  const approvedToday = metrics.approvedToday || 0
  const escalatedCount = metrics.escalated || 0
  const totalInScope = metrics.totalInScope || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {pendingReview > 0
            ? <>{pendingReview} estimate{pendingReview !== 1 ? 's' : ''} awaiting final approval{escalatedCount > 0 && <>, {escalatedCount} escalated</>}</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending approvals. All clear.</span>
          }
        </p>
        {oldestWaiting && (
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Oldest waiting: <span className="font-medium text-[#64748B]">{oldestWaiting.EstimateNo}</span> — {fmtDays(oldestWaiting.daysWaiting)}
          </p>
        )}
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Final Approval" value={pendingReview} icon={Clock} bg="bg-emerald-600" to={qs({ status: 'ED_Approved', assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting final approval`} />
          <MetricCard label="Approved by Me" value={approvedByMe} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'FinalApprove' })} tip={`${fmt(approvedByMe)} estimates approved`} />
          <MetricCard label="Approved Today" value={approvedToday} icon={CheckCircle} bg="bg-teal-600" to={qs({ actedBy: 'me', action: 'FinalApprove', today: true })} tip={`${fmt(approvedToday)} approved today`} />
          <MetricCard label="Reverted/Returned" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Escalated" value={escalatedCount} icon={AlertTriangle} bg="bg-red-500" to={qs({ status: 'Submitted', assignedTo: 'me' })} tip={escalatedCount > 0 ? `${fmt(escalatedCount)} overdue approvals` : 'No escalations'} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Users} bg="bg-teal-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in MD scope`} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Final Approvals', desc: 'Open your pending approval queue', icon: Eye, to: '/approvals', tileBg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-200 border-l-emerald-600', iconBg: 'bg-emerald-600', btnBg: 'bg-emerald-600 group-hover:bg-emerald-700', focusRing: 'focus-visible:ring-emerald-400', strong: pendingReview > 0 },
        { label: 'Approved Estimates', desc: 'View estimates you have approved', icon: CheckCircle, to: qs({ actedBy: 'me', action: 'FinalApprove' }), tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Reports', desc: 'Analytics and insights', icon: BarChart3, to: '/reports', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <QueueTable
        title="My Queue — Final Approval"
        viewLink={qs({ assignedTo: 'me' })}
        emptyMessage="No estimates pending final approval"
        columns={[
          { key: 'EstimateNo', label: 'Estimate', render: e => (
            <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}
              {Number(e.daysWaiting) > 3 && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-600">ESCALATED</span>}
            </span>
          )},
          { key: 'NameOfWork', label: 'Work Name', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[250px]">{e.NameOfWork}</span> },
          { key: 'CreatedByName', label: 'Creator', hideOn: 'hidden md:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.CreatedByName}</span> },
          { key: 'Status', label: 'Status', align: 'center', render: e => <StatusBadge status={e.Status} /> },
          { key: 'GrandTotal', label: 'Amount', align: 'right', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.GrandTotal)}</span> },
          { key: 'action', label: 'Action', align: 'right', render: e => (
            <Link to={`/estimates/${e.EstimateID}`} onClick={ev => ev.stopPropagation()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              Review
            </Link>
          )},
        ]}
        rows={queue}
      />

      <WorkflowPosition
        title="MD Workflow Position"
        stages={[
          { label: 'ED', count: queues.submittedCreated || 0, color: '#4338CA', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'MD', count: pendingReview, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', to: qs({ status: 'ED_Approved', assignedTo: 'me' }) },
          { label: 'Approved', count: approvedByMe, color: '#059669', bg: 'bg-green-50', border: 'border-green-200' },
        ]}
      />
    </div>
  )
}
