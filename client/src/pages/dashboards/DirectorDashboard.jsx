import { Link } from 'react-router-dom'
import { ShieldCheck, FileCheck, Send, AlertTriangle, Stamp, ClipboardCheck, Trophy, FileSignature, Handshake } from 'lucide-react'
import { fmtCurrency, fmt, qs, getGreeting } from '../../components/dashboard/utils'
import MetricCard from '../../components/dashboard/MetricCard'
import QueueTable from '../../components/dashboard/QueueTable'
import QuickActions from '../../components/dashboard/QuickActions'
import StatusBadge from '../../components/shared/StatusBadge'

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
  const escalated = metrics.escalated || 0
  const awardPending = metrics.awardPending || 0
  const workOrderPending = metrics.workOrderPending || 0
  const agreementPending = metrics.agreementPending || 0
  const agreementsExecuted = metrics.agreementsExecuted || 0

  return (
    <div className="min-w-0 space-y-6" data-testid="dashboard-shell">
      <div data-testid="dashboard-greeting">
        <h1 className="ec-page-title">{getGreeting()}, {user.Name || user.Username}</h1>
        <p className="ec-page-subtitle">
          {pendingFCN > 0
            ? <>{pendingFCN} estimate{pendingFCN !== 1 ? 's' : ''} pending FCN generation</>
            : pendingSanction > 0
              ? <>{pendingSanction} estimate{pendingSanction !== 1 ? 's' : ''} pending Administrative Sanction</>
              : pendingTSApproval > 0
                ? <>{pendingTSApproval} estimate{pendingTSApproval !== 1 ? 's' : ''} pending TS approval</>
                : <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="w-2 h-2 bg-white rounded-full" /></span> No pending items.</span>
          }
        </p>
      </div>

      <div data-testid="operational-overview">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Operational Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard label="Pending FCN" value={pendingFCN} icon={FileCheck} bg="bg-blue-600" to={qs({ status: 'FinalApproved', assignedTo: 'me' })} tip={`${fmt(pendingFCN)} estimates awaiting FCN generation`} />
          <MetricCard label="Pending Sanction" value={pendingSanction} icon={ShieldCheck} bg="bg-red-600" to={qs({ status: 'FCNGenerated', assignedTo: 'me' })} tip={`${fmt(pendingSanction)} estimates needing Administrative Sanction`} />
          <MetricCard label="Awaiting Forward" value={awaitingForward} icon={Send} bg="bg-amber-500" to={qs({ status: 'AdminSanctionGenerated', assignedTo: 'me' })} tip={`${fmt(awaitingForward)} sanctioned estimates`} />
          <MetricCard label="TS Approval" value={pendingTSApproval} icon={ClipboardCheck} bg="bg-indigo-600" to={qs({ status: 'TSPending', assignedTo: 'me' })} tip={`${fmt(pendingTSApproval)} technical sanctions to approve`} />
          <MetricCard label="FCNs Generated" value={fcnsGenerated} icon={FileCheck} bg="bg-green-600" to={qs({ actedBy: 'me', action: 'GenerateFCN' })} tip={`${fmt(fcnsGenerated)} FCNs generated`} />
          <MetricCard label="Escalated" value={escalated} icon={AlertTriangle} bg="bg-purple-600" to={qs({ assignedTo: 'me' })} tip={`${fmt(escalated)} overdue / escalated items`} />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Tender Award Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard label="Awards Pending" value={awardPending} icon={Trophy} bg="bg-teal-600" to={`/tenders?status=L1Identified`} tip={`${fmt(awardPending)} tenders with L1 identified, awaiting your award`} />
          <MetricCard label="Work Orders Pending" value={workOrderPending} icon={FileSignature} bg="bg-amber-500" to={`/tenders?status=WorkAwarded`} tip={`${fmt(workOrderPending)} awarded works awaiting work order`} />
          <MetricCard label="Agreements Pending" value={agreementPending} icon={Handshake} bg="bg-orange-500" to={`/tenders?status=WorkOrderIssued`} tip={`${fmt(agreementPending)} works awaiting agreement`} />
          <MetricCard label="Agreements Executed" value={agreementsExecuted} icon={FileCheck} bg="bg-green-600" to={`/tenders?status=AgreementExecuted`} tip={`${fmt(agreementsExecuted)} works fully executed`} />
        </div>
      </div>

      <QuickActions actions={[
        { label: 'Generate FCN', desc: 'Generate FCN for final approved estimates', icon: FileCheck, to: '/estimates', tileBg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 border-l-blue-600', iconBg: 'bg-blue-600', btnBg: 'bg-blue-600 group-hover:bg-blue-700', focusRing: 'focus-visible:ring-blue-400', strong: pendingFCN > 0 },
        { label: 'Generate Sanction', desc: 'Generate Administrative Sanction after FCN', icon: ShieldCheck, to: '/estimates', tileBg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 border-l-red-600', iconBg: 'bg-red-600', btnBg: 'bg-red-600 group-hover:bg-red-700', focusRing: 'focus-visible:ring-red-400', strong: pendingSanction > 0 },
        { label: 'Approve TS', desc: 'Approve Technical Sanctions assigned to you', icon: Stamp, to: '/estimates', tileBg: 'bg-indigo-50 hover:bg-indigo-100', border: 'border-indigo-200 border-l-indigo-600', iconBg: 'bg-indigo-600', btnBg: 'bg-indigo-600 group-hover:bg-indigo-700', focusRing: 'focus-visible:ring-indigo-400', strong: pendingTSApproval > 0 },
      ]} />

      {queue.length > 0 && (
        <div data-testid="queue-table">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Procurement / Sanction Queue</h2>
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
              { key: 'FCNNo', label: 'FCN No', render: (r) => r.FCNNo || '-' },
              { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={r.Status} /> },
              { key: 'daysWaiting', label: 'Days', render: (r) => (
                <span className="text-[#64748B]">{Math.round(r.daysWaiting || 0)}d</span>
              )},
            ]}
            emptyMessage="No estimates pending FCN or Administrative Sanction"
          />
        </div>
      )}

      {tsQueue.length > 0 && (
        <div data-testid="ts-queue-table">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Technical Sanction — Pending Approval</h2>
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
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Agency Selection — Pending</h2>
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
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Tender Award Pipeline — Action Required</h2>
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
