import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Send, RotateCcw, CheckCircle2, Paperclip, Plus, Trash2, History, Receipt, Building2, User2, FileText, Ruler, ScrollText } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import OtpModal from '../components/billing/OtpModal'
import BillingWorkflowPipeline from '../components/billing/BillingWorkflowPipeline'
import BillingResponsibilityHero from '../components/billing/BillingResponsibilityHero'
import BillFinancialSummary from '../components/billing/BillFinancialSummary'
import BillQuantityReconciliation from '../components/billing/BillQuantityReconciliation'
import SlaProgress from '../components/billing/SlaProgress'
import { BillStatusBadge, canEditBill, canCheckBill, workflowActionLabel } from '../utils/billStatus'
import { fmtCurrency } from '../components/dashboard/utils'

export default function BillDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const [otpAction, setOtpAction] = useState(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnRemarks, setReturnRemarks] = useState('')
  const [doc, setDoc] = useState({ DocType: 'Other', DocName: '', FilePath: '' })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/billing/${id}`)
      setData(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load bill')
      navigate('/billing')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  if (loading) return <div className="ec-page-title p-6">Loading…</div>
  if (!data) return null
  const { bill, items, documents, history, audit, financialSummary } = data
  const sla = data.sla || null
  const isEditor = canEditBill(user.Designation, bill.Status)
  const canCheck = canCheckBill(user.Designation, bill)
  const ownerMe = bill.CurrentOwner === user.UserID
  const subAmount = items.reduce((s, i) => s + Number(i.Amount), 0)
  const billAudit = (audit || []).filter(a => (a.Action || '').includes('BILL') || (a.Remarks || '').includes('Bill'))

  const returnTarget = { SubmittedToManager: 'Billing Officer', ManagerChecked: 'Manager', DGMChecked: 'DGM' }[bill.Status] || 'previous stage'

  const approve = async (otp) => {
    await api.post(`/billing/${bill.BillID}/check`, { otpCode: otp })
    toast.success('Approved & forwarded')
  }

  const submitBill = async (otp) => {
    await api.post(`/billing/${bill.BillID}/submit`, { otpCode: otp })
    toast.success('Submitted to Manager')
  }

  const doReturn = async (e) => {
    e.preventDefault()
    if (!returnRemarks.trim()) return
    setBusy(true)
    try {
      const res = await api.post(`/billing/${bill.BillID}/return`, { remarks: returnRemarks.trim() })
      toast.success(res.data.message)
      setReturnOpen(false); setReturnRemarks('')
      await load()
    } catch (err) { toast.error(err.response?.data?.error || 'Return failed') }
    setBusy(false)
  }

  const addDocument = async (e) => {
    e.preventDefault()
    if (!doc.DocName.trim() || !doc.FilePath.trim()) { toast.error('Name and file path required'); return }
    setBusy(true)
    try {
      await api.post(`/billing/${bill.BillID}/documents`, doc)
      toast.success('Document added')
      setDoc({ DocType: 'Other', DocName: '', FilePath: '' })
      await load()
    } catch (err) { toast.error(err.response?.data?.error || 'Add failed') }
    setBusy(false)
  }

  const removeDocument = async (docId) => {
    try {
      await api.delete(`/billing/${bill.BillID}/documents/${docId}`)
      toast.success('Document removed')
      await load()
    } catch (err) { toast.error(err.response?.data?.error || 'Remove failed') }
  }

  const deleteBill = async () => {
    if (!window.confirm('Delete this bill permanently?')) return
    try {
      await api.delete(`/billing/${bill.BillID}`)
      toast.success('Bill deleted')
      navigate('/billing')
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
  }

  const summaryRows = [
    ['Bill No', bill.BillNo || '—'],
    ['Bill Type', bill.BillType === 'RA' ? 'Running Account (RA)' : 'Final'],
    ['Bill Date', bill.BillDate ? new Date(bill.BillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
    ['Measurements / MB ref', bill.Measurements || '—'],
    ['Items Current Subtotal', fmtCurrency(subAmount)],
    ['GST', fmtCurrency(bill.GST || 0)],
    ['Net Amount', fmtCurrency(bill.NetAmount || 0)],
    ['Approved Amount', bill.ApprovedAmount != null ? fmtCurrency(bill.ApprovedAmount) : 'Pending at GM'],
    ['Prepared By', bill.SubmittedByName || '—'],
    ['Submitted At', bill.SubmissionDate ? new Date(bill.SubmissionDate).toLocaleString('en-IN') : '—'],
  ]

  return (
    <div className="min-w-0 space-y-4">
      <Link to="/billing" className="text-xs text-[#2563EB] hover:underline inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to Billing</Link>

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="ec-page-title flex flex-wrap items-center gap-2.5">
            <Receipt className="w-6 h-6 text-[#2563EB]" />
            Bill {bill.BillNo || `#${bill.BillID}`}
            <BillStatusBadge status={bill.Status} />
            <span className="text-xs font-normal text-[#475569]">{bill.EstimateNo}</span>
          </h1>
          <p className="ec-page-subtitle flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-[#94A3B8]" /> {bill.NameOfWork} · {bill.WorkID}</span>
            <SlaProgress sla={sla} compact />
          </p>
        </div>
      </div>

      {bill.Status?.startsWith('ReturnedTo') && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fadeIn">
          <p className="text-xs font-semibold text-red-700 inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Returned{bill.ReturnedByName ? ` by ${bill.ReturnedByName}` : ''} — {new Date(bill.ReturnedAt).toLocaleString('en-IN')}</p>
          {bill.ReturnRemarks && <p className="text-sm text-red-700 mt-1">{bill.ReturnRemarks}</p>}
        </div>
      )}

      {canCheck && !ownerMe && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fadeIn">
          Pending action with <strong>{bill.CurrentOwnerName || 'another user'}</strong> — it will reach your queue at the next stage.
        </div>
      )}

      {/* CURRENT RESPONSIBILITY + WORKFLOW PIPELINE */}
      <BillingResponsibilityHero bill={bill} sla={sla} me={user} />
      <div className="bi-panel px-4 py-3">
        <BillingWorkflowPipeline status={bill.Status} />
      </div>

      {/* ACTION BAR */}
      {(isEditor || (canCheck && ownerMe)) && (
        <div className="bi-panel px-4 py-3 flex flex-wrap items-center gap-2 sticky top-0 z-10">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mr-auto">Actions</span>
          {isEditor && (
            <>
              <Link to={`/billing?edit=${bill.BillID}`} data-testid="bill-edit"
                className="ec-btn-secondary ec-btn-sm inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Edit Draft</Link>
              {(bill.Status === 'Draft' || bill.Status === 'ReturnedToBiller') && (
                <button data-testid="bill-submit" onClick={() => setOtpAction('submit')}
                  className="ec-btn-primary ec-btn-sm inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Submit to Manager</button>
              )}
            </>
          )}
          {canCheck && ownerMe && (
            <>
              <button data-testid="bill-return" onClick={() => setReturnOpen(true)}
                className="ec-btn-secondary ec-btn-sm inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Return</button>
              <button data-testid="bill-check" onClick={() => setOtpAction('check')}
                className="ec-btn-primary ec-btn-sm inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Forward</button>
            </>
          )}
          {isEditor && bill.Status === 'Draft' && (
            <button onClick={deleteBill} className="text-xs text-red-500 hover:underline inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
          )}
        </div>
      )}

      {/* FINANCIAL SUMMARY */}
      <BillFinancialSummary fs={financialSummary} />

      {/* BILL ITEMS / RECONCILIATION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bi-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E7ECF3]">
            <p className="bi-title inline-flex items-center gap-2"><Receipt className="w-4 h-4 text-[#2563EB]" /> Bill Items — Qty comparison</p>
          </div>
          <div className="overflow-x-auto">
            {items.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-6 text-center">No items on this bill.</p>
            ) : (
              <table className="bi-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Item</th><th className="text-center">Unit</th><th className="text-right">Rate</th>
                    <th className="text-right">Prev Qty</th><th className="text-right">Current Qty</th>
                    <th className="text-right">Cumulative</th><th className="text-right">Balance</th><th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.BillItemID}>
                      <td>
                        <p className="text-[12px] font-medium text-[#0F172A]">{i.ItemName || i.ItemCode}</p>
                        {i.ItemCode && <p className="text-[10px] text-[#94A3B8]">{i.ItemCode} · Est qty {i.EstimateQty}</p>}
                      </td>
                      <td className="text-center text-[#475569]">{i.Unit || '—'}</td>
                      <td className="text-right tabular-nums">{fmtCurrency(i.Rate)}</td>
                      <td className="text-right tabular-nums text-[#475569]">{i.PreviousQty ?? 0}</td>
                      <td className="text-right tabular-nums font-semibold text-[#0F172A]">{i.CurrentQty ?? 0}</td>
                      <td className="text-right tabular-nums">{i.CumulativeQty}</td>
                      <td className="text-right tabular-nums text-[#475569]">{i.BalanceQty}</td>
                      <td className="text-right tabular-nums font-bold text-[#2563EB]">{fmtCurrency(i.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#E7ECF3] bg-[#F8FAFC]">
                    <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold text-[#0F172A]">Subtotal</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-[#2563EB]">{fmtCurrency(subAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        <div className="bi-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E7ECF3] -mx-4 mb-0">
            <p className="bi-title inline-flex items-center gap-2"><Building2 className="w-4 h-4 text-[#2563EB]" /> Bill Summary</p>
          </div>
          <div className="p-4">
            <dl className="space-y-2">
              {summaryRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-xs text-[#475569]">{k}</dt>
                  <dd className="text-xs font-medium text-right text-[#0F172A]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="px-4 py-3 border-t border-[#E7ECF3]">
            <p className="bi-title inline-flex items-center gap-2"><Ruler className="w-4 h-4 text-[#2563EB]" /> Work / Estimate</p>
          </div>
          <div className="p-4">
            <dl className="space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Estimate</dt><dd className="text-xs font-medium text-right">{bill.EstimateNo}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Estimate Status</dt><dd className="text-xs font-medium text-right">{bill.EstimateStatus}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Approved Estimate</dt><dd className="text-xs font-medium text-right">{fmtCurrency(bill.ApprovedEstimateAmount)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Agency</dt><dd className="text-xs font-medium text-right">{bill.AgencyName || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Contractor</dt><dd className="text-xs font-medium text-right">{bill.ContractorName || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Financial Year</dt><dd className="text-xs font-medium text-right">{bill.FinancialYear || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">Current Owner</dt><dd className="text-xs font-medium text-right">{bill.CurrentOwnerName || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-[#475569]">SLA Due</dt><dd className="text-xs font-medium text-right">{sla?.dueAt ? new Date(sla.dueAt).toLocaleString('en-IN') : '—'}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* MEASUREMENT */}
      <div className="bi-panel p-4">
        <p className="bi-title inline-flex items-center gap-2 mb-2"><Ruler className="w-4 h-4 text-[#2563EB]" /> Measurement Book</p>
        <p className="text-[12px] text-[#475569]">
          {bill.Measurements ? <>Linked measurement reference: <strong className="text-[#0F172A]">{bill.Measurements}</strong></> : 'No measurement reference recorded on this bill.'}
          <span className="text-[#94A3B8]"> Quantities above reconcile approved, measured, previously billed, current and balance figures.</span>
        </p>
      </div>

      {/* QUANTITY RECONCILIATION */}
      <BillQuantityReconciliation items={items} />

      {/* DOCUMENTS */}
      <div className="bi-panel p-4" id="documents">
        <p className="bi-title inline-flex items-center gap-2 mb-3"><Paperclip className="w-4 h-4 text-[#2563EB]" /> Documents ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-2 text-center">No documents yet.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {documents.map(d => (
              <li key={d.DocumentID} className="flex items-center justify-between gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 hover:border-[#2563EB]/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#0F172A] truncate">{d.DocName}</p>
                  <p className="text-[10px] text-[#94A3B8]">{d.DocType}{d.FilePath ? ` · ${d.FilePath}` : ''} · {d.UploadedByName} · {new Date(d.UploadedAt).toLocaleString('en-IN')}</p>
                </div>
                {isEditor ? (
                  <button onClick={() => removeDocument(d.DocumentID)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                ) : <span className="text-[10px] text-[#94A3B8]">—</span>}
              </li>
            ))}
          </ul>
        )}
        {isEditor && (
          <form onSubmit={addDocument} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={doc.DocType} onChange={e => setDoc({ ...doc, DocType: e.target.value })} className="ec-select ec-input-sm">
              <option>Other</option><option>Bill Of Quantities</option><option>Measurement Book</option><option>Invoice</option><option>GST Invoice</option>
            </select>
            <input value={doc.DocName} onChange={e => setDoc({ ...doc, DocName: e.target.value })} placeholder="Document name" className="ec-input ec-input-sm" />
            <input value={doc.FilePath} onChange={e => setDoc({ ...doc, FilePath: e.target.value })} placeholder="Path / ref" className="ec-input ec-input-sm" />
            <button type="submit" disabled={busy} className="ec-btn-secondary ec-btn-sm sm:col-span-3 justify-center inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Document</button>
          </form>
        )}
      </div>

      {/* APPROVAL HISTORY + AUDIT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bi-panel p-4" id="history">
          <p className="bi-title inline-flex items-center gap-2 mb-3"><History className="w-4 h-4 text-[#2563EB]" /> Approval History</p>
          {history.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-2 text-center">Bill has not been submitted yet.</p>
          ) : (
            <ol className="bi-timeline">
              {history.map(h => (
                <li key={h.WorkflowID} className="bi-tl-item">
                  <span className={`bi-tl-dot ${h.Action?.includes('RETURNED') ? 'border-amber-400' : 'border-[#2563EB]'}`} style={{ left: -18 }}>
                    <span className={`w-[9px] h-[9px] rounded-full ${h.Action?.includes('RETURNED') ? 'bg-amber-400' : 'bg-[#2563EB]'}`} />
                  </span>
                  <p className="text-xs font-semibold text-[#0F172A]">{workflowActionLabel(h.Action)}</p>
                  <p className="text-[11px] text-[#475569]">{h.FromUserName || '—'} → {h.ToUserName || '—'} · {new Date(h.DateTime).toLocaleString('en-IN')}</p>
                  {h.Remarks && <p className="text-[11px] text-[#475569] bg-slate-50 rounded px-2 py-1 mt-1">{h.Remarks}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="bi-panel p-4">
          <p className="bi-title inline-flex items-center gap-2 mb-3"><ScrollText className="w-4 h-4 text-[#2563EB]" /> Audit Trail (billing events)</p>
          {billAudit.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-2 text-center">No billing audit events.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5F9] max-h-56 overflow-y-auto">
              {billAudit.map(a => (
                <li key={a.AuditID} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0F172A]">{a.Action}</p>
                    {a.Remarks && <p className="text-[11px] text-[#475569]">{a.Remarks}</p>}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] whitespace-nowrap">{new Date(a.CreatedDate).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RETURN MODAL */}
      {returnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn" onClick={() => setReturnOpen(false)}>
          <div className="w-full max-w-md bi-panel p-5 animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Return Bill</h3>
                <p className="text-[11px] text-[#475569]">Returns to the previous stage — reason is mandatory.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC]/60 px-3 py-2">
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">Current Stage</p>
                <p className="text-xs font-semibold text-[#0F172A] mt-0.5">{bill.CurrentStep || bill.Status}</p>
              </div>
              <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC]/60 px-3 py-2">
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">Current User</p>
                <p className="text-xs font-semibold text-[#0F172A] mt-0.5 inline-flex items-center gap-1"><User2 className="w-3 h-3 text-[#94A3B8]" /> {bill.CurrentOwnerName || '—'}</p>
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-[#2563EB]/10 bg-[#2563EB]/5 px-3 py-2">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">Target Stage</p>
              <p className="text-xs font-semibold text-[#2563EB] mt-0.5">{returnTarget}</p>
            </div>

            <form onSubmit={doReturn}>
              <label className="ec-label">Reason for return *</label>
              <textarea
                data-testid="return-remarks"
                value={returnRemarks}
                onChange={e => setReturnRemarks(e.target.value)}
                rows={3}
                placeholder="e.g. quantities exceed estimate"
                className="ec-input mb-4"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReturnOpen(false)} className="ec-btn-ghost ec-btn-sm">Cancel</button>
                <button type="submit" disabled={busy || !returnRemarks.trim()} data-testid="return-confirm"
                  className="ec-btn-danger ec-btn-sm inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Return Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <OtpModal
        open={otpAction === 'submit'}
        title="Submit Bill to Manager"
        subtitle={`${bill.BillNo || `#${bill.BillID}`} · ${bill.NameOfWork}`}
        requestUrl={`/billing/${bill.BillID}/submit/request-otp`}
        verifyUrl={`/billing/${bill.BillID}/submit`}
        amount={bill.NetAmount}
        recipient={bill.CurrentOwnerName || 'Manager'}
        onClose={() => setOtpAction(null)}
        onDone={() => { setOtpAction(null); load() }}
      />
      <OtpModal
        open={otpAction === 'check'}
        title="Approve & Forward"
        subtitle={`${bill.BillNo || `#${bill.BillID}`} · ${bill.NameOfWork}`}
        requestUrl={`/billing/${bill.BillID}/check/request-otp`}
        verifyUrl={`/billing/${bill.BillID}/check`}
        amount={bill.NetAmount}
        recipient={bill.CurrentOwnerName || 'Next stage'}
        onClose={() => setOtpAction(null)}
        onDone={() => { setOtpAction(null); load() }}
      />
    </div>
  )
}
