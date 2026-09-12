import { FileText, CheckCircle, RotateCcw, Users, Hammer, Trophy, CircleCheckBig, Receipt, FileEdit, ArrowRight, ChevronRight, ClipboardCheck, UserCheck, Scale, ShieldCheck, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'

export default function ManagerDashboard({ queues, managerDashboard }) {
  const md = managerDashboard || {}
  const breakdown = md.statusBreakdown || []
  const ops = md.operationalMetrics || {}
  const pipeline = md.pipeline || {}

  const pipelineStages = [
    { key: 'Draft', label: 'Draft', sub: 'Preparation', icon: FileText, num: '#1D4ED8', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400' },
    { key: 'DGM', label: 'DGM', sub: 'Verification', icon: ClipboardCheck, num: '#0F766E', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400' },
    { key: 'GM', label: 'GM', sub: 'Recommendation', icon: UserCheck, num: '#EA580C', bg: 'bg-orange-50', bgOn: 'bg-orange-100', bd: 'border-orange-200', bdOn: 'border-orange-400' },
    { key: 'CGM', label: 'CGM', sub: 'Submit for Approval', icon: Users, num: '#9333EA', bg: 'bg-purple-50', bgOn: 'bg-purple-100', bd: 'border-purple-200', bdOn: 'border-purple-400' },
    { key: 'DOP', label: 'DOP', sub: 'Approval', icon: Scale, num: '#D97706', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400' },
    { key: 'ED', label: 'ED', sub: 'Approval', icon: ShieldCheck, num: '#4338CA', bg: 'bg-indigo-50', bgOn: 'bg-indigo-100', bd: 'border-indigo-200', bdOn: 'border-indigo-400' },
    { key: 'MD', label: 'MD', sub: 'Final Approval', icon: BadgeCheck, num: '#9333EA', bg: 'bg-violet-50', bgOn: 'bg-violet-100', bd: 'border-violet-200', bdOn: 'border-violet-400' },
    { key: 'Approved', label: 'Approved', sub: 'Completed', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400' },
  ].map(s => ({ ...s, count: pipeline[s.key] ?? 0, to: qs({ createdBy: 'me', stage: s.key }) }))

  const breakdownMap = {}
  breakdown.forEach(r => { breakdownMap[r.Status] = r.count })

  const drafts = queues.drafts || 0
  const reverted = queues.reverted || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Needs Your Attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/estimates/new"
            className="bg-white rounded-lg border border-[#E2E8F0] p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileEdit className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-[#0F172A]">Prepare Estimate</span>
            </div>
            <p className="text-xs text-[#64748B] mb-2">Create and manage a new estimate for your assigned works.</p>
            <span className="text-xs font-medium text-[#1E3A5F] group-hover:underline inline-flex items-center gap-1">
              Start new estimate <ChevronRight className="w-3 h-3" />
            </span>
          </Link>

          <Link to={qs({ status: 'Draft', assignedTo: 'me' })}
            className="bg-white rounded-lg border border-[#E2E8F0] p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-[#0F172A]">Ready to Submit</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">{fmt(drafts)}</span>
            </div>
            <p className="text-xs text-[#64748B] mb-2">Draft estimates ready for DGM review.</p>
            <span className="text-xs font-medium text-[#1E3A5F] group-hover:underline inline-flex items-center gap-1">
              View drafts <ChevronRight className="w-3 h-3" />
            </span>
          </Link>

          <Link to={qs({ status: 'Reverted', assignedTo: 'me' })}
            className="bg-white rounded-lg border border-[#E2E8F0] p-4 hover:border-red-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-medium text-[#0F172A]">Reverted Estimates</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{fmt(reverted)}</span>
            </div>
            <p className="text-xs text-[#64748B] mb-2">Returned by DGM/GM for correction.</p>
            <span className="text-xs font-medium text-[#1E3A5F] group-hover:underline inline-flex items-center gap-1">
              Review now <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="pipeline-heading">
        <div className="flex items-center justify-between mb-2.5">
          <h2 id="pipeline-heading" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">My Estimate Pipeline</h2>
          <Link to="/estimates" className="text-xs text-[#1E3A5F] hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-[11px] text-[#94A3B8] mb-2.5 -mt-1">Estimates Currently With — click a stage to open the matching filtered list.</p>
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-stretch gap-1.5 w-max lg:w-full min-w-max lg:min-w-0">
            {pipelineStages.map((s, i) => (
              <div key={s.key} className="contents">
                <PipelineStageCard s={s} fmt={fmt} />
                {i < pipelineStages.length - 1 && (
                  <div className="self-stretch flex items-center shrink-0" aria-hidden="true">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="operational-heading" data-testid="operational-overview">
        <h2 id="operational-heading" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <MetricCard label="Estimates Prepared" value={ops.totalWorks || 0} icon={FileText} bg="bg-blue-600" to={qs({ createdBy: 'me' })} tip={`View all ${fmt(ops.totalWorks)} estimates`} format={fmt} />
          <MetricCard label="Approved" value={(breakdownMap.Signed || 0) + (breakdownMap.Approved || 0)} icon={CheckCircle} bg="bg-green-600" to={qs({ status: 'Signed,Approved', createdBy: 'me' })} tip="View approved & signed estimates" format={fmt} />
          <MetricCard label="Work Awarded" value={ops.awardedTenders || 0} icon={Trophy} bg="bg-teal-600" to="/tenders?status=Awarded&createdBy=me" tip={`View ${fmt(ops.awardedTenders)} awarded works`} format={fmt} />
          <MetricCard label="Work in Progress" value={ops.runningWorks || 0} icon={Hammer} bg="bg-orange-500" to={qs({ status: 'WorkStarted', createdBy: 'me' })} tip={`View ${fmt(ops.runningWorks)} running works`} format={fmt} />
          <MetricCard label="Work Completed" value={ops.completedWorks || 0} icon={CircleCheckBig} bg="bg-emerald-600" to={qs({ status: 'Completed', createdBy: 'me' })} tip={`View ${fmt(ops.completedWorks)} completed works`} format={fmt} />
          <MetricCard label="Bill Submitted" value={ops.pendingBills || 0} icon={Receipt} bg="bg-purple-600" to="/billing?status=Submitted,ManagerApproved,DGMApproved,GMApproved&createdBy=me" tip={`View ${fmt(ops.pendingBills)} bills in workflow`} format={fmt} />
        </div>
      </section>
    </div>
  )
}

function PipelineStageCard({ s, fmt }) {
  const on = s.count > 0
  return (
    <Link to={s.to} title={`${s.label} — ${fmt(s.count)} estimates`} aria-label={`${s.label} — ${fmt(s.count)} estimates`}
      className={`relative flex flex-col items-center justify-center w-[134px] lg:w-auto lg:min-w-[118px] lg:flex-1 h-[112px] px-1.5 shrink-0 rounded-lg border ${on ? `${s.bgOn} ${s.bdOn} shadow-sm` : `${s.bg} ${s.bd}`} hover:-translate-y-px hover:shadow-sm cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 min-w-0`}>
      {on && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: s.num }} aria-hidden="true" />}
      <s.icon className="w-5 h-5 mb-1.5 shrink-0" style={{ color: s.num }} strokeWidth={2.2} aria-hidden="true" />
      <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide leading-none">{s.label}</p>
      <p className={`text-xl font-bold leading-none mt-1.5 ${on ? '' : 'text-slate-400'}`} style={on ? { color: s.num } : undefined}>{fmt(s.count)}</p>
      <p className="text-[10px] text-[#64748B] mt-1 leading-tight text-center">{s.sub}</p>
    </Link>
  )
}