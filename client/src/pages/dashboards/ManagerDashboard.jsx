import { FileText, Send, CheckCircle, RotateCcw, BarChart3, TrendingUp, Eye, Users, Hammer, DollarSign, Trophy, CircleCheckBig, Receipt, FileEdit, ArrowRight, ChevronRight, ClipboardCheck, UserCheck, Scale, ShieldCheck, BadgeCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { fmt, fmtCurrency, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import WorkflowPosition from '../../components/dashboard/WorkflowPosition'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'

export default function ManagerDashboard({ user, queues, managerDashboard }) {
  const navigate = useNavigate()
  const md = managerDashboard || {}
  const breakdown = md.statusBreakdown || []
  const downstream = md.downstream || []
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
  const attentionCount = reverted + drafts

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {attentionCount > 0
            ? <>{attentionCount} estimate{attentionCount !== 1 ? 's' : ''} need{attentionCount === 1 ? 's' : ''} your attention today.</>
            : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> You&apos;re all caught up.</span>
          }
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Needs Your Attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reverted > 0 ? (
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
              <p className="text-xs text-[#64748B] mb-2">Revision required — DGM/GM sent back with comments.</p>
              <span className="text-xs font-medium text-[#1E3A5F] group-hover:underline inline-flex items-center gap-1">
                Review now <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          ) : (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 opacity-60">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm font-medium text-[#0F172A]">Reverted Estimates</span>
              </div>
              <p className="text-xs text-[#94A3B8]">No reverted estimates. All clear.</p>
            </div>
          )}
          {drafts > 0 ? (
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
              <p className="text-xs text-[#64748B] mb-2">Draft estimates ready for DGM review submission.</p>
              <span className="text-xs font-medium text-[#1E3A5F] group-hover:underline inline-flex items-center gap-1">
                View drafts <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          ) : (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 opacity-60">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm font-medium text-[#0F172A]">Ready to Submit</span>
              </div>
              <p className="text-xs text-[#94A3B8]">No drafts pending. All submitted.</p>
            </div>
          )}
        </div>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <MetricCard label="Estimates Prepared" value={ops.totalWorks || 0} icon={FileText} bg="bg-blue-600" to={qs({ createdBy: 'me' })} tip={`View all ${fmt(ops.totalWorks)} estimates`} format={fmt} />
          <MetricCard label="Approved" value={(breakdownMap.Signed || 0) + (breakdownMap.Approved || 0)} icon={CheckCircle} bg="bg-green-600" to={qs({ status: 'Signed,Approved', createdBy: 'me' })} tip="View approved & signed estimates" format={fmt} />
          <MetricCard label="Work Awarded" value={ops.awardedTenders || 0} icon={Trophy} bg="bg-teal-600" to="/tenders?status=Awarded&createdBy=me" tip={`View ${fmt(ops.awardedTenders)} awarded works`} format={fmt} />
          <MetricCard label="Work in Progress" value={ops.runningWorks || 0} icon={Hammer} bg="bg-orange-500" to={qs({ status: 'WorkStarted', createdBy: 'me' })} tip={`View ${fmt(ops.runningWorks)} running works`} format={fmt} />
          <MetricCard label="Work Completed" value={ops.completedWorks || 0} icon={CircleCheckBig} bg="bg-emerald-600" to={qs({ status: 'Completed', createdBy: 'me' })} tip={`View ${fmt(ops.completedWorks)} completed works`} format={fmt} />
          <MetricCard label="Bill Submitted" value={ops.pendingBills || 0} icon={Receipt} bg="bg-purple-600" to="/billing?status=Submitted,ManagerApproved,DGMApproved,GMApproved&createdBy=me" tip={`View ${fmt(ops.pendingBills)} bills in workflow`} format={fmt} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Prepare Estimate', desc: 'Create and manage a new estimate', icon: FileEdit, to: '/estimates/new', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400', strong: true },
        { label: 'My Estimates', desc: 'Track all your works in one place', icon: FileText, to: '/estimates', tileBg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200 border-l-green-600', iconBg: 'bg-green-600', btnBg: 'bg-green-600 group-hover:bg-green-700', focusRing: 'focus-visible:ring-green-400' },
        { label: 'Reverted Estimates', desc: 'Fix and resubmit returned estimates', icon: RotateCcw, to: qs({ status: 'Reverted', assignedTo: 'me' }), tileBg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 border-l-red-500', iconBg: 'bg-red-500', btnBg: 'bg-red-500 group-hover:bg-red-600', focusRing: 'focus-visible:ring-red-400' },
        { label: 'Reports', desc: 'Analytics and insights', icon: BarChart3, to: '/reports', tileBg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-200 border-l-violet-600', iconBg: 'bg-violet-600', btnBg: 'bg-violet-600 group-hover:bg-violet-700', focusRing: 'focus-visible:ring-violet-400' },
      ]} />

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">My Estimate Pipeline</h2>
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
      </div>

      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Project Lifecycle Monitoring</h2>
        <p className="text-[11px] text-[#94A3B8] mb-2.5">Track approved estimates through tender, award and work execution.</p>
        <div className="bg-white rounded-lg border border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Estimate</th>
                  <th className="text-left px-4 py-2.5 hidden sm:table-cell">Work Name</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-right px-4 py-2.5">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {downstream.length > 0 ? downstream.slice(0, 10).map(e => (
                  <tr key={e.EstimateID} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer" onClick={() => navigate(`/estimates/${e.EstimateID}`)}>
                    <td className="px-4 py-2.5"><span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span></td>
                    <td className="px-4 py-2.5 hidden sm:table-cell"><span className="text-xs text-[#64748B] truncate block max-w-[250px]">{e.NameOfWork}</span></td>
                    <td className="px-4 py-2.5 text-right"><span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.GrandTotal)}</span></td>
                    <td className="px-4 py-2.5 text-right"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${downstreamColor(e.Status)}`}>{e.DownstreamLabel}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-[#94A3B8]">No estimates in the pipeline yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <BillingQueueSection
          title="Bills Pending L1 Check — With You"
          subtitle={`${(md.billingMetrics || {}).pendingBillCheck || 0} in your queue · ${(md.billingMetrics || {}).checkedToday || 0} checked today · ${(md.billingMetrics || {}).returnedBills || 0} returned`}
          rows={md.billing || []}
          viewLink="/billing?owner=me&status=SubmittedToManager,ReturnedToManager"
          ownerMe
          me={user}
        />
      </div>
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

function downstreamColor(status) {
  const map = { Completed: 'bg-green-100 text-green-700', Billing: 'bg-pink-100 text-pink-700', WorkCompleted: 'bg-orange-100 text-orange-700', WorkStarted: 'bg-amber-100 text-amber-700', AgencySelected: 'bg-teal-100 text-teal-700', TenderPublished: 'bg-cyan-100 text-cyan-700', Signed: 'bg-indigo-100 text-indigo-700', Approved: 'bg-violet-100 text-violet-700', DGM_Approved: 'bg-purple-100 text-purple-700' }
  return map[status] || 'bg-slate-100 text-slate-600'
}
