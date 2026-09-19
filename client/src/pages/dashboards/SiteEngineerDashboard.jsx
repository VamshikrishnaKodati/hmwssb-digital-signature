import { Link } from 'react-router-dom'
import { Hammer, TrendingUp, CheckCircle, ClipboardCheck } from 'lucide-react'
import { qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import StatusBadge from '../../components/shared/StatusBadge'
import { buildStages, SITE_WORKS_PIPELINE } from './pipelineConfig'

export default function SiteEngineerDashboard({ user, queues, siteEngineerDashboard }) {
  const sd = siteEngineerDashboard || {}
  const metrics = sd.metrics || {}
  const queue = sd.queue || []

  const pendingStart = metrics.pendingStart || queues.pendingStart || 0
  const inProgress = metrics.inProgress || queues.inProgress || 0
  const completedWorks = metrics.completedWorks || queues.completedWorks || 0
  const pendingMeasurements = metrics.pendingMeasurements || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Assigned Works', desc: 'View works assigned to you', icon: Hammer, to: '/progress', tileBg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200 border-l-amber-500', iconBg: 'bg-amber-500', btnBg: 'bg-amber-500 group-hover:bg-amber-600', focusRing: 'focus-visible:ring-amber-400', strong: pendingStart > 0 },
        { label: 'Start Work', desc: 'Initiate work for selected agencies', icon: CheckCircle, to: qs({ status: 'AgencySelected', assignedTo: 'me' }), tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
        { label: 'Add Progress', desc: 'Update work progress percentages', icon: TrendingUp, to: '/progress', tileBg: 'bg-orange-50 hover:bg-orange-100', border: 'border-orange-200 border-l-orange-500', iconBg: 'bg-orange-500', btnBg: 'bg-orange-500 group-hover:bg-orange-600', focusRing: 'focus-visible:ring-orange-400' },
        { label: 'Measurements', desc: 'Record and manage measurements', icon: ClipboardCheck, to: '/measurements', tileBg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200 border-l-purple-600', iconBg: 'bg-purple-600', btnBg: 'bg-purple-600 group-hover:bg-purple-700', focusRing: 'focus-visible:ring-purple-400' },
      ]} />

      <EstimatePipeline
        title="Work Execution Position"
        viewLink="/progress"
        stages={buildStages(SITE_WORKS_PIPELINE, {
          AgencySelected: pendingStart,
          WorkStarted: inProgress,
          Completed: completedWorks,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label="Pending Start" value={pendingStart} icon={Hammer} bg="bg-amber-500" to={qs({ status: 'AgencySelected', assignedTo: 'me' })} />
          <MetricCard label="In Progress" value={inProgress} icon={TrendingUp} bg="bg-orange-500" to={qs({ status: 'WorkStarted', assignedTo: 'me' })} />
          <MetricCard label="Completed" value={completedWorks} icon={CheckCircle} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'CompleteWork' })} />
          <MetricCard label="Measurements" value={pendingMeasurements} icon={ClipboardCheck} bg="bg-purple-600" to="/measurements" />
        </div>
      </div>

      {queue.length > 0 && (
        <div data-testid="dashboard-queue">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Works Assigned to You — Action Required</h2>
          <QueueTable
            viewLink="/progress"
            columns={[
              { key: 'EstimateNo', label: 'Estimate', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span> },
              { key: 'NameOfWork', label: 'Work Name', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#475569] truncate block max-w-[250px]">{e.NameOfWork}</span> },
              { key: 'AgencyName', label: 'Agency', hideOn: 'hidden md:table-cell', render: e => <span className="text-xs text-[#475569]">{e.AgencyName || e.ContractorName || '—'}</span> },
              { key: 'Status', label: 'Status', align: 'center', render: e => <StatusBadge status={e.Status} /> },
              { key: 'Progress', label: 'Progress', align: 'center', render: e => (
                e.currentProgress != null ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(Number(e.currentProgress), 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-[#475569]">{Number(e.currentProgress)}%</span>
                  </div>
                ) : <span className="text-xs text-[#94A3B8]">—</span>
              )},
              { key: 'action', label: 'Action', align: 'right', render: e => (
                <Link to={`/estimates/${e.EstimateID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                  View
                </Link>
              )},
            ]}
            rows={queue}
          />
        </div>
      )}
    </div>
  )
}