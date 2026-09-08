import { getStatusLabel } from '../../utils/workflowMapping'

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  Reverted: 'bg-orange-50 text-orange-700 border-orange-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  DGM_Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GM_Recommended: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CGM_Submitted: 'bg-violet-50 text-violet-700 border-violet-200',
  DOP_Approved: 'bg-purple-50 text-purple-700 border-purple-200',
  ED_Approved: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  MD_Approved: 'bg-pink-50 text-pink-700 border-pink-200',
  FinalApproved: 'bg-green-600 text-white border-green-600',
  Signed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  FCNGenerated: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  AdminSanctionGenerated: 'bg-teal-50 text-teal-700 border-teal-200',
  GMReviewed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DGMReviewed: 'bg-purple-50 text-purple-700 border-purple-200',
  TSPending: 'bg-amber-50 text-amber-700 border-amber-200',
  TSApproved: 'bg-green-50 text-green-700 border-green-200',
  TenderPublished: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  TenderClosed: 'bg-orange-50 text-orange-700 border-orange-200',
  AgencySelected: 'bg-teal-50 text-teal-700 border-teal-200',
  TechnicalEvaluation: 'bg-purple-50 text-purple-700 border-purple-200',
  FinancialEvaluation: 'bg-violet-50 text-violet-700 border-violet-200',
  L1Identified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  WorkAwarded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WorkOrderIssued: 'bg-teal-50 text-teal-700 border-teal-200',
  AgreementExecuted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  WorkStarted: 'bg-amber-50 text-amber-700 border-amber-200',
  WorkCompleted: 'bg-lime-50 text-lime-700 border-lime-200',
  Billing: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  Completed: 'bg-green-600 text-white border-green-600',
  TenderDraft: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ReadyForPublication: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Published: 'bg-teal-50 text-teal-700 border-teal-200',
  BidSubmissionOpen: 'bg-amber-50 text-amber-700 border-amber-200',
  BidsClosed: 'bg-orange-50 text-orange-700 border-orange-200',
  BidOpeningPending: 'bg-orange-100 text-orange-800 border-orange-300',
  BidOpeningInProgress: 'bg-violet-50 text-violet-700 border-violet-200',
  TechnicalEvaluationPending: 'bg-purple-50 text-purple-700 border-purple-200',
  UnderTechnicalEvaluation: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  FinancialEvaluationPending: 'bg-sky-50 text-sky-700 border-sky-200',
  Awarded: 'bg-green-50 text-green-700 border-green-200',
  Inward: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SubmittedToManager: 'bg-blue-50 text-blue-700 border-blue-200',
  ManagerChecked: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ReturnedToManager: 'bg-orange-50 text-orange-700 border-orange-200',
  DGMChecked: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ReturnedToDGM: 'bg-orange-50 text-orange-700 border-orange-200',
  SubmittedToFinance: 'bg-orange-50 text-orange-700 border-orange-200',
  ReturnedToBiller: 'bg-red-50 text-red-600 border-red-200',
  Verification: 'bg-amber-50 text-amber-700 border-amber-200',
  Recommended: 'bg-blue-50 text-blue-700 border-blue-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  ChequeIssued: 'bg-teal-50 text-teal-700 border-teal-200',
}

export default function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  const label = getStatusLabel(status)
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c}`}>
      {label}
    </span>
  )
}
