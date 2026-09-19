import { Archive, CheckCircle, Users, Eye, ScrollText, Bell, FileText } from 'lucide-react'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import { buildStages, LIFECYCLE_PIPELINE } from './pipelineConfig'

export default function AdminDashboard({ user, queues, stats, adminDashboard }) {
  const ad = adminDashboard || {}
  const metrics = ad.metrics || {}

  const pendingArchive = queues.pendingArchive || 0
  const archived = queues.archived || 0
  const totalUsers = metrics.totalUsers || 0
  const activeUsers = metrics.activeUsers || 0
  const todayAuditEvents = metrics.todayAuditEvents || 0
  const unreadNotifications = metrics.unreadNotifications || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'User Management', desc: 'Manage users, roles, and permissions', icon: Users, to: '/users', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Audit Logs', desc: 'View system audit trail', icon: ScrollText, to: '/audit-logs', tileBg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200 border-l-purple-600', iconBg: 'bg-purple-600', btnBg: 'bg-purple-600 group-hover:bg-purple-700', focusRing: 'focus-visible:ring-purple-400' },
        { label: 'Master Data', desc: 'Manage item master and SoR data', icon: FileText, to: '/items', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <EstimatePipeline
        title="Works Lifecycle Position"
        viewLink="/estimates"
        stages={buildStages(LIFECYCLE_PIPELINE, {
          Draft: stats.draft,
          Submitted: stats.submitted,
          Verified: stats.dgm_approved,
          Approved: stats.signed,
          Tender: stats.tender_published,
          Work: stats.work_started,
          Billing: stats.billing,
          Completed: stats.completed,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">System Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Archive" value={pendingArchive} icon={Archive} bg="bg-slate-600" to={qs({ status: 'Billing', assignedTo: 'me' })} />
          <MetricCard label="Completed" value={archived} icon={CheckCircle} bg="bg-green-600" to={qs({ status: 'Completed', assignedTo: 'me' })} />
          <MetricCard label="Total Users" value={totalUsers} icon={Users} bg="bg-blue-600" to="/users" />
          <MetricCard label="Active Users" value={activeUsers} icon={Eye} bg="bg-teal-600" to="/users" />
          <MetricCard label="Audit Events" value={todayAuditEvents} icon={ScrollText} bg="bg-purple-600" to="/audit-logs" />
          <MetricCard label="Notifications" value={unreadNotifications} icon={Bell} bg="bg-amber-500" to="/notifications" />
        </div>
      </div>

      {pendingArchive > 0 && (
        <div data-testid="dashboard-queue">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Archival — Action Required</h2>
          <p className="text-sm text-[#475569]">{fmt(pendingArchive)} estimate{pendingArchive !== 1 ? 's' : ''} waiting to be archived.</p>
        </div>
      )}
    </div>
  )
}