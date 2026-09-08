import { Link } from 'react-router-dom'
import { BarChart3, Clock, TrendingUp, FileText, Users, CheckCircle } from 'lucide-react'
import { fmt, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'

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
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {totalEstimates > 0
            ? <>{fmt(totalEstimates)} estimate{totalEstimates !== 1 ? 's' : ''} in the system</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> System operational.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Total Estimates" value={totalEstimates} icon={BarChart3} bg="bg-slate-600" to="/estimates" />
          <MetricCard label="Today" value={todayEstimates} icon={Clock} bg="bg-blue-600" to="/estimates" />
          <MetricCard label="This Month" value={thisMonthEstimates} icon={TrendingUp} bg="bg-green-600" to="/estimates" />
          <MetricCard label="Item Master Records" value={itemMasterRecords} icon={FileText} bg="bg-violet-600" to="/items" />
          <MetricCard label="Active Estimates" value={activeEstimates} icon={CheckCircle} bg="bg-teal-600" to={qs({ scope: 'global' })} />
          <MetricCard label="Users" value={totalUsers} icon={Users} bg="bg-purple-600" to="/users" />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Item Master', desc: 'Manage SoR item master data', icon: FileText, to: '/items', tileBg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-200 border-l-violet-600', iconBg: 'bg-violet-600', btnBg: 'bg-violet-600 group-hover:bg-violet-700', focusRing: 'focus-visible:ring-violet-400' },
        { label: 'Estimates', desc: 'View all system estimates', icon: BarChart3, to: '/estimates', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Reports', desc: 'System analytics and reports', icon: TrendingUp, to: '/reports', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
        { label: 'User Management', desc: 'Manage users and roles', icon: Users, to: '/users', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <WorkflowPosition
        title="Pipeline Overview"
        stages={[
          { label: 'Draft', count: stats?.draft || 0, color: '#94A3B8', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Submitted', count: stats?.submitted || 0, color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Verified', count: stats?.dgm_approved || 0, color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Approved', count: stats?.signed || 0, color: '#4338CA', bg: 'bg-violet-50', border: 'border-violet-200' },
          { label: 'Tender', count: stats?.tender_published || 0, color: '#06B6D4', bg: 'bg-cyan-50', border: 'border-cyan-200' },
          { label: 'Work', count: stats?.work_started || 0, color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Billing', count: stats?.billing || 0, color: '#EC4899', bg: 'bg-pink-50', border: 'border-pink-200' },
          { label: 'Completed', count: stats?.completed || 0, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ]}
      />
    </div>
  )
}
