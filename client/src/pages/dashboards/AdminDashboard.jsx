import { Link } from 'react-router-dom'
import { Archive, CheckCircle, Users, Eye, ScrollText, Bell, FileText, BarChart3, ArrowRightCircle } from 'lucide-react'
import { fmt, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'

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
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {pendingArchive > 0
            ? <>{pendingArchive} estimate{pendingArchive !== 1 ? 's' : ''} awaiting archival</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> System operational. No pending actions.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">System Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending Archive" value={pendingArchive} icon={Archive} bg="bg-slate-600" to={qs({ status: 'Billing', assignedTo: 'me' })} />
          <MetricCard label="Completed" value={archived} icon={CheckCircle} bg="bg-green-600" to={qs({ status: 'Completed', assignedTo: 'me' })} />
          <MetricCard label="Total Users" value={totalUsers} icon={Users} bg="bg-blue-600" to="/users" />
          <MetricCard label="Active Users" value={activeUsers} icon={Eye} bg="bg-teal-600" to="/users" />
          <MetricCard label="Audit Events" value={todayAuditEvents} icon={ScrollText} bg="bg-purple-600" to="/audit-logs" />
          <MetricCard label="Notifications" value={unreadNotifications} icon={Bell} bg="bg-amber-500" to="/notifications" />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'User Management', desc: 'Manage users, roles, and permissions', icon: Users, to: '/users', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400' },
        { label: 'Audit Logs', desc: 'View system audit trail', icon: ScrollText, to: '/audit-logs', tileBg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200 border-l-purple-600', iconBg: 'bg-purple-600', btnBg: 'bg-purple-600 group-hover:bg-purple-700', focusRing: 'focus-visible:ring-purple-400' },
        { label: 'Master Data', desc: 'Manage item master and SoR data', icon: FileText, to: '/items', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
        { label: 'System Settings', desc: 'View reports and system health', icon: BarChart3, to: '/reports', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400' },
      ]} />

      <WorkflowPosition
        title="Works Lifecycle Overview"
        stages={[
          { label: 'Draft', count: stats.draft, color: '#94A3B8', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Submitted', count: stats.submitted, color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Verified', count: stats.dgm_approved, color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Approved', count: stats.signed, color: '#4338CA', bg: 'bg-violet-50', border: 'border-violet-200' },
          { label: 'Tender', count: stats.tender_published, color: '#06B6D4', bg: 'bg-cyan-50', border: 'border-cyan-200' },
          { label: 'Work', count: stats.work_started, color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Billing', count: stats.billing, color: '#EC4899', bg: 'bg-pink-50', border: 'border-pink-200' },
          { label: 'Completed', count: stats.completed, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ]}
      />
    </div>
  )
}
