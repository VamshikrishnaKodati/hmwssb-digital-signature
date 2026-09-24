// Canonical workflow mapping: 6 phases × 33 stages
// Backend status → UI phase/stage/label/owner
// This is the SINGLE SOURCE OF TRUTH for all workflow display logic.

export const PHASES = [
  {
    key: 'estimateApproval',
    label: 'ESTIMATE',
    description: 'Estimate preparation, verification and final approval',
    index: 0,
    stages: [
      { key: 'Draft', label: 'Draft', owner: 'Manager', backendStatuses: ['Draft', 'Reverted'] },
      { key: 'DGM_Verification', label: 'DGM Verification', owner: 'DGM', backendStatuses: ['Submitted'] },
      { key: 'GM_Recommendation', label: 'GM Recommendation', owner: 'GM', backendStatuses: ['DGM_Approved'] },
      { key: 'CGM_Submission', label: 'CGM Submission', owner: 'CGM', backendStatuses: ['GM_Recommended'] },
      { key: 'DOP_Approval', label: 'DOP Approval', owner: 'DOP', backendStatuses: ['CGM_Submitted'] },
      { key: 'ED_Approval', label: 'ED Approval', owner: 'ED', backendStatuses: ['DOP_Approved'] },
      { key: 'MD_FinalApproval', label: 'MD Final Approval', owner: 'MD', backendStatuses: ['ED_Approved'] },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    description: 'Administrative approvals and technical sanction',
    index: 1,
    stages: [
      { key: 'FCN_Generation', label: 'FCN Generation', owner: 'Director of Administration', backendStatuses: ['MD_Approved', 'FinalApproved', 'Signed'] },
      { key: 'Admin_Sanction', label: 'Administrative Sanction', owner: 'Director of Administration', backendStatuses: ['FCNGenerated'] },
      { key: 'Tech_Sanction', label: 'Technical Sanction', owner: 'Director of Administration / GM / DGM', backendStatuses: ['AdminSanctionGenerated', 'GMReviewed', 'DGMReviewed', 'TSPending'] },
    ],
  },
  {
    key: 'tenderEvaluation',
    label: 'TENDER',
    description: 'Tender preparation, publication, bid opening and evaluation',
    index: 2,
    stages: [
      { key: 'Tender_Preparation', label: 'Tender Preparation', owner: 'Tender Officer', backendStatuses: ['TSApproved'] },
      { key: 'Tender_Publication', label: 'Tender Publication', owner: 'Tender Officer', backendStatuses: ['TenderPublished'] },
      { key: 'Bid_Submission', label: 'Bid Submission Open', owner: 'Tender Officer', backendStatuses: [] },
      { key: 'Bid_Opening', label: 'Bid Opening', owner: 'Tender Officer', backendStatuses: ['TenderClosed'] },
      { key: 'Tech_Evaluation', label: 'Technical Evaluation', owner: 'Evaluation Authority', backendStatuses: ['TechnicalEvaluation'] },
      { key: 'Financial_Evaluation', label: 'Financial Evaluation', owner: 'Evaluation Authority', backendStatuses: ['FinancialEvaluation'] },
    ],
  },
  {
    key: 'awardContract',
    label: 'AGENCY SELECTION',
    description: 'L1 identification and work award',
    index: 3,
    stages: [
      { key: 'L1_Identification', label: 'L1 Identification', owner: 'Evaluation Authority', backendStatuses: ['L1Identified'] },
      { key: 'Work_Award', label: 'Work Award', owner: 'Director of Administration', backendStatuses: ['WorkAwarded'] },
    ],
  },
  {
    key: 'execution',
    label: 'WORK EXECUTION',
    description: 'Work order, agreement, execution, measurement and completion',
    index: 4,
    stages: [
      { key: 'Work_Order', label: 'Work Order', owner: 'Director of Administration', backendStatuses: ['WorkOrderIssued'] },
      { key: 'Agreement', label: 'Agreement', owner: 'Director of Administration', backendStatuses: ['AgreementExecuted'] },
      { key: 'Work_Start', label: 'Work Start', owner: 'Site Engineer', backendStatuses: ['AgencySelected'] },
      { key: 'Work_Progress', label: 'Work Progress', owner: 'Site Engineer', backendStatuses: ['WorkStarted'] },
      { key: 'Measurement', label: 'Measurement', owner: 'Site Engineer', backendStatuses: [] },
      { key: 'Completion', label: 'Completion', owner: 'Site Engineer', backendStatuses: ['WorkCompleted'] },
    ],
  },
  {
    key: 'billingPayment',
    label: 'BILLING & PAYMENT',
    description: 'Bill preparation, review, finance clearance and payment',
    index: 5,
    stages: [
      { key: 'Bill_Preparation', label: 'Bill Preparation', owner: 'Billing Officer', backendStatuses: ['Billing'] },
      { key: 'Manager_Review', label: 'Manager Review', owner: 'Manager', backendStatuses: [] },
      { key: 'DGM_Review', label: 'DGM Review', owner: 'DGM', backendStatuses: [] },
      { key: 'GM_Review', label: 'GM Review', owner: 'GM', backendStatuses: [] },
      { key: 'Finance_Inward', label: 'Finance Inward', owner: 'Finance Clerk', backendStatuses: [] },
      { key: 'Finance_Verification', label: 'Finance Verification', owner: 'Finance Manager', backendStatuses: [] },
      { key: 'Finance_Recommendation', label: 'Finance Recommendation', owner: 'Finance Manager', backendStatuses: [] },
      { key: 'Finance_Approval', label: 'Finance Approval', owner: 'Finance Head', backendStatuses: [] },
      { key: 'Cheque_Issued', label: 'Cheque Issued', owner: 'Finance Head', backendStatuses: ['Completed'] },
    ],
  },
]

// Flat list of all stages with phase info attached
const ALL_STAGES = []
PHASES.forEach(phase => {
  phase.stages.forEach(stage => {
    ALL_STAGES.push({ ...stage, phase: phase.key, phaseLabel: phase.label, phaseIndex: phase.index })
  })
})

// Backend status → UI stage lookup
const STATUS_TO_STAGE = {}
ALL_STAGES.forEach(stage => {
  stage.backendStatuses.forEach(status => {
    STATUS_TO_STAGE[status] = stage
  })
})

// Tender sub-status mapping (several tender statuses share one backend estimate status)
const TENDER_SUBSTATUS = {
  Draft: { key: 'Tender_Preparation', label: 'Tender Preparation', phaseIndex: 2, stageIndex: 0 },
  TenderDraft: { key: 'Tender_Preparation', label: 'Tender Preparation', phaseIndex: 2, stageIndex: 0 },
  Published: { key: 'Tender_Publication', label: 'Tender Publication', phaseIndex: 2, stageIndex: 1 },
  BidSubmissionOpen: { key: 'Bid_Submission', label: 'Bid Submission Open', phaseIndex: 2, stageIndex: 2 },
  BidsClosed: { key: 'Bid_Opening', label: 'Bid Opening', phaseIndex: 2, stageIndex: 3 },
  BidOpeningInProgress: { key: 'Bid_Opening', label: 'Bid Opening In Progress', phaseIndex: 2, stageIndex: 3 },
  TechnicalEvaluationPending: { key: 'Tech_Evaluation', label: 'Technical Evaluation Pending', phaseIndex: 2, stageIndex: 4 },
  UnderTechnicalEvaluation: { key: 'Tech_Evaluation', label: 'Under Technical Evaluation', phaseIndex: 2, stageIndex: 4 },
  TechnicalEvaluation: { key: 'Tech_Evaluation', label: 'Technical Evaluation', phaseIndex: 2, stageIndex: 4 },
  FinancialEvaluationPending: { key: 'Financial_Evaluation', label: 'Financial Evaluation Pending', phaseIndex: 2, stageIndex: 5 },
  FinancialEvaluation: { key: 'Financial_Evaluation', label: 'Financial Evaluation', phaseIndex: 2, stageIndex: 5 },
  L1Identified: { key: 'L1_Identification', label: 'L1 Identified', phaseIndex: 3, stageIndex: 0 },
  Awarded: { key: 'Work_Award', label: 'Work Awarded', phaseIndex: 3, stageIndex: 1 },
  WorkAwarded: { key: 'Work_Award', label: 'Work Awarded', phaseIndex: 3, stageIndex: 1 },
  WorkOrderIssued: { key: 'Work_Order', label: 'Work Order Issued', phaseIndex: 4, stageIndex: 0 },
  AgreementExecuted: { key: 'Agreement', label: 'Agreement Executed', phaseIndex: 4, stageIndex: 1 },
}

// Billing sub-status mapping for Bill Preparation through Cheque Issued
const BILLING_SUBSTATUS = {
  Draft: { key: 'Bill_Preparation', label: 'Bill Preparation', phaseIndex: 5, stageIndex: 0 },
  SubmittedToManager: { key: 'Manager_Review', label: 'Manager Review', phaseIndex: 5, stageIndex: 1 },
  ManagerChecked: { key: 'DGM_Review', label: 'DGM Review', phaseIndex: 5, stageIndex: 2 },
  ReturnedToManager: { key: 'Manager_Review', label: 'Manager Review (Returned)', phaseIndex: 5, stageIndex: 1 },
  DGMChecked: { key: 'GM_Review', label: 'GM Review', phaseIndex: 5, stageIndex: 3 },
  ReturnedToDGM: { key: 'DGM_Review', label: 'DGM Review (Returned)', phaseIndex: 5, stageIndex: 2 },
  SubmittedToFinance: { key: 'Finance_Inward', label: 'Finance Inward', phaseIndex: 5, stageIndex: 4 },
  ReturnedToBiller: { key: 'Bill_Preparation', label: 'Bill Preparation (Returned)', phaseIndex: 5, stageIndex: 0 },
}

// Finance sub-status mapping
const FINANCE_SUBSTATUS = {
  Inward: { key: 'Finance_Inward', label: 'Finance Inward', phaseIndex: 5, stageIndex: 4 },
  Verification: { key: 'Finance_Verification', label: 'Finance Verification', phaseIndex: 5, stageIndex: 5 },
  Recommended: { key: 'Finance_Recommendation', label: 'Finance Recommendation', phaseIndex: 5, stageIndex: 6 },
  Approved: { key: 'Finance_Approval', label: 'Finance Approval', phaseIndex: 5, stageIndex: 7 },
  ChequeIssued: { key: 'Cheque_Issued', label: 'Cheque Issued', phaseIndex: 5, stageIndex: 8 },
}

// Stage key → backend status lookup (first representative status for a stage key)
const STAGE_TO_STATUS = {}
ALL_STAGES.forEach(stage => {
  if (stage.backendStatuses.length && !STAGE_TO_STATUS[stage.key]) STAGE_TO_STATUS[stage.key] = stage.backendStatuses[0]
})
// Fill gaps (stages without a direct estimate status) from tender/billing/finance sub-statuses
Object.keys(TENDER_SUBSTATUS).forEach(k => { if (!STAGE_TO_STATUS[TENDER_SUBSTATUS[k].key]) STAGE_TO_STATUS[TENDER_SUBSTATUS[k].key] = k })
Object.keys(BILLING_SUBSTATUS).forEach(k => { if (!STAGE_TO_STATUS[BILLING_SUBSTATUS[k].key]) STAGE_TO_STATUS[BILLING_SUBSTATUS[k].key] = k })
Object.keys(FINANCE_SUBSTATUS).forEach(k => { if (!STAGE_TO_STATUS[FINANCE_SUBSTATUS[k].key]) STAGE_TO_STATUS[FINANCE_SUBSTATUS[k].key] = k })

/**
 * Get the flat index of a stage key across all 32 stages.
 */
function stageFlatIndex(stageKey) {
  return ALL_STAGES.findIndex(s => s.key === stageKey)
}

/**
 * Get complete info for a backend estimate status.
 * @param {string} status - Backend EstimateHeader.Status
 * @param {object} [context] - Optional context { tenderStatus, billingStatus, financeStatus }
 * @returns {{ phase, phaseLabel, phaseIndex, stageKey, stageLabel, owner, stageIndex, flatIndex }}
 */
export function getStatusInfo(status, context = {}) {
  // A tender record's own (effective) status drives the workflow display (brief
  // §11) even when the underlying estimate status would map to an earlier stage.
  if (context.tenderStatus && TENDER_SUBSTATUS[context.tenderStatus]) {
    const sub = TENDER_SUBSTATUS[context.tenderStatus]
    const stage = ALL_STAGES.find(s => s.key === sub.key)
    return {
      phase: stage.phase,
      phaseLabel: stage.phaseLabel,
      phaseIndex: sub.phaseIndex,
      stageKey: sub.key,
      stageLabel: sub.label,
      owner: stage.owner,
      stageIndex: sub.stageIndex,
      flatIndex: stageFlatIndex(sub.key),
    }
  }

  // Direct backend status mapping
  const direct = STATUS_TO_STAGE[status]
  if (direct) {
    const phase = PHASES.find(p => p.key === direct.phase)
    return {
      phase: direct.phase,
      phaseLabel: direct.phaseLabel,
      phaseIndex: direct.phaseIndex,
      stageKey: direct.key,
      stageLabel: direct.label,
      owner: direct.owner,
      stageIndex: phase ? phase.stages.findIndex(s => s.key === direct.key) : -1,
      flatIndex: stageFlatIndex(direct.key),
    }
  }

  // For Billing status, refine based on billing sub-status
  if (status === 'Billing' && context.billingStatus) {
    const sub = BILLING_SUBSTATUS[context.billingStatus]
    if (sub) {
      const stage = ALL_STAGES.find(s => s.key === sub.key)
      return {
        phase: stage.phase,
        phaseLabel: stage.phaseLabel,
        phaseIndex: sub.phaseIndex,
        stageKey: sub.key,
        stageLabel: sub.label,
        owner: stage.owner,
        stageIndex: sub.stageIndex,
        flatIndex: stageFlatIndex(sub.key),
      }
    }
  }

  // For Completed status, check finance sub-status for cheque stage
  if (status === 'Completed' && context.financeStatus) {
    const sub = FINANCE_SUBSTATUS[context.financeStatus]
    if (sub) {
      const stage = ALL_STAGES.find(s => s.key === sub.key)
      return {
        phase: stage.phase,
        phaseLabel: stage.phaseLabel,
        phaseIndex: sub.phaseIndex,
        stageKey: sub.key,
        stageLabel: sub.label,
        owner: stage.owner,
        stageIndex: sub.stageIndex,
        flatIndex: stageFlatIndex(sub.key),
      }
    }
  }

  // Fallback
  return {
    phase: 'unknown',
    phaseLabel: 'Unknown',
    phaseIndex: -1,
    stageKey: status || 'Unknown',
    stageLabel: status || 'Unknown',
    owner: '—',
    stageIndex: -1,
    flatIndex: -1,
  }
}

/**
 * Get the workflow progress for all 6 phases given a current status.
 * Returns phases with their stages marked as completed/current/pending.
 * @param {string} status - Backend EstimateHeader.Status
 * @param {object} [context] - Optional context
 * @returns {Array<{ phase, phaseLabel, phaseIndex, complete, active, stages }>}
 */
export function getWorkflowProgress(status, context = {}) {
  const info = getStatusInfo(status, context)
  const currentFlatIdx = info.flatIndex

  return PHASES.map(phase => {
    const phaseStartIdx = stageFlatIndex(phase.stages[0].key)
    const phaseEndIdx = stageFlatIndex(phase.stages[phase.stages.length - 1].key)

    const isPhaseComplete = currentFlatIdx > phaseEndIdx
    const isPhaseActive = currentFlatIdx >= phaseStartIdx && currentFlatIdx <= phaseEndIdx

    return {
      phase: phase.key,
      phaseLabel: phase.label,
      phaseIndex: phase.index,
      complete: isPhaseComplete,
      active: isPhaseActive,
      stages: phase.stages.map(stage => {
        const stageIdx = stageFlatIndex(stage.key)
        const isComplete = stageIdx < currentFlatIdx
        const isCurrent = stageIdx === currentFlatIdx

        return {
          key: stage.key,
          label: stage.label,
          owner: stage.owner,
          complete: isComplete,
          current: isCurrent,
          pending: !isComplete && !isCurrent,
        }
      }),
    }
  })
}

/**
 * Get the next stage after the current status.
 * @param {string} status - Backend status
 * @param {object} [context] - Optional context
 * @returns {{ stageKey, stageLabel, owner, phaseLabel } | null}
 */
export function getNextStage(status, context = {}) {
  const info = getStatusInfo(status, context)
  if (info.flatIndex < 0 || info.flatIndex >= ALL_STAGES.length - 1) return null

  const next = ALL_STAGES[info.flatIndex + 1]
  return {
    stageKey: next.key,
    stageLabel: next.label,
    owner: next.owner,
    phaseLabel: next.phaseLabel,
  }
}

/**
 * Resolve the CURRENT and NEXT approval-pipeline stage for an estimate, keyed
 * on its persisted workflow state (Status) and CURRENT OWNER designation — the
 * single resolver behind the status card (Current Stage / Next Stage / Next
 * Role) and the submit/forward action.
 *
 * Front of the pipeline (Draft/Reverted): the owner stands in for the Manager's
 * role (create + own Draft/Reverted, so CurrentOwner === CreatedBy). A chain
 * owner (DGM/GM/CGM/DOP/ED/MD) acts at their OWN stage (DGM creator is in DGM
 * Verification, not Draft), and the next authority is the first pipeline role
 * STRICTLY ABOVE the owner (maker-checker: a user who creates an estimate can
 * never review their own work). A Manager or non-pipeline owner stays at Draft
 * and forwards to the DGM. No role is special-cased.
 *
 * Post-front statuses resolve purely from the status mapping (DGM_Approved →
 * GM Recommendation → next CGM Submission), so the display tracks the
 * persisted transition after every forward.
 *
 * @param {string} status - Backend estimate status
 * @param {string} ownerDesignation - Current owner's Designation
 * @returns {{ front, currentStage: {{key,label,owner}|null}, nextStage: {{key,label,owner,status}|null} }}
 */
export function resolveWorkflowPosition(status, ownerDesignation) {
  const stages = PHASES[0].stages
  const isFront = status === 'Draft' || status === 'Reverted'

  if (isFront) {
    const ownerIdx = ownerDesignation ? stages.findIndex(s => s.owner === ownerDesignation) : -1
    const currentIdx = ownerIdx > 0 ? ownerIdx : 0
    const current = stages[currentIdx]
    const next = stages.slice(currentIdx + 1).find(s => s.backendStatuses.length > 0) || null
    return {
      front: true,
      currentStage: current ? { key: current.key, label: current.label, owner: current.owner } : null,
      nextStage: next ? { key: next.key, label: next.label, owner: next.owner, status: next.backendStatuses[0] } : null,
    }
  }

  const info = getStatusInfo(status)
  const nIx = info.flatIndex >= 0 ? info.flatIndex + 1 : -1
  const next = nIx >= 0 && nIx < ALL_STAGES.length ? ALL_STAGES[nIx] : null
  return {
    front: false,
    currentStage: { key: info.stageKey, label: info.stageLabel, owner: info.owner },
    nextStage: next ? { key: next.key, label: next.label, owner: next.owner, status: next.backendStatuses[0] || null } : null,
  }
}

/**
 * Get which phase a status belongs to.
 * @param {string} status
 * @param {object} [context]
 * @returns {{ phaseKey, phaseLabel, phaseIndex } | null}
 */
export function getStatusPhase(status, context = {}) {
  const info = getStatusInfo(status, context)
  if (info.phaseIndex < 0) return null
  return { phaseKey: info.phase, phaseLabel: info.phaseLabel, phaseIndex: info.phaseIndex }
}

/**
 * Get phase completion status for all 6 phases.
 * @param {string} status
 * @param {object} [context]
 * @returns {{ phaseKey, phaseLabel, complete, active }[]}
 */
export function getPhaseCompletionStatus(status, context = {}) {
  const progress = getWorkflowProgress(status, context)
  return progress.map(p => ({
    phaseKey: p.phase,
    phaseLabel: p.phaseLabel,
    complete: p.complete,
    active: p.active,
  }))
}

/**
 * Get the display label for any backend status.
 * @param {string} status
 * @param {object} [context]
 * @returns {string}
 */
export function getStatusLabel(status, context = {}) {
  return getStatusInfo(status, context).stageLabel
}

/**
 * Get the owner for any backend status.
 * @param {string} status
 * @param {object} [context]
 * @returns {string}
 */
export function getStatusOwner(status, context = {}) {
  return getStatusInfo(status, context).owner
}

/**
 * Get a representative backend status for a canonical stage key.
 * Used to open the stage-detail drawer from a workflow stage click.
 * @param {string} stageKey
 * @returns {string|null}
 */
export function getStatusKeyForStage(stageKey) {
  return STAGE_TO_STATUS[stageKey] || null
}

/**
 * Get all 32 stages as a flat list.
 */
export function getAllStages() {
  return ALL_STAGES
}

/**
 * Get the workflow history action labels (maps workflow action strings to display labels).
 */
export const ACTION_LABELS = {
  Submit: 'Submitted to DGM',
  Approve: 'Verified by DGM',
  DigitallySign: 'Signed by GM',
  SubmitForApproval: 'Submitted to DOP by CGM',
  ApproveAtDOP: 'Approved by DOP',
  ApproveAtED: 'Approved by ED',
  FinalApprove: 'Final Approved by MD',
  GenerateFCN: 'FCN Generated',
  GenerateSanction: 'Administrative Sanction Generated',
  AssignTS: 'Technical Sanction Assigned',
  ApproveTS: 'Technical Sanction Approved',
  ReturnTS: 'Technical Sanction Returned',
  ReviewForwardGM: 'GM Review Forward',
  ReviewForwardDGM: 'DGM Review Forward',
  PublishTender: 'Tender Published',
  CloseTender: 'Tender Closed',
  TechnicalEval: 'Technical Evaluation',
  FinancialEval: 'Financial Evaluation',
  IdentifyL1: 'L1 Identified',
  CreateAward: 'Work Awarded',
  IssueWorkOrder: 'Work Order Issued',
  RecordAgreement: 'Agreement Executed',
  SelectAgency: 'Agency Selected',
  StartWork: 'Work Started',
  CompleteWork: 'Work Completed',
  SubmitBill: 'Bill Submitted',
  Return: 'Returned',
  Revert: 'Reverted',
  ReturnToFCN: 'Returned to FCN',
  ReturnToDirector: 'Returned to Director',
  ReturnToGM: 'Returned to GM',
  ReturnToDGM: 'Returned to DGM',
  Archive: 'Archived',
  MANAGER_BILL_CHECKED: 'Manager Bill Checked',
  MANAGER_BILL_RETURNED: 'Manager Bill Returned',
  DGM_BILL_CHECKED: 'DGM Bill Checked',
  DGM_BILL_RETURNED: 'DGM Bill Returned',
  GM_BILL_CHECKED: 'GM Bill Checked',
  GM_BILL_RETURNED: 'GM Bill Returned',
  FinanceInward: 'Finance Inward',
  FinanceVerify: 'Finance Verified',
  FinanceRecommend: 'Finance Recommended',
  FinanceApprove: 'Finance Approved',
  IssueCheque: 'Cheque Issued',
}

/**
 * Convenience: all backend statuses that map to a known workflow stage.
 */
export const KNOWN_BACKEND_STATUSES = Object.keys(STATUS_TO_STAGE)
