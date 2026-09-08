import { Link } from 'react-router-dom'
import { Clock, RotateCcw, Send, Eye, AlertTriangle, CheckCircle, BarChart3, PenSquare, ArrowLeft } from 'lucide-react'
import { fmt, fmtCurrency, fmtDays, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import StatusBadge from '../../components/shared/StatusBadge'

export default function DGMDashboard({ user, queues, dgmDashboard }) {
  const dd = dgmDashboard || {}
  const metrics = dd.metrics || {}
  const queue = dd.queue || []
  const escalated = dd.escalated || []
  const oldestWaiting = dd.oldestWaiting

  const pendingReview = metrics.pendingReview || queues.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || queues.reverted || 0
  const postApprovalPending = metrics.postApprovalPending || 0
  const approvedByMe = metrics.approvedByMe || 0
  const waitingForGM = metrics.waitingForGM || 0
  const returnsSent = metrics.returnsSent || 0
  const escalatedCount = metrics.escalatedReviews || escalated.length || 0
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
          <MetricCard label="Pending Review" value={pendingReview} icon={Clock} bg="bg-blue-600" to={qs({ status: 'Submitted', assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting review`} />
          <MetricCard label="Reverted" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Post-Approval" value={postApprovalPending} icon={Eye} bg="bg-emerald-600" to={qs({ status: 'TSPending,TSApproved', assignedTo: 'me' })} tip={`${fmt(postApprovalPending)} post-approval items`} />
          <MetricCard label="Approved by Me" value={approvedByMe} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'Approve' })} tip={`${fmt(approvedByMe)} estimates approved`} />
          <MetricCard label="Returns Sent" value={returnsSent} icon={ArrowLeft} bg="bg-amber-600" to={qs({ actedBy: 'me', action: 'ReturnToGM' })} tip={`${fmt(returnsSent)} returned to GM`} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Eye} bg="bg-violet-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in DGM scope`} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: '/approvals', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400', strong: pendingReview > 0 },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Return to GM', desc: 'Return post-approval items for GM rework', icon: ArrowLeft, to: '/approvals', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: postApprovalPending > 0 },
        { label: 'Approved Estimates', desc: 'View estimates you have approved', icon: CheckCircle, to: qs({ actedBy: 'me', action: 'Approve' }), tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
        { label: 'Reports', desc: 'Analytics and insights', icon: BarChart3, to: '/reports', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <QueueTable
        title="My Queue — Pending Review"
        viewLink="/approvals"
        emptyMessage="No estimates pending your review"
        columns={[
          { key: 'EstimateNo', label: 'Estimate', render: e => (
            <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}
              {Number(e.daysWaiting) > 3 && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-600">ESCALATED</span>}
            </span>
          )},
          { key: 'NameOfWork', label: 'Work Name', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[250px]">{e.NameOfWork}</span> },
          { key: 'CreatedByName', label: 'Creator', hideOn: 'hidden md:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.CreatedByName}</span> },
          { key: 'Version', label: 'Version', align: 'center', render: e => <span className="text-xs text-[#64748B]">v{e.Version}</span> },
          { key: 'Status', label: 'Status', align: 'center', hideOn: 'hidden md:table-cell', render: e => <StatusBadge status={e.Status} /> },
          { key: 'GrandTotal', label: 'Grand Total', align: 'right', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.GrandTotal)}</span> },
          { key: 'daysWaiting', label: 'Waiting', align: 'right', render: e => (
            <span className={`text-xs font-medium ${Number(e.daysWaiting) > 3 ? 'text-red-600' : Number(e.daysWaiting) > 1 ? 'text-amber-600' : 'text-[#64748B]'}`}>{fmtDays(e.daysWaiting)}</span>
          )},
          { key: 'action', label: 'Action', align: 'right', render: e => (
            <Link to={`/estimates/${e.EstimateID}`} onClick={ev => ev.stopPropagation()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors">
              Review
            </Link>
          )},
        ]}
        rows={queue}
      />

      <WorkflowPosition
        title="DGM Workflow Position"
        viewLink="/approvals"
        stages={[
          { label: 'Manager Submit', count: queues.submittedCreated || 0, color: '#2563EB', bg: 'bg-blue-50', border: 'border-blue-200', to: qs({ status: 'Submitted', createdBy: 'me' }) },
          { label: 'DGM Review', count: pendingReview, color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200', to: qs({ status: 'Submitted', assignedTo: 'me' }) },
          { label: 'GM Review', count: waitingForGM, color: '#6366F1', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'Approved', count: approvedByMe, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ]}
      />

      {escalated.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Attention Required — Escalated</h2>
          <div className="bg-white rounded-lg border border-red-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{escalated.length} estimate{escalated.length !== 1 ? 's' : ''} waiting &gt; 3 days</p>
                <p className="text-[11px] text-[#64748B]">These estimates exceed the review SLA and require immediate attention.</p>
              </div>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {escalated.slice(0, 5).map(e => (
                <Link key={e.EstimateID} to={`/estimates/${e.EstimateID}`} className="flex items-center justify-between py-2.5 hover:bg-red-50/50 transition-colors rounded px-2 -mx-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span>
                    <span className="text-xs text-[#64748B] truncate max-w-[200px]">{e.NameOfWork}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.GrandTotal)}</span>
                    <span className="text-xs font-medium text-red-600">{fmtDays(e.daysWaiting)} waiting</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="pt-2">
        <BillingQueueSection
          title="Bills Pending L2 Check — With You"
          subtitle={`${(dgmDashboard.billingMetrics || {}).pendingBillCheck || 0} in your queue · ${(dgmDashboard.billingMetrics || {}).checkedToday || 0} checked today · ${(dgmDashboard.billingMetrics || {}).returnedBills || 0} returned`}
          rows={dgmDashboard.billing || []}
          viewLink="/billing?owner=me&status=ManagerChecked,ReturnedToDGM"
          ownerMe
          me={user}
        />
      </div>
    </div>
  )
}
