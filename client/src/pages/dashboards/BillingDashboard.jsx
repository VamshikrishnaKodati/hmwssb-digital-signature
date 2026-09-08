import { Link } from 'react-router-dom'
import { FileEdit, Send, RotateCcw, BarChart3, Receipt, FilePlus2, Landmark } from 'lucide-react'
import { fmt, fmtCurrency, getGreeting } from '../../components/dashboard/utils'
import BillingQueueSection from '../../components/dashboard/BillingQueueSection'
import BillingWorkflowPipeline from '../../components/billing/BillingWorkflowPipeline'
import BillingResponsibilityHero from '../../components/billing/BillingResponsibilityHero'

export default function BillingDashboard({ user, queues, billingDashboard }) {
  const bd = billingDashboard || {}
  const metrics = bd.metrics || {}
  const queue = bd.queue || []

  const billsToPrepare = metrics.billsToPrepare || 0
  const draftBills = metrics.draftBills || 0
  const inWorkflow = metrics.submittedBills || 0
  const returnedBills = metrics.returnedBills || 0
  const amountPending = metrics.amountPending || 0

  // A draft / returned bill the Billing Officer should act on next.
  const focusBill = queue.find(b => b.Status === 'ReturnedToBiller') || queue.find(b => b.Status === 'Draft') || queue[0] || null

  const metricCards = [
    { icon: FilePlus2, bg: 'bg-blue-50', color: '#1D4ED8', label: 'Works Ready for Bill', value: fmt(billsToPrepare), sub: 'Work Completed estimates', to: '/estimates?status=WorkCompleted&assignedTo=me' },
    { icon: FileEdit, bg: 'bg-sky-50', color: '#0284C7', label: 'Draft Bills', value: fmt(draftBills), sub: 'created, not submitted', to: '/billing?status=Draft' },
    { icon: Send, bg: 'bg-violet-50', color: '#7C3AED', label: 'In Workflow', value: fmt(inWorkflow), sub: 'across approval ladder', to: '/billing?status=SubmittedToManager,ManagerChecked,DGMChecked,SubmittedToFinance' },
    { icon: RotateCcw, bg: 'bg-amber-50', color: '#D97706', label: 'Returned to You', value: fmt(returnedBills), sub: 'need correction', to: '/billing?status=ReturnedToBiller' },
    { icon: BarChart3, bg: 'bg-emerald-50', color: '#059669', label: 'Amount Pending', value: fmtCurrency(amountPending), sub: 'in active bills', to: '/billing' },
  ]

  return (
    <div className="min-w-0 space-y-5" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {returnedBills > 0
            ? <>{returnedBills} returned bill{returnedBills !== 1 ? 's' : ''} — action needed.</>
            : draftBills > 0
              ? <>{draftBills} draft bill{draftBills !== 1 ? 's' : ''} waiting to be submitted.</>
              : billsToPrepare > 0
                ? <>{billsToPrepare} work{billsToPrepare !== 1 ? 's' : ''} ready for bill preparation.</>
                : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending billing actions.</span>
          }
        </p>
      </div>

      {focusBill && (
        <>
          <BillingResponsibilityHero bill={focusBill} sla={focusBill.SlaDueAt ? { dueAt: focusBill.SlaDueAt, status: focusBill.SlaStatus, escalationLevel: focusBill.EscalationLevel } : null} me={user} />
          <BillingWorkflowPipeline status={focusBill.Status} />
        </>
      )}

      <div data-testid="operational-overview">
        <p className="bi-section-label">Billing Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {metricCards.map(m => (
            <Link key={m.label} to={m.to} className="bi-metric bi-panel-hover flex items-center gap-3">
              <span className={`bi-metric-icon ${m.bg}`}><m.icon className="w-4 h-4" style={{ color: m.color }} /></span>
              <div className="min-w-0">
                <p className="bi-metric-value text-[16px]">{m.value}</p>
                <p className="bi-metric-label">{m.label} <span className="block text-[9px] text-[#94A3B8]">{m.sub}</span></p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="bi-section-label">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { icon: Receipt, label: 'Create RA Bill', desc: 'Prepare a new running-account bill', to: '/billing', bg: 'bg-pink-50', color: '#DB2777' },
            { icon: FileEdit, label: 'Draft Bills', desc: 'View and edit draft bills', to: '/billing?status=Draft', bg: 'bg-blue-50', color: '#1D4ED8' },
            { icon: RotateCcw, label: 'Returned to Me', desc: 'Fix and resubmit returned bills', to: '/billing?status=ReturnedToBiller', bg: 'bg-amber-50', color: '#D97706' },
            { icon: Landmark, label: 'All Bills', desc: 'Track every bill through the workflow', to: '/billing', bg: 'bg-violet-50', color: '#7C3AED' },
          ].map(a => (
            <Link key={a.label} to={a.to} className="bi-metric bi-panel-hover flex items-center gap-3">
              <span className={`bi-metric-icon ${a.bg}`}><a.icon className="w-4 h-4" style={{ color: a.color }} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#0F172A] leading-tight">{a.label}</p>
                <p className="text-[10px] text-[#94A3B8] leading-snug">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <BillingQueueSection
        title="My Bills"
        subtitle={`${queue.length} bill${queue.length !== 1 ? 's' : ''} in your workspace`}
        rows={queue}
        viewLink="/billing"
        me={user}
      />
    </div>
  )
}
