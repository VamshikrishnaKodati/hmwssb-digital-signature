import { Clock, RotateCcw, Send, Eye, AlertTriangle, Users } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import AttentionRequired from '../../components/dashboard/AttentionRequired'
import { buildPipelineStages } from './pipelineConfig'

export default function CGMDashboard({ user, queues, dashboardData }) {
  const dd = dashboardData || {}
  const metrics = dd.metrics || {}
  const pipeline = dd.pipeline || {}
  const escalated = dd.escalated || []

  const pendingReview = metrics.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || 0
  const submittedForApproval = metrics.submittedForApproval || 0
  const waitingForDOP = metrics.waitingForNext || 0
  const escalatedCount = escalated.length || metrics.escalated || 0
  const totalInScope = metrics.totalInScope || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Review Estimates', desc: 'Open your pending review queue', icon: Eye, to: qs({ assignedTo: 'me' }), tileBg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-200 border-l-violet-600', iconBg: 'bg-violet-600', btnBg: 'bg-violet-600 group-hover:bg-violet-700', focusRing: 'focus-visible:ring-violet-400', strong: pendingReview > 0 },
        { label: 'Submit for Approval', desc: 'Forward to DOP for approval', icon: Send, to: qs({ status: 'GM_Recommended', assignedTo: 'me' }), tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <EstimatePipeline
        title="CGM Workflow Position"
        viewLink={qs({ assignedTo: 'me' })}
        current="CGM"
        stages={buildPipelineStages(pipeline)}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending CGM Review" value={pendingReview} icon={Clock} bg="bg-violet-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting review`} />
          <MetricCard label="Reverted/Returned" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Submitted for Approval" value={submittedForApproval} icon={Send} bg="bg-blue-600" to={qs({ status: 'CGM_Submitted', scope: 'global' })} tip={`${fmt(submittedForApproval)} submitted for approval`} />
          <MetricCard label="Waiting for DOP" value={waitingForDOP} icon={Eye} bg="bg-indigo-600" to={qs({ status: 'CGM_Submitted', scope: 'global' })} tip={`${fmt(waitingForDOP)} awaiting DOP action`} />
          <MetricCard label="Escalated" value={escalatedCount} icon={AlertTriangle} bg="bg-red-500" to={qs({ assignedTo: 'me' })} tip={escalatedCount > 0 ? `${fmt(escalatedCount)} overdue reviews` : 'No escalations'} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Users} bg="bg-teal-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in CGM scope`} />
        </div>
      </div>

      <AttentionRequired rows={escalated} />
    </div>
  )
}