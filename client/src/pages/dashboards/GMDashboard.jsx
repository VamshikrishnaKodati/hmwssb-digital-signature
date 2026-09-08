import { Link } from 'react-router-dom'
import { Clock, RotateCcw, PenSquare, Eye, Users, CheckCircle, BarChart3, ArrowLeft } from 'lucide-react'
import { fmt, fmtCurrency, fmtDays, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import StatusBadge from '../../components/shared/StatusBadge'

export default function GMDashboard({ user, queues, gmDashboard }) {
  const gd = gmDashboard || {}
  const metrics = gd.metrics || {}
  const queue = gd.queue || []

  const pendingReview = metrics.pendingReview || queues.pendingApproval || 0
  const awaitingReview = metrics.awaitingReview || 0
  const forwarded = metrics.forwarded || 0
  const approvedToday = metrics.approvedToday || 0
  const returnsSentToday = metrics.returnsSentToday || 0
  const totalReturns = metrics.totalReturns || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {awaitingReview > 0
            ? <>{awaitingReview} estimate{awaitingReview !== 1 ? 's' : ''} ready for review (post-sanction)</>
            : pendingReview > 0
              ? <>{pendingReview} estimate{pendingReview !== 1 ? 's' : ''} awaiting your review</>
              : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending actions. All clear.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard label="Pending Review" value={pendingReview + awaitingReview} icon={Clock} bg="bg-purple-600" to={qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' })} tip={`${fmt(pendingReview + awaitingReview)} estimates awaiting review`} />
          <MetricCard label="Forwarded to DGM" value={forwarded} icon={CheckCircle} bg="bg-emerald-600" to={qs({ actedBy: 'me', action: 'ApproveTS' })} tip={`${fmt(forwarded)} forwarded to DGM`} />
          <MetricCard label="Returns Sent" value={totalReturns} icon={ArrowLeft} bg="bg-amber-500" to={qs({ actedBy: 'me', action: 'ReturnTS' })} tip={`${fmt(totalReturns)} returned to Director`} />
          <MetricCard label="Approved Today" value={approvedToday} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'DigitallySign', today: true })} tip={`${fmt(approvedToday)} signed today`} />
          <MetricCard label="Reverts Sent" value={returnsSentToday} icon={RotateCcw} bg="bg-amber-600" to={qs({ actedBy: 'me', action: 'ReturnTS', today: true })} tip={`${fmt(returnsSentToday)} reverts today`} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: '/approvals', tileBg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200 border-l-purple-600', iconBg: 'bg-purple-600', btnBg: 'bg-purple-600 group-hover:bg-purple-700', focusRing: 'focus-visible:ring-purple-400', strong: pendingReview > 0 },
        { label: 'Post-Sanction Review', desc: 'Review estimates after FCN/Sanction', icon: Clock, to: '/approvals', tileBg: 'bg-orange-50 hover:bg-orange-100', border: 'border-orange-200 border-l-orange-500', iconBg: 'bg-orange-500', btnBg: 'bg-orange-500 group-hover:bg-orange-600', focusRing: 'focus-visible:ring-orange-400', strong: awaitingReview > 0 },
        { label: 'Forward to DGM', desc: 'Forward reviewed estimates to DGM', icon: CheckCircle, to: '/approvals', tileBg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-200 border-l-emerald-600', iconBg: 'bg-emerald-600', btnBg: 'bg-emerald-600 group-hover:bg-emerald-700', focusRing: 'focus-visible:ring-emerald-400' },
        { label: 'Return to Director', desc: 'Return estimates for Director rework', icon: ArrowLeft, to: '/approvals', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
        { label: 'Reports', desc: 'Analytics and insights', icon: BarChart3, to: '/reports', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <QueueTable
        title="My Queue — Pending Action"
        viewLink="/approvals"
        emptyMessage="No estimates pending your action"
        columns={[
          { key: 'EstimateNo', label: 'Estimate', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span> },
          { key: 'NameOfWork', label: 'Work Name', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[250px]">{e.NameOfWork}</span> },
          { key: 'CreatedByName', label: 'Creator', hideOn: 'hidden md:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.CreatedByName}</span> },
          { key: 'Version', label: 'Version', align: 'center', render: e => <span className="text-xs text-[#64748B]">v{e.Version}</span> },
          { key: 'Status', label: 'Status', align: 'center', hideOn: 'hidden md:table-cell', render: e => <StatusBadge status={e.Status} /> },
          { key: 'GrandTotal', label: 'Grand Total', align: 'right', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.GrandTotal)}</span> },
          { key: 'action', label: 'Action', align: 'right', render: e => (
            <Link to={`/estimates/${e.EstimateID}`} onClick={ev => ev.stopPropagation()}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${e.Status === 'DGM_Approved' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
              {e.Status === 'DGM_Approved' ? 'Sign' : e.Status === 'AdminSanctionGenerated' ? 'Review' : 'View'}
            </Link>
          )},
        ]}
        rows={queue}
      />

      <WorkflowPosition
        title="GM Workflow Position"
        stages={[
          { label: 'DGM Approve', count: pendingReview, color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'GM Review', count: awaitingReview, color: '#F97316', bg: 'bg-orange-50', border: 'border-orange-200', to: qs({ status: 'AdminSanctionGenerated', assignedTo: 'me' }) },
          { label: 'Forwarded', count: forwarded, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Returns', count: totalReturns, color: '#D97706', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Signed Today', count: approvedToday, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ]}
      />

      <div className="pt-2">
        <BillingQueueSection
          title="Bills Pending L3 Check — With You"
          subtitle={`${(gmDashboard.billingMetrics || {}).pendingBillCheck || 0} in your queue · ${(gmDashboard.billingMetrics || {}).checkedToday || 0} checked today · ${(gmDashboard.billingMetrics || {}).returnedBills || 0} returned`}
          rows={gmDashboard.billing || []}
          viewLink="/billing?owner=me&status=DGMChecked"
          ownerMe
          me={user}
        />
      </div>
    </div>
  )
}
