import { Link } from 'react-router-dom'
import { ShieldCheck, FileCheck, Stamp, Trophy, Handshake } from 'lucide-react'
import { fmtCurrency, fmt, qs } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QueueTable from '../../components/dashboard/QueueTable'
import QuickActions from '../../components/dashboard/QuickActions'
import EstimatePipeline from '../../components/dashboard/EstimatePipeline'
import StatusBadge from '../../components/shared/StatusBadge'
import { buildStages, DIRECTOR_SANCTION_PIPELINE } from './pipelineConfig'

export default function DirectorDashboard({ user, directorAdminDashboard }) {
  const dd = directorAdminDashboard || {}
  const metrics = dd.metrics || {}
  const queue = dd.queue || []
  const tsQueue = dd.tsQueue || []
  const agencySelection = dd.agencySelection || []
  const awardPipeline = dd.awardPipeline || []

  const pendingFCN = metrics.pendingFCN || 0
  const pendingSanction = metrics.pendingSanction || 0
  const awaitingForward = metrics.awaitingForward || 0
  const fcnsGenerated = metrics.fcnsGenerated || 0
  const pendingTSApproval = metrics.pendingTSApproval || 0
  const awardPending = metrics.awardPending || 0
  const workOrderPending = metrics.workOrderPending || 0
  const agreementPending = metrics.agreementPending || 0
  const agreementsExecuted = metrics.agreementsExecuted || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <QuickActions actions={[
        { label: 'Generate FCN', desc: 'Generate FCN for final approved estimates', icon: FileCheck, to: qs({ status: 'FinalApproved', assignedTo: 'me' }), tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400', strong: pendingFCN > 0 },
        { label: 'Generate Sanction', desc: 'Generate Administrative Sanction after FCN', icon: ShieldCheck, to: qs({ status: 'FCNGenerated', assignedTo: 'me' }), tileBg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 border-l-red-600', iconBg: 'bg-red-600', btnBg: 'bg-red-600 group-hover:bg-red-700', focusRing: 'focus-visible:ring-red-400', strong: pendingSanction > 0 },
        { label: 'Approve TS', desc: 'Approve Technical Sanctions assigned to you', icon: Stamp, to: qs({ status: 'TSPending', assignedTo: 'me' }), tileBg: 'bg-indigo-50 hover:bg-indigo-100', border: 'border-indigo-200 border-l-indigo-600', iconBg: 'bg-indigo-600', btnBg: 'bg-indigo-600 group-hover:bg-indigo-700', focusRing: 'focus-visible:ring-indigo-400', strong: pendingTSApproval > 0 },
      ]} />

      <EstimatePipeline
        title="Sanction & Award Workflow Position"
        viewLink={qs({ assignedTo: 'me' })}
        stages={buildStages(DIRECTOR_SANCTION_PIPELINE, {
          PendingFCN: pendingFCN,
          PendingSanction: pendingSanction,
          AwaitingForward: awaitingForward,
          TSApproval: pendingTSApproval,
          Award: awardPending,
          WorkOrder: workOrderPending,
          Agreement: agreementPending,
        })}
      />

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending FCN" value={pendingFCN} icon={FileCheck} bg="bg-blue-600" to={qs({ status: 'FinalApproved', assignedTo: 'me' })} tip={`${fmt(pendingFCN)} estimates awaiting FCN generation`} />
          <MetricCard label="Pending Sanction" value={pendingSanction} icon={ShieldCheck} bg="bg-red-600" to={qs({ status: 'FCNGenerated', assignedTo: 'me' })} tip={`${fmt(pendingSanction)} estimates needing Administrative Sanction`} />
          <MetricCard label="TS Approval" value={pendingTSApproval} icon={Stamp} bg="bg-indigo-600" to={qs({ status: 'TSPending', assignedTo: 'me' })} tip={`${fmt(pendingTSApproval)} technical sanctions to approve`} />
          <MetricCard label="FCNs Generated" value={fcnsGenerated} icon={FileCheck} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'GenerateFCN' })} tip={`${fmt(fcnsGenerated)} FCNs generated`} />
          <MetricCard label="Awards Pending" value={awardPending} icon={Trophy} bg="bg-teal-600" to="/tenders?status=L1Identified" tip={`${fmt(awardPending)} tenders awaiting your award`} />
          <MetricCard label="Agreements Executed" value={agreementsExecuted} icon={Handshake} bg="bg-green-600" to="/tenders?status=AgreementExecuted" tip={`${fmt(agreementsExecuted)} works fully executed`} />
        </div>
      </div>

      {queue.length > 0 && (
        <div data-testid="queue-table">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Sanction — Action Required</h2>
          <QueueTable
            rows={queue}
            columns={[
              { key: 'EstimateNo', label: 'Estimate No', render: (r) => (
                <span className="font-medium text-[#1E293B]">{r.EstimateNo}</span>
              )},
              { key: 'NameOfWork', label: 'Work', render: (r) => (
                <span className="text-[#475569] truncate max-w-[200px] block">{r.NameOfWork}</span>
              )},
              { key: 'GrandTotal', label: 'Amount', render: (r) => fmtCurrency(r.GrandTotal) },
              { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={r.Status} /> },
              { key: 'daysWaiting', label: 'Days', render: (r) => (
                <span className="text-[#475569]">{Math.round(r.daysWaiting || 0)}d</span>
              )},
            ]}
            emptyMessage="No estimates pending FCN or Administrative Sanction"
          />
        </div>
      )}

      {tsQueue.length > 0 && (
        <div data-testid="ts-queue-table">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Technical Sanction — Pending Approval</h2>
          <QueueTable
            rows={tsQueue}
            columns={[
              { key: 'EstimateNo', label: 'Estimate No', render: (r) => (
                <span className="font-medium text-[#1E293B]">{r.EstimateNo}</span>
              )},
              { key: 'NameOfWork', label: 'Work', render: (r) => (
                <span className="text-[#475569] truncate max-w-[200px] block">{r.NameOfWork}</span>
              )},
              { key: 'GrandTotal', label: 'Amount', render: (r) => fmtCurrency(r.GrandTotal) },
              { key: 'TSStatus', label: 'TS Status', render: (r) => <StatusBadge status={r.TSStatus || 'TSPending'} /> },
              { key: 'action', label: 'Action', align: 'right', render: (r) => (
                <Link to={`/estimates/${r.EstimateID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                  Open to approve
                </Link>
              )},
            ]}
            emptyMessage="No technical sanctions pending your approval"
          />
        </div>
      )}

      {agencySelection.length > 0 && (
        <div data-testid="agency-selection-queue">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Agency Selection — Pending</h2>
          <QueueTable
            rows={agencySelection}
            columns={[
              { key: 'EstimateNo', label: 'Estimate No', render: (r) => (
                <span className="font-medium text-[#1E293B]">{r.EstimateNo}</span>
              )},
              { key: 'NameOfWork', label: 'Work', render: (r) => (
                <span className="text-[#475569] truncate max-w-[200px] block">{r.NameOfWork}</span>
              )},
              { key: 'GrandTotal', label: 'Amount', render: (r) => fmtCurrency(r.GrandTotal) },
              { key: 'TenderNo', label: 'Tender No', render: (r) => r.TenderNo || '-' },
              { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={r.Status} /> },
              { key: 'action', label: 'Action', align: 'right', render: (r) => (
                <Link to={`/estimates/${r.EstimateID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                  Open to select
                </Link>
              )},
            ]}
            emptyMessage="No estimates pending agency selection"
          />
        </div>
      )}

      {awardPipeline.length > 0 && (
        <div data-testid="award-pipeline-queue">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2.5">Tender Award — Action Required</h2>
          <QueueTable
            rows={awardPipeline}
            columns={[
              { key: 'TenderNo', label: 'Tender No', render: (r) => <span className="font-medium text-[#1E293B]">{r.TenderNo}</span> },
              { key: 'NameOfWork', label: 'Work', render: (r) => <span className="text-[#475569] truncate max-w-[200px] block">{r.NameOfWork}</span> },
              { key: 'L1Bidder', label: 'L1 Bidder', render: (r) => <span className="text-[#475569]">{r.L1Bidder || '—'}</span> },
              { key: 'L1Amount', label: 'L1 Amount', render: (r) => {
                const a = parseFloat(r.L1Amount)
                return isNaN(a) ? '—' : fmtCurrency(a)
              }},
              { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={r.Status} /> },
              { key: 'action', label: 'Action', align: 'right', render: (r) => (
                <Link to={`/tenders/${r.TenderID}`} onClick={ev => ev.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                  Open to act
                </Link>
              )},
            ]}
            emptyMessage="No tenders awaiting Director award action"
          />
        </div>
      )}
    </div>
  )
}