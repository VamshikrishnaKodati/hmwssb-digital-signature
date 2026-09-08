import { Link } from 'react-router-dom'
import { Clock, RotateCcw, Send, Eye, AlertTriangle, Users } from 'lucide-react'
import { fmt, fmtCurrency, fmtDays, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'
import StatusBadge from '../../components/shared/StatusBadge'

export default function CGMDashboard({ user, queues, dashboardData }) {
  const dd = dashboardData || {}
  const metrics = dd.metrics || {}
  const queue = dd.queue || []
  const oldestWaiting = dd.oldestWaiting

  const pendingReview = metrics.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || 0
  const submittedForApproval = metrics.submittedForApproval || 0
  const waitingForDOP = metrics.waitingForNext || 0
  const escalatedCount = metrics.escalated || 0
  const totalInScope = metrics.totalInScope || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {pendingReview > 0
            ? <>{pendingReview} estimate{pendingReview !== 1 ? 's' : ''} awaiting your review{escalatedCount > 0 && <>, {escalatedCount} escalated</>}</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending reviews. All clear.</span>
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
          <MetricCard label="Pending CGM Review" value={pendingReview} icon={Clock} bg="bg-violet-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting review`} />
          <MetricCard label="Reverted/Returned" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Submitted for Approval" value={submittedForApproval} icon={Send} bg="bg-blue-600" to={qs({ status: 'CGM_Submitted', scope: 'global' })} tip={`${fmt(submittedForApproval)} submitted for approval`} />
          <MetricCard label="Waiting for DOP" value={waitingForDOP} icon={Eye} bg="bg-indigo-600" to={qs({ status: 'CGM_Submitted', scope: 'global' })} tip={`${fmt(waitingForDOP)} awaiting DOP action`} />
          <MetricCard label="Escalated" value={escalatedCount} icon={AlertTriangle} bg="bg-red-500" to={qs({ assignedTo: 'me' })} tip={escalatedCount > 0 ? `${fmt(escalatedCount)} overdue reviews` : 'No escalations'} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Users} bg="bg-teal-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in CGM scope`} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: '/approvals', tileBg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-200 border-l-violet-600', iconBg: 'bg-violet-600', btnBg: 'bg-violet-600 group-hover:bg-violet-700', focusRing: 'focus-visible:ring-violet-400', strong: pendingReview > 0 },
        { label: 'Submit for Approval', desc: 'Forward to DOP for approval', icon: Send, to: '/approvals', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Reports', desc: 'Analytics and insights', icon: Users, to: '/reports', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <QueueTable
        title="My Queue — CGM Review"
        viewLink={qs({ assignedTo: 'me' })}
        emptyMessage="No estimates pending your review"
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
            <Link to={`/estimates/${e.EstimateID}`} onClick={ev => ev.stopPropagation()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              Review
            </Link>
          )},
        ]}
        rows={queue}
      />

      <WorkflowPosition
        title="CGM Workflow Position"
        stages={[
          { label: 'GM', count: queues.submittedCreated || 0, color: '#EA580C', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'CGM Review', count: pendingReview, color: '#9333EA', bg: 'bg-violet-50', border: 'border-violet-200', to: qs({ assignedTo: 'me' }) },
          { label: 'DOP', count: waitingForDOP, color: '#D97706', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'ED', count: metrics.awaitingED || 0, color: '#4338CA', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'MD', count: metrics.awaitingMD || 0, color: '#9333EA', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Approved', count: metrics.approvedByMe || 0, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ]}
      />
    </div>
  )
}
