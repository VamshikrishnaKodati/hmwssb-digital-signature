import { Link } from 'react-router-dom'
import { Briefcase, FilePlus2, FileEdit, Send, Eye, BarChart3, Timer, Lock, Unlock, ClipboardCheck, Trophy, FileSignature, Handshake, FileCheck } from 'lucide-react'
import { getGreeting, fmtCurrency, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QuickActions from '../../components/dashboard/QuickActions'
import QueueTable from '../../components/dashboard/QueueTable'
import StatusBadge from '../../components/shared/StatusBadge'

// Ready-for-Tender can either be awaiting a Create or already in a draft the
// officer opened. Both stay in the eligible queue until the tender moves past
// TenderDraft (i.e. is published).
export default function TenderOfficerDashboard({ user, queues, tenderOfficerDashboard }) {
  const td = tenderOfficerDashboard || {}
  const metrics = td.metrics || {}
  const queue = td.queue || []
  const pipelineQueue = td.pipelineQueue || []

  const readyForTender = metrics.readyForTender ?? queues.readyForTender ?? 0
  const tenderDrafts = metrics.tenderDrafts ?? 0
  const published = metrics.published ?? 0
  const bidOpen = metrics.bidOpen ?? 0
  const closingSoon = metrics.closingSoon ?? 0
  const bidsClosed = metrics.bidsClosed ?? 0
  const bidOpeningInProgress = metrics.bidOpeningInProgress ?? 0
  const technicalEvaluationPending = metrics.technicalEvaluationPending ?? 0
  const underTechnicalEvaluation = metrics.underTechnicalEvaluation ?? 0
  const financialEvaluationPending = metrics.financialEvaluationPending ?? 0
  const financialEvaluation = metrics.financialEvaluation ?? 0
  const l1Identified = metrics.l1Identified ?? 0
  const workAwarded = metrics.workAwarded ?? 0
  const workOrderIssued = metrics.workOrderIssued ?? 0
  const agreementExecuted = metrics.agreementExecuted ?? 0
  const totalBids = metrics.totalBids ?? 0
  const evaluationHandoff = metrics.evaluationHandoff ?? 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {readyForTender > 0
            ? <>{readyForTender} estimate{readyForTender !== 1 ? 's' : ''} ready for tender creation</>
            : tenderDrafts > 0
              ? <>{tenderDrafts} tender draft{tenderDrafts !== 1 ? 's' : ''} in progress</>
              : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending tender actions.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Tender Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard label="Ready for Tender" value={readyForTender} icon={Briefcase} bg="bg-cyan-600" to="/tenders?view=ready" />
          <MetricCard label="Tender Drafts" value={tenderDrafts} icon={FileEdit} bg="bg-indigo-600" to="/tenders?status=TenderDraft" />
          <MetricCard label="Published" value={published} icon={Send} bg="bg-teal-600" to="/tenders?status=Published" />
          <MetricCard label="Bids Open" value={bidOpen} icon={Eye} bg="bg-amber-500" to="/tenders?status=Published" />
          <MetricCard label="Closing Soon" value={closingSoon} icon={Timer} bg="bg-orange-500" to="/tenders?status=Published" />
          <MetricCard label="Bids Closed" value={bidsClosed} icon={Lock} bg="bg-orange-600" to={`/tenders?status=BidsClosed`} />
          <MetricCard label="Bid Opening" value={bidOpeningInProgress} icon={Unlock} bg="bg-violet-600" to={`/tenders?status=BidOpeningInProgress`} />
          <MetricCard label="Ready for Tech Eval" value={technicalEvaluationPending} icon={ClipboardCheck} bg="bg-purple-600" to={`/tenders?status=TechnicalEvaluationPending`} />
          <MetricCard label="Evaluation Handoff" value={evaluationHandoff} icon={Send} bg="bg-indigo-700" to={`/tenders?status=TechnicalEvaluationPending`} />
          <MetricCard label="Under Tech Eval" value={underTechnicalEvaluation} icon={ClipboardCheck} bg="bg-fuchsia-600" to={`/tenders?status=UnderTechnicalEvaluation`} />
          <MetricCard label="Ready for Fin Eval" value={financialEvaluationPending} icon={FileSignature} bg="bg-sky-600" to={`/tenders?status=FinancialEvaluationPending`} />
          <MetricCard label="Financial Eval" value={financialEvaluation} icon={FileSignature} bg="bg-cyan-700" to={`/tenders?status=FinancialEvaluation`} />
          <MetricCard label="L1 Identified" value={l1Identified} icon={Trophy} bg="bg-teal-600" to={`/tenders?status=L1Identified`} />
          <MetricCard label="Awarded" value={workAwarded} icon={Trophy} bg="bg-emerald-600" to={`/tenders?status=WorkAwarded`} />
          <MetricCard label="Work Orders" value={workOrderIssued} icon={Handshake} bg="bg-green-600" to={`/tenders?status=WorkOrderIssued`} />
          <MetricCard label="Agreements" value={agreementExecuted} icon={FileCheck} bg="bg-slate-600" to={`/tenders?status=AgreementExecuted`} />
          <MetricCard label="Total Bids" value={totalBids} icon={BarChart3} bg="bg-slate-500" />
        </div>
      </div>

      {pipelineQueue.length > 0 && (
        <div data-testid="tender-pipeline-queue">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">My Queue — Tender Pipeline</h2>
          <QueueTable
            rows={pipelineQueue}
            emptyMessage="No tenders in the pipeline"
            columns={[
              { key: 'TenderNo', label: 'Tender No', render: (r) => <span className="text-sm font-medium text-[#0F172A]">{r.TenderNo}</span> },
              { key: 'NameOfWork', label: 'Work', render: (r) => <span className="text-xs text-[#64748B] truncate block max-w-[240px]">{r.NameOfWork}</span> },
              { key: 'BidEndDate', label: 'Bid Close', hideOn: 'hidden lg:table-cell', render: (r) => <span className="text-xs text-[#64748B]">{fmtDate(r.BidEndDate)}</span> },
              { key: 'bidCount', label: 'Bids', align: 'center', render: (r) => <span className="text-xs font-medium">{r.bidCount}</span> },
              { key: 'Status', label: 'Status', align: 'center', render: (r) => <StatusBadge status={r.Status} /> },
              { key: 'action', label: 'Action', align: 'right', render: (r) => (
                <Link to={`/tenders/${r.TenderID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Open
                </Link>
              )},
            ]}
          />
        </div>
      )}

      <QuickActions actions={[
        { label: 'Create Tender', desc: 'Start a tender draft from a TS-approved estimate', icon: FilePlus2, to: '/tenders?view=ready', tileBg: 'bg-cyan-50 hover:bg-cyan-100', border: 'border-cyan-200 border-l-cyan-600', iconBg: 'bg-cyan-600', btnBg: 'bg-cyan-600 group-hover:bg-cyan-700', focusRing: 'focus-visible:ring-cyan-400', strong: readyForTender > 0 },
        { label: 'Tender Drafts', desc: 'Continue an in-progress tender draft', icon: FileEdit, to: '/tenders?status=TenderDraft', tileBg: 'bg-indigo-50 hover:bg-indigo-100', border: 'border-indigo-200 border-l-indigo-600', iconBg: 'bg-indigo-600', btnBg: 'bg-indigo-600 group-hover:bg-indigo-700', focusRing: 'focus-visible:ring-indigo-400', strong: tenderDrafts > 0 },
        { label: 'Published Tenders', desc: 'View all published tenders', icon: Send, to: '/tenders?status=Published', tileBg: 'bg-teal-50 hover:bg-teal-100', border: 'border-teal-200 border-l-teal-600', iconBg: 'bg-teal-600', btnBg: 'bg-teal-600 group-hover:bg-teal-700', focusRing: 'focus-visible:ring-teal-400' },
      ]} />

      <QueueTable
        title="My Queue — Ready for Tender"
        viewLink="/tenders?view=ready"
        viewLabel="All ready estimates"
        emptyMessage="No estimates are ready for tender right now"
        columns={[
          { key: 'EstimateNo', label: 'Estimate No', render: e => <span className="text-sm font-medium text-[#0F172A]">{e.EstimateNo}</span> },
          { key: 'NameOfWork', label: 'Name of Work', hideOn: 'hidden sm:table-cell', render: e => <span className="text-xs text-[#64748B] truncate block max-w-[250px]">{e.NameOfWork}</span> },
          { key: 'EstimatedContractValue', label: 'Est. Contract Value', align: 'right', hideOn: 'hidden md:table-cell', render: e => <span className="text-sm font-semibold text-[#1E3A5F]">{fmtCurrency(e.EstimatedContractValue)}</span> },
          { key: 'FCNNo', label: 'FCN No', hideOn: 'hidden lg:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.FCNNo || '—'}</span> },
          { key: 'ASNo', label: 'AS No', hideOn: 'hidden lg:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.ASNo || '—'}</span> },
          { key: 'TSNo', label: 'TS No', hideOn: 'hidden lg:table-cell', render: e => <span className="text-xs text-[#64748B]">{e.TSNo || '—'}</span> },
          { key: 'ReadyDate', label: 'Ready Date', hideOn: 'hidden xl:table-cell', render: e => <span className="text-xs text-[#64748B]">{fmtDate(e.ReadyDate)}</span> },
          { key: 'TenderStatus', label: 'Status', align: 'center', render: e => <StatusBadge status={e.TenderStatus || 'ReadyForTender'} /> },
          { key: 'action', label: 'Action', align: 'right', render: e => (
            e.TenderID
              ? <Link to={`/tenders/${e.TenderID}/edit`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Continue Draft
                </Link>
              : <Link to={`/tenders/new?estimate=${e.EstimateID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors">
                  Create Tender
                </Link>
          )},
        ]}
        rows={queue}
      />
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}