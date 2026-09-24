import { FileText, CheckCircle, RotateCcw, Trophy, Hammer, CircleCheckBig, IndianRupee, FileEdit } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import { buildPipelineStages } from './pipelineConfig'

export default function ManagerDashboard({ user, queues, managerDashboard }) {
  const md = managerDashboard || {}
  const breakdown = md.statusBreakdown || []
  const ops = md.operationalMetrics || {}
  const pipeline = md.pipeline || {}
  const billsToCheck = md.billingMetrics?.pendingBillCheck || 0

  const breakdownMap = {}
  breakdown.forEach(r => { breakdownMap[r.Status] = r.count })

  const drafts = queues.drafts || 0
  const reverted = queues.reverted || 0

  const pipelineStages = buildPipelineStages(pipeline).map(s => ({ ...s, to: qs({ createdBy: 'me', stage: s.key }) }))

  return (
    <div className="manager-dashboard min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions theme="manager" actions={[
        { label: 'Prepare Estimate', desc: 'Start a new estimate draft', icon: FileEdit, to: '/estimates/new', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'My Drafts', desc: 'Estimates ready to submit', icon: FileText, to: qs({ status: 'Draft', assignedTo: 'me' }), tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400', strong: drafts > 0 },
        { label: 'Reverted Estimates', desc: 'Returned for rework', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: reverted > 0 },
      ]} />

      <EstimatePipeline
        theme="manager"
        title="Manager Workflow Position"
        viewLink={qs({ createdBy: 'me' })}
        current="Draft"
        stages={pipelineStages}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <MetricCard label="Estimates Prepared" value={ops.totalWorks || 0} icon={FileText} bg="bg-blue-600" to={qs({ createdBy: 'me' })} tip={`View all ${fmt(ops.totalWorks)} estimates`} format={fmt} />
          <MetricCard label="Approved" value={(breakdownMap.Signed || 0) + (breakdownMap.Approved || 0)} icon={CheckCircle} bg="bg-green-600" to={qs({ status: 'Signed,Approved', createdBy: 'me' })} tip="View approved & signed estimates" format={fmt} />
          <MetricCard label="Work Awarded" value={ops.awardedTenders || 0} icon={Trophy} bg="bg-teal-600" to="/tenders?status=Awarded&createdBy=me" tip={`View ${fmt(ops.awardedTenders)} awarded works`} format={fmt} />
          <MetricCard label="Work in Progress" value={ops.runningWorks || 0} icon={Hammer} bg="bg-orange-500" to={qs({ status: 'WorkStarted', createdBy: 'me' })} tip={`View ${fmt(ops.runningWorks)} running works`} format={fmt} />
          <MetricCard label="Work Completed" value={ops.completedWorks || 0} icon={CircleCheckBig} bg="bg-emerald-600" to={qs({ status: 'Completed', createdBy: 'me' })} tip={`View ${fmt(ops.completedWorks)} completed works`} format={fmt} />
          <MetricCard label="Bills to Check" value={billsToCheck} icon={IndianRupee} bg="bg-purple-600" to="/billing?owner=me" tip={`View ${fmt(billsToCheck)} bills awaiting your check`} format={fmt} />
        </div>
      </div>

      <BillingQueueSection
        title="Bills to Check"
        subtitle={`${billsToCheck} bill${billsToCheck !== 1 ? 's' : ''} awaiting your approval`}
        rows={md.billing || []}
        viewLink="/billing?owner=me"
        me={user}
      />
    </div>
  )
}