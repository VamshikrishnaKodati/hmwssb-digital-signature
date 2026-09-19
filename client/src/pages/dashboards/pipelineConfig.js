import { FileText, ClipboardCheck, UserCheck, Users, Scale, ShieldCheck, BadgeCheck, CheckCircle, Briefcase, FileEdit, Send, Lock, FileSignature, Trophy, Handshake, FileCheck, Hammer, Receipt, RotateCcw, Inbox, Banknote } from 'lucide-react'
import { qs } from '../../components/dashboard/utils'

// Single authoritative 8-stage approval pipeline shared by the GM/CGM/DOP/ED/MD
// dashboards (DGM's dashboard draws the same stages). Counts and per-stage
// click-through come from the backend (pipeline object + ?stage=<key>), never
// hard-coded here.
export const APPROVAL_PIPELINE = [
  { key: 'Draft', label: 'Manager', sub: 'Submit / Preparation', icon: FileText, num: '#1D4ED8', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400' },
  { key: 'DGM', label: 'DGM', sub: 'Verification', icon: ClipboardCheck, num: '#0F766E', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400' },
  { key: 'GM', label: 'GM', sub: 'Recommendation', icon: UserCheck, num: '#EA580C', bg: 'bg-orange-50', bgOn: 'bg-orange-100', bd: 'border-orange-200', bdOn: 'border-orange-400' },
  { key: 'CGM', label: 'CGM', sub: 'Submission', icon: Users, num: '#9333EA', bg: 'bg-purple-50', bgOn: 'bg-purple-100', bd: 'border-purple-200', bdOn: 'border-purple-400' },
  { key: 'DOP', label: 'DOP', sub: 'Approval', icon: Scale, num: '#D97706', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400' },
  { key: 'ED', label: 'ED', sub: 'Approval', icon: ShieldCheck, num: '#4338CA', bg: 'bg-indigo-50', bgOn: 'bg-indigo-100', bd: 'border-indigo-200', bdOn: 'border-indigo-400' },
  { key: 'MD', label: 'MD', sub: 'Final Approval', icon: BadgeCheck, num: '#9333EA', bg: 'bg-violet-50', bgOn: 'bg-violet-100', bd: 'border-violet-200', bdOn: 'border-violet-400' },
  { key: 'Approved', label: 'Approved', sub: 'Completed', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400' },
]

export function buildPipelineStages(pipeline = {}) {
  return APPROVAL_PIPELINE.map(s => ({ ...s, count: pipeline[s.key] ?? 0, to: qs({ stage: s.key }) }))
}

// Generic builder: any role's own workflow renders through the SAME
// EstimatePipeline component. Config carries the per-stage icon/colour and the
// fixed click-through destination; `counts` maps stage key -> real count.
export function buildStages(config, counts = {}) {
  return config.map(s => ({ ...s, count: counts[s.key] ?? 0 }))
}

export const TENDER_PIPELINE = [
  { key: 'ReadyForTender', label: 'Ready', sub: 'Estimate → Tender', icon: Briefcase, num: '#0891B2', bg: 'bg-cyan-50', bgOn: 'bg-cyan-100', bd: 'border-cyan-200', bdOn: 'border-cyan-400', to: '/tenders?view=ready' },
  { key: 'TenderDraft', label: 'Drafts', sub: 'In progress', icon: FileEdit, num: '#4F46E5', bg: 'bg-indigo-50', bgOn: 'bg-indigo-100', bd: 'border-indigo-200', bdOn: 'border-indigo-400', to: '/tenders?status=TenderDraft' },
  { key: 'Published', label: 'Published', sub: 'Bids open', icon: Send, num: '#0D9488', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400', to: '/tenders?status=Published' },
  { key: 'BidsClosed', label: 'Bids Closed', sub: 'Selection', icon: Lock, num: '#EA580C', bg: 'bg-orange-50', bgOn: 'bg-orange-100', bd: 'border-orange-200', bdOn: 'border-orange-400', to: '/tenders?status=BidsClosed' },
  { key: 'TechEval', label: 'Tech Eval', sub: 'Technical', icon: ClipboardCheck, num: '#7C3AED', bg: 'bg-purple-50', bgOn: 'bg-purple-100', bd: 'border-purple-200', bdOn: 'border-purple-400', to: '/tenders?status=UnderTechnicalEvaluation' },
  { key: 'FinEval', label: 'Fin Eval', sub: 'Financial', icon: FileSignature, num: '#0284C7', bg: 'bg-sky-50', bgOn: 'bg-sky-100', bd: 'border-sky-200', bdOn: 'border-sky-400', to: '/tenders?status=FinancialEvaluation' },
  { key: 'L1Identified', label: 'L1', sub: 'Identified', icon: Trophy, num: '#0F766E', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400', to: '/tenders?status=L1Identified' },
  { key: 'WorkAwarded', label: 'Awarded', sub: 'Work order', icon: Handshake, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: '/tenders?status=WorkAwarded' },
]

export const SITE_WORKS_PIPELINE = [
  { key: 'AgencySelected', label: 'Ready', sub: 'To start', icon: Hammer, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: qs({ status: 'AgencySelected', assignedTo: 'me' }) },
  { key: 'WorkStarted', label: 'In Progress', sub: 'Running work', icon: Hammer, num: '#EA580C', bg: 'bg-orange-50', bgOn: 'bg-orange-100', bd: 'border-orange-200', bdOn: 'border-orange-400', to: qs({ status: 'WorkStarted', assignedTo: 'me' }) },
  { key: 'Completed', label: 'Completed', sub: 'Done', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: qs({ actedBy: 'me', action: 'CompleteWork' }) },
]

export const BILLING_PIPELINE = [
  { key: 'WorksReady', label: 'Works Ready', sub: 'For bill', icon: Receipt, num: '#2563EB', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400', to: '/estimates?status=WorkCompleted&assignedTo=me' },
  { key: 'Draft', label: 'Drafts', sub: 'Not submitted', icon: FileEdit, num: '#0284C7', bg: 'bg-sky-50', bgOn: 'bg-sky-100', bd: 'border-sky-200', bdOn: 'border-sky-400', to: '/billing?status=Draft' },
  { key: 'InWorkflow', label: 'In Workflow', sub: 'Approval ladder', icon: Send, num: '#7C3AED', bg: 'bg-violet-50', bgOn: 'bg-violet-100', bd: 'border-violet-200', bdOn: 'border-violet-400', to: '/billing?status=SubmittedToManager,ManagerChecked,DGMChecked,SubmittedToFinance' },
  { key: 'ReturnedBill', label: 'Returned', sub: 'Needs fix', icon: RotateCcw, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: '/billing?status=ReturnedToBiller' },
]

export const FINANCE_CLERK_PIPELINE = [
  { key: 'PendingInward', label: 'Inward', sub: 'To record', icon: Inbox, num: '#4F46E5', bg: 'bg-indigo-50', bgOn: 'bg-indigo-100', bd: 'border-indigo-200', bdOn: 'border-indigo-400', to: '/finance?status=SubmittedToFinance' },
  { key: 'Verification', label: 'Verification', sub: 'To verify', icon: ClipboardCheck, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: '/finance?status=Verification' },
  { key: 'Processed', label: 'Processed', sub: 'Done', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: '/finance?status=Verification,Recommended,Approved' },
]

export const FINANCE_MANAGER_PIPELINE = [
  { key: 'Verification', label: 'Verification', sub: 'To verify', icon: ClipboardCheck, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: '/finance?status=Verification' },
  { key: 'Recommendation', label: 'Recommendation', sub: 'To recommend', icon: Send, num: '#2563EB', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400', to: '/finance?status=Recommended' },
  { key: 'Recommended', label: 'Recommended', sub: 'For Head', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: '/finance?status=Recommended' },
]

export const FINANCE_HEAD_PIPELINE = [
  { key: 'Recommended', label: 'Pending Approval', sub: 'For Head', icon: ShieldCheck, num: '#DC2626', bg: 'bg-red-50', bgOn: 'bg-red-100', bd: 'border-red-200', bdOn: 'border-red-400', to: '/finance?status=Recommended' },
  { key: 'Approved', label: 'Approved', sub: 'Cheque next', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: '/finance?status=Approved' },
  { key: 'ChequeIssued', label: 'Cheques', sub: 'Issued', icon: Banknote, num: '#0D9488', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400', to: '/finance?status=ChequeIssued' },
]

export const DIRECTOR_SANCTION_PIPELINE = [
  { key: 'PendingFCN', label: 'FCN', sub: 'To generate', icon: FileCheck, num: '#2563EB', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400', to: qs({ status: 'FinalApproved', assignedTo: 'me' }) },
  { key: 'PendingSanction', label: 'Sanction', sub: 'To generate', icon: ShieldCheck, num: '#DC2626', bg: 'bg-red-50', bgOn: 'bg-red-100', bd: 'border-red-200', bdOn: 'border-red-400', to: qs({ status: 'FCNGenerated', assignedTo: 'me' }) },
  { key: 'AwaitingForward', label: 'Forward', sub: 'Awaiting', icon: Send, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: qs({ status: 'AdminSanctionGenerated', assignedTo: 'me' }) },
  { key: 'TSApproval', label: 'TS Approval', sub: 'To approve', icon: ClipboardCheck, num: '#4F46E5', bg: 'bg-indigo-50', bgOn: 'bg-indigo-100', bd: 'border-indigo-200', bdOn: 'border-indigo-400', to: qs({ status: 'TSPending', assignedTo: 'me' }) },
  { key: 'Award', label: 'Award', sub: 'To decide', icon: Trophy, num: '#0F766E', bg: 'bg-teal-50', bgOn: 'bg-teal-100', bd: 'border-teal-200', bdOn: 'border-teal-400', to: '/tenders?status=L1Identified' },
  { key: 'WorkOrder', label: 'Work Order', sub: 'To issue', icon: FileSignature, num: '#EA580C', bg: 'bg-orange-50', bgOn: 'bg-orange-100', bd: 'border-orange-200', bdOn: 'border-orange-400', to: '/tenders?status=WorkAwarded' },
  { key: 'Agreement', label: 'Agreement', sub: 'To execute', icon: Handshake, num: '#D97706', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: '/tenders?status=WorkOrderIssued' },
]

// Works lifecycle (est. counts by coarse stage) used by Administrator / SoRAdmin.
export const LIFECYCLE_PIPELINE = [
  { key: 'Draft', label: 'Draft', sub: 'In prep', icon: FileText, num: '#94A3B8', bg: 'bg-slate-50', bgOn: 'bg-slate-100', bd: 'border-slate-200', bdOn: 'border-slate-400', to: qs({ stage: 'Draft' }) },
  { key: 'Submitted', label: 'Submitted', sub: 'In review', icon: Send, num: '#3B82F6', bg: 'bg-blue-50', bgOn: 'bg-blue-100', bd: 'border-blue-200', bdOn: 'border-blue-400', to: qs({ stage: 'DGM' }) },
  { key: 'Verified', label: 'Verified', sub: 'DGM ok', icon: ClipboardCheck, num: '#7C3AED', bg: 'bg-purple-50', bgOn: 'bg-purple-100', bd: 'border-purple-200', bdOn: 'border-purple-400', to: qs({ stage: 'GM' }) },
  { key: 'Approved', label: 'Approved', sub: 'Signed', icon: CheckCircle, num: '#4338CA', bg: 'bg-violet-50', bgOn: 'bg-violet-100', bd: 'border-violet-200', bdOn: 'border-violet-400', to: qs({ stage: 'Approved' }) },
  { key: 'Tender', label: 'Tender', sub: 'Published', icon: Send, num: '#06B6D4', bg: 'bg-cyan-50', bgOn: 'bg-cyan-100', bd: 'border-cyan-200', bdOn: 'border-cyan-400', to: '/tenders?status=Published' },
  { key: 'Work', label: 'Work', sub: 'Started', icon: Hammer, num: '#F59E0B', bg: 'bg-amber-50', bgOn: 'bg-amber-100', bd: 'border-amber-200', bdOn: 'border-amber-400', to: '/tenders?status=WorkAwarded' },
  { key: 'Billing', label: 'Billing', sub: 'In process', icon: Receipt, num: '#EC4899', bg: 'bg-pink-50', bgOn: 'bg-pink-100', bd: 'border-pink-200', bdOn: 'border-pink-400', to: '/billing' },
  { key: 'Completed', label: 'Completed', sub: 'Closed', icon: CheckCircle, num: '#059669', bg: 'bg-emerald-50', bgOn: 'bg-emerald-100', bd: 'border-emerald-200', bdOn: 'border-emerald-400', to: qs({ stage: 'Completed' }) },
]