import { Clock, RotateCcw, CheckCircle, ArrowLeft, Eye } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import AttentionRequired from '../../components/dashboard/AttentionRequired'
import { buildPipelineStages } from './pipelineConfig'

export default function GMDashboard({ user, queues, gmDashboard }) {
  const gd = gmDashboard || {}
  const metrics = gd.metrics || {}
  const pipeline = gd.pipeline || {}
  const escalated = gd.escalated || []
  const billsToCheck = gd.billingMetrics?.pendingBillCheck || 0

  const pendingReview = metrics.pendingReview || queues.pendingApproval || 0
  const awaitingReview = metrics.awaitingReview || 0
  const forwarded = metrics.forwarded || 0
  const approvedToday = metrics.approvedToday || 0
  const returnsSentToday = metrics.returnsSentToday || 0
  const totalReturns = metrics.totalReturns || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' }), tileBg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200 border-l-purple-600', iconBg: 'bg-purple-600', btnBg: 'bg-purple-600 group-hover:bg-purple-700', focusRing: 'focus-visible:ring-purple-400', strong: pendingReview > 0 },
        { label: 'Post-Sanction Review', desc: 'Review estimates after FCN/Sanction', icon: Clock, to: qs({ status: 'TSPending', assignedTo: 'me' }), tileBg: 'bg-orange-50 hover:bg-orange-100', border: 'border-orange-200 border-l-orange-500', iconBg: 'bg-orange-500', btnBg: 'bg-orange-500 group-hover:bg-orange-600', focusRing: 'focus-visible:ring-orange-400', strong: awaitingReview > 0 },
        { label: 'Forward to DGM', desc: 'Forward reviewed estimates to DGM', icon: CheckCircle, to: qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' }), tileBg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-200 border-l-emerald-600', iconBg: 'bg-emerald-600', btnBg: 'bg-emerald-600 group-hover:bg-emerald-700', focusRing: 'focus-visible:ring-emerald-400' },
        { label: 'Return to Director', desc: 'Return estimates for Director rework', icon: ArrowLeft, to: qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <EstimatePipeline
        title="GM Workflow Position"
        viewLink={qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' })}
        current="GM"
        stages={buildPipelineStages(pipeline)}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard label="Pending Review" value={pendingReview + awaitingReview} icon={Clock} bg="bg-purple-600" to={qs({ status: 'DGM_Approved,Approved,TSPending', assignedTo: 'me' })} tip={`${fmt(pendingReview + awaitingReview)} estimates awaiting review`} />
          <MetricCard label="Forwarded to DGM" value={forwarded} icon={CheckCircle} bg="bg-emerald-600" to={qs({ actedBy: 'me', action: 'ApproveTS' })} tip={`${fmt(forwarded)} forwarded to DGM`} />
          <MetricCard label="Returns Sent" value={totalReturns} icon={ArrowLeft} bg="bg-amber-500" to={qs({ actedBy: 'me', action: 'ReturnTS' })} tip={`${fmt(totalReturns)} returned to Director`} />
          <MetricCard label="Approved Today" value={approvedToday} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'DigitallySign', today: true })} tip={`${fmt(approvedToday)} signed today`} />
          <MetricCard label="Reverts Sent" value={returnsSentToday} icon={RotateCcw} bg="bg-amber-600" to={qs({ actedBy: 'me', action: 'ReturnTS', today: true })} tip={`${fmt(returnsSentToday)} reverts today`} />
          <MetricCard label="Bills to Check" value={billsToCheck} icon={CheckCircle} bg="bg-purple-600" to="/billing?owner=me" tip={`${fmt(billsToCheck)} bills awaiting your approval`} />
        </div>
      </div>

      <BillingQueueSection
        title="Bills to Check"
        subtitle={`${billsToCheck} bill${billsToCheck !== 1 ? 's' : ''} awaiting your approval`}
        rows={gd.billing || []}
        viewLink="/billing?owner=me"
        me={user}
      />

      <AttentionRequired rows={escalated} />
    </div>
  )
}