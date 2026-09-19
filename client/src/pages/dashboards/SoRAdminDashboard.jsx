import { BarChart3, Clock, TrendingUp, FileText, Users, CheckCircle } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import { buildStages, LIFECYCLE_PIPELINE } from './pipelineConfig'

export default function SoRAdminDashboard({ user, queues, stats, dashboardData }) {
  const sd = dashboardData || {}
  const metrics = sd.metrics || {}

  const totalEstimates = stats?.total || 0
  const todayEstimates = stats?.today || 0
  const thisMonthEstimates = stats?.this_month || 0
  const itemMasterRecords = metrics.itemMasterRecords || 0
  const activeEstimates = metrics.activeEstimates || 0
  const totalUsers = metrics.totalUsers || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Item Master', desc: 'Manage SoR item master data', icon: FileText, to: '/items', tileBg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-200 border-l-violet-600', iconBg: 'bg-violet-600', btnBg: 'bg-violet-600 group-hover:bg-violet-700', focusRing: 'focus-visible:ring-violet-400' },
        { label: 'Estimates', desc: 'View all system estimates', icon: BarChart3, to: '/estimates', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'User Management', desc: 'Manage users and roles', icon: Users, to: '/users', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <EstimatePipeline
        title="Works Lifecycle Position"
        viewLink="/estimates"
        stages={buildStages(LIFECYCLE_PIPELINE, {
          Draft: stats?.draft || 0,
          Submitted: stats?.submitted || 0,
          Verified: stats?.dgm_approved || 0,
          Approved: stats?.signed || 0,
          Tender: stats?.tender_published || 0,
          Work: stats?.work_started || 0,
          Billing: stats?.billing || 0,
          Completed: stats?.completed || 0,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Total Estimates" value={totalEstimates} icon={BarChart3} bg="bg-slate-600" to="/estimates" />
          <MetricCard label="Today" value={todayEstimates} icon={Clock} bg="bg-blue-600" to="/estimates" />
          <MetricCard label="This Month" value={thisMonthEstimates} icon={TrendingUp} bg="bg-green-600" to="/estimates" />
          <MetricCard label="Item Master Records" value={itemMasterRecords} icon={FileText} bg="bg-violet-600" to="/items" />
          <MetricCard label="Active Estimates" value={activeEstimates} icon={CheckCircle} bg="bg-teal-600" to={qs({ scope: 'global' })} />
          <MetricCard label="Users" value={totalUsers} icon={Users} bg="bg-purple-600" to="/users" />
        </div>
      </div>
    </div>
  )
}