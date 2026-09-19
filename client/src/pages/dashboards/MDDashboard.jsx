import { Clock, RotateCcw, Eye, AlertTriangle, CheckCircle, Users } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import AttentionRequired from '../../components/dashboard/AttentionRequired'
import { buildPipelineStages } from './pipelineConfig'

export default function MDDashboard({ user, queues, dashboardData }) {
  const dd = dashboardData || {}
  const metrics = dd.metrics || {}
  const pipeline = dd.pipeline || {}
  const escalated = dd.escalated || []

  const pendingReview = metrics.pendingReview || 0
  const revertedToMe = metrics.revertedToMe || 0
  const approvedByMe = metrics.approvedByMe || 0
  const approvedToday = metrics.approvedToday || 0
  const escalatedCount = escalated.length || metrics.escalated || 0
  const totalInScope = metrics.totalInScope || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Final Approvals', desc: 'Open your pending approval queue', icon: Eye, to: qs({ status: 'ED_Approved', assignedTo: 'me' }), tileBg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-200 border-l-emerald-600', iconBg: 'bg-emerald-600', btnBg: 'bg-emerald-600 group-hover:bg-emerald-700', focusRing: 'focus-visible:ring-emerald-400', strong: pendingReview > 0 },
        { label: 'Approved Estimates', desc: 'View estimates you have approved', icon: CheckCircle, to: qs({ actedBy: 'me', action: 'FinalApprove' }), tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <EstimatePipeline
        title="MD Workflow Position"
        viewLink={qs({ status: 'ED_Approved', assignedTo: 'me' })}
        current="MD"
        stages={buildPipelineStages(pipeline)}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Final Approval" value={pendingReview} icon={Clock} bg="bg-emerald-600" to={qs({ status: 'ED_Approved', assignedTo: 'me' })} tip={`${fmt(pendingReview)} estimates awaiting final approval`} />
          <MetricCard label="Approved by Me" value={approvedByMe} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'FinalApprove' })} tip={`${fmt(approvedByMe)} estimates approved`} />
          <MetricCard label="Approved Today" value={approvedToday} icon={CheckCircle} bg="bg-teal-600" to={qs({ actedBy: 'me', action: 'FinalApprove', today: true })} tip={`${fmt(approvedToday)} approved today`} />
          <MetricCard label="Reverted/Returned" value={revertedToMe} icon={RotateCcw} bg="bg-amber-500" to={qs({ status: 'Reverted', assignedTo: 'me' })} tip={`${fmt(revertedToMe)} estimates reverted`} />
          <MetricCard label="Escalated" value={escalatedCount} icon={AlertTriangle} bg="bg-red-500" to={qs({ status: 'ED_Approved', assignedTo: 'me' })} tip={escalatedCount > 0 ? `${fmt(escalatedCount)} overdue approvals` : 'No escalations'} />
          <MetricCard label="In My Scope" value={totalInScope} icon={Users} bg="bg-teal-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(totalInScope)} total estimates in MD scope`} />
        </div>
      </div>

      <AttentionRequired rows={escalated} />
    </div>
  )
}