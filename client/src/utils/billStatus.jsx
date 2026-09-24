export const BILL_STATUS_LABELS = {
  Draft: 'Draft',
  SubmittedToManager: 'With Manager',
  ManagerChecked: 'With DGM',
  DGMChecked: 'With GM',
  SubmittedToFinance: 'With Finance',
  ReturnedToBiller: 'Returned to You',
  ReturnedToManager: 'Returned to Manager',
  ReturnedToDGM: 'Returned to DGM',
  Paid: 'Paid',
  Cancelled: 'Cancelled',
}

export const BILL_STATUS_TONES = {
  Draft: 'bg-blue-50 text-blue-700 border-blue-200',
  SubmittedToManager: 'bg-purple-50 text-purple-700 border-purple-200',
  ManagerChecked: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DGMChecked: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SubmittedToFinance: 'bg-orange-50 text-orange-700 border-orange-200',
  ReturnedToBiller: 'bg-red-50 text-red-600 border-red-200',
  ReturnedToManager: 'bg-amber-50 text-amber-700 border-amber-200',
  ReturnedToDGM: 'bg-amber-50 text-amber-700 border-amber-200',
  Paid: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
}

export const billStatusLabel = s => BILL_STATUS_LABELS[s] || s
export const billStatusTone = s => BILL_STATUS_TONES[s] || 'bg-slate-100 text-slate-600 border-slate-200'

export function BillStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${billStatusTone(status)}`}>
      {billStatusLabel(status)}
    </span>
  )
}

export function SlaPill({ sla, compact }) {
  if (!sla || !sla.dueAt) return compact ? null : <span className="text-[11px] text-[#94A3B8]">SLA —</span>
  const min = sla.remainingMinutes ?? Math.max(0, Math.round((new Date(sla.dueAt) - new Date()) / 60000))
  const status = sla.status || ''
  const escalated = Number(sla.escalationLevel) > 0
  let label, className
  if (escalated) { label = `Escalated ─ L${sla.escalationLevel}`; className = 'bg-red-50 text-red-600 border-red-200' }
  else if (status === 'Overdue' || min <= 0) { label = 'Overdue'; className = 'bg-red-50 text-red-600 border-red-200' }
  else if (status === 'Warning' || min < 90) { label = `Due in ${min}m`; className = 'bg-amber-50 text-amber-700 border-amber-200' }
  else if (min < 1440) { label = `Due in ${Math.round(min / 60)}h`; className = 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  else { label = `Due in ${Math.round(min / 1440)}d`; className = 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${className}`}>{label}</span>
}

const EDITOR_ROLES = ['BillingOfficer', 'SiteEngineer']

export function isBillEditor(role) {
  return EDITOR_ROLES.includes(role)
}

export const CHECK_STATUSES = {
  Manager: ['SubmittedToManager', 'ReturnedToManager'],
  DGM: ['ManagerChecked', 'ReturnedToDGM'],
  GM: ['DGMChecked'],
}

export function canEditBill(role, status) {
  return EDITOR_ROLES.includes(role) && ['Draft', 'ReturnedToBiller'].includes(status)
}

export function canCheckBill(role, bill) {
  const list = CHECK_STATUSES[role]
  return !!list && list.includes(bill.Status)
}

export function checkRoleForStatus(action, from) {
  // action: 'checked_by' | 'owner' → role key expected at the stage the bill is at
  return action === 'checked_by'
    ? { SubmittedToManager: 'Manager', ManagerChecked: 'DGM', DGMChecked: 'GM' }[from] || null
    : { SubmittedToManager: 'Manager', ManagerChecked: 'DGM', DGMChecked: 'GM', SubmittedToFinance: 'Finance' }[from] || null
}

export const WORKFLOW_ACTION_LABELS = {
  BILL_SUBMITTED: 'Submitted to Manager',
  MANAGER_BILL_CHECKED: 'Checked — L1 Manager',
  DGM_BILL_CHECKED: 'Checked — L2 DGM',
  GM_BILL_CHECKED: 'Checked — L3 GM & Forwarded to Finance',
  MANAGER_BILL_RETURNED: 'Returned by Manager',
  DGM_BILL_RETURNED: 'Returned by DGM',
  GM_BILL_RETURNED: 'Returned by GM',
}

export function workflowActionLabel(a) {
  return WORKFLOW_ACTION_LABELS[a] || a
}