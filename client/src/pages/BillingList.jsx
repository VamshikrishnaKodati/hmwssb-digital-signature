import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Edit3, Send, Trash2, ExternalLink, Calculator, RotateCcw } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'
import OtpModal from '../components/billing/OtpModal'
import { BillStatusBadge, SlaPill, canEditBill } from '../utils/billStatus'
import { fmtCurrency } from '../components/dashboard/utils'

export default function BillingList() {
  const [bills, setBills] = useState([])
  const [estimates, setEstimates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ EstimateID: '', BillType: 'RA', BillNo: '', BillDate: '', GST: '', Measurements: '' })
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const [otpBill, setOtpBill] = useState(null)
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), [])
  const role = user.Designation
  const [params, setParams] = useSearchParams()
  const estimateId = params.get('estimateId')
  const statusFilter = params.get('status')
  const createdByFilter = params.get('createdBy')
  const ownerFilter = params.get('owner')
  const editParam = params.get('edit')

  useEffect(() => { loadBills() }, [estimateId, statusFilter, createdByFilter, ownerFilter])
  useEffect(() => { if (editParam) openEdit(editParam); else setShowForm(false) }, [editParam])

  const loadBills = async () => {
    try {
      const sp = new URLSearchParams()
      if (estimateId) sp.set('estimateId', estimateId)
      if (statusFilter) sp.set('status', statusFilter)
      if (createdByFilter) sp.set('createdBy', createdByFilter)
      if (ownerFilter) sp.set('owner', ownerFilter)
      const qs = sp.toString()
      const res = await api.get(`/billing${qs ? `?${qs}` : ''}`)
      setBills(res.data || [])
    } catch (_) {}
  }
  const loadEstimates = async () => {
    try {
      const res = await api.get('/estimates?status=WorkCompleted')
      setEstimates(res.data || [])
    } catch (_) {}
  }
  useEffect(() => { loadEstimates() }, [])

  const fetchPreview = async (estId, excludeId) => {
    try {
      const res = await api.get(`/billing/preview-items?estimateId=${estId}${excludeId ? `&excludeBillId=${excludeId}` : ''}`)
      setItems(res.data.items || [])
    } catch (err) { toast.error(err.response?.data?.error || 'Could not load items') }
  }

  const onEstimateChange = async (estId) => {
    setForm(f => ({ ...f, EstimateID: estId }))
    if (estId) await fetchPreview(estId)
    else setItems([])
  }

  const openCreate = async () => {
    setEditId(null)
    setForm({ EstimateID: '', BillType: 'RA', BillNo: '', BillDate: '', GST: '', Measurements: '' })
    setItems([])
    if (params.get('estimateId')) await onEstimateChange(params.get('estimateId'))
    setShowForm(true)
    if (params.get('edit')) setParams({}, { replace: true })
  }

  const openEdit = async (bid) => {
    setShowForm(false)
    try {
      const res = await api.get(`/billing/${bid}`)
      const b = res.data.bill
      setEditId(b.BillID)
      setForm({
        EstimateID: b.EstimateID, BillType: b.BillType || 'RA', BillNo: b.BillNo || '',
        BillDate: b.BillDate ? b.BillDate.slice(0, 10) : '', GST: b.GST ?? '', Measurements: b.Measurements || '',
      })
      setItems(res.data.items || [])
      setShowForm(true)
    } catch (err) { toast.error(err.response?.data?.error || 'Could not load bill') }
  }

  const closeForm = () => {
    setShowForm(false); setEditId(null); setForm({ EstimateID: '', BillType: 'RA', BillNo: '', BillDate: '', GST: '', Measurements: '' }); setItems([])
    if (params.get('edit')) setParams({}, { replace: true })
  }

  const subtotal = items.reduce((s, i) => s + Number(i.Amount || 0), 0)

  const setQty = (idx, val) => {
    setItems(list => list.map((it, i) => {
      if (i !== idx) return it
      const q = Math.max(0, Number(val) || 0)
      const cum = Number(it.EstimateQty || 0)
      const balance = Math.max(0, Math.round((Number(it.CumulativeQty) - Number(it.PreviousQty) - q) * 1000) / 1000)
      return { ...it, CurrentQty: Math.round(q * 1000) / 1000, BalanceQty: balance, Amount: Math.round(q * Number(it.Rate) * 100) / 100 }
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.EstimateID) { toast.error('Select an estimate'); return }
    setBusy('save')
    try {
      const payload = { ...form, GST: form.GST === '' ? 0 : Number(form.GST), Items: items.map(i => ({ DetailID: i.DetailID, CurrentQty: i.CurrentQty })) }
      if (editId) await api.put(`/billing/${editId}`, payload)
      else await api.post('/billing', payload)
      toast.success(editId ? 'Bill updated' : 'Bill created as Draft')
      closeForm(); loadBills()
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    setBusy('')
  }

  const deleteBill = async (b) => {
    if (!window.confirm(`Delete bill ${b.BillNo || `#${b.BillID}`}?`)) return
    try { await api.delete(`/billing/${b.BillID}`); toast.success('Deleted'); loadBills() }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
  }

  const isEditor = role === 'BillingOfficer' || role === 'SiteEngineer'
  const editableCount = bills.filter(b => isEditor && ['Draft', 'ReturnedToBiller'].includes(b.Status)).length
  const hasFormOpen = showForm

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Billing</h1>
          <p className="ec-page-subtitle">
            {bills.length} bill{bills.length !== 1 ? 's' : ''} · {statusFilter
              ? `filtered by ${statusFilter.split(',').map(s => s).join(' + ')}`
              : ownerFilter === 'me'
                ? 'pending your check'
                : 'all statuses'}
          </p>
        </div>
        {isEditor && (
          <button onClick={openCreate} className={`ec-btn-sm ${hasFormOpen ? 'ec-btn-ghost' : 'ec-btn-primary'} inline-flex items-center gap-1.5`}>
            {hasFormOpen ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Bill</>}
          </button>
        )}
      </div>

      {hasFormOpen && (
        <form onSubmit={handleSave} className="ec-card mb-5">
          <div className="ec-card-header">
            <span className="ec-card-title">{editId ? 'Edit Bill' : 'New Bill'}</span>
            {!editId && <span className="text-[10px] text-[#94A3B8]">Quantities derive from verified measurements; figures are editable before submission.</span>}
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4 mb-4">
              <div className="ec-form-group">
                <label className="ec-label">Estimate *</label>
                <select value={form.EstimateID} onChange={e => onEstimateChange(e.target.value)} className="ec-select" disabled={!!editId}>
                  <option value="">Select estimate</option>
                  {estimates.map(est => (
                    <option key={est.EstimateID} value={est.EstimateID}>{est.EstimateNo || est.WorkID}{est.NameOfWork ? ` — ${est.NameOfWork}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="ec-form-group"><label className="ec-label">Bill Type</label>
                <select value={form.BillType} onChange={e => setForm({ ...form, BillType: e.target.value })} className="ec-select">
                  <option value="RA">RA (Running Account)</option><option value="Final">Final</option>
                </select>
              </div>
              <div className="ec-form-group"><label className="ec-label">Bill No</label><input value={form.BillNo} onChange={e => setForm({ ...form, BillNo: e.target.value })} placeholder="e.g. RA-01/HMWSSB/2026" className="ec-input" /></div>
              <div className="ec-form-group"><label className="ec-label">Bill Date</label><input type="date" value={form.BillDate} onChange={e => setForm({ ...form, BillDate: e.target.value })} className="ec-input" /></div>
              <div className="ec-form-group"><label className="ec-label">GST</label><input type="number" step="0.01" min="0" value={form.GST} onChange={e => setForm({ ...form, GST: e.target.value })} className="ec-input" /></div>
              <div className="ec-form-group"><label className="ec-label">Measurements / MB ref</label><input value={form.Measurements} onChange={e => setForm({ ...form, Measurements: e.target.value })} placeholder="MB ref / qty taken" className="ec-input" /></div>
            </div>

            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Bill Items</p>
            <div className="overflow-x-auto border border-[#CBD5E1] rounded-lg mb-3">
              {items.length === 0 ? (
                <p className="text-sm text-[#94A3B8] py-8 text-center">Select an estimate to load its verified-measurement items.</p>
              ) : (
                <table className="ec-table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Item</th><th>Unit</th><th className="text-right">Rate</th>
                      <th className="text-right">Prev Qty</th><th className="text-right w-28">Current Qty</th>
                      <th className="text-right">Balance</th><th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i, idx) => (
                      <tr key={i.DetailID}>
                        <td><p className="text-xs font-medium text-[#0F172A]">{i.ItemName}</p>{i.ItemCode && <p className="text-[10px] text-[#94A3B8]">{i.ItemCode} · Est {i.EstimateQty}</p>}</td>
                        <td className="text-xs text-[#475569]">{i.Unit || '—'}</td>
                        <td className="text-right text-xs">{fmtCurrency(i.Rate)}</td>
                        <td className="text-right text-xs text-[#475569]">{i.PreviousQty ?? 0}</td>
                        <td className="text-right"><input type="number" step="0.001" min="0" value={i.CurrentQty ?? 0} onChange={e => setQty(idx, e.target.value)} className="ec-input ec-input-sm text-right w-24 ml-auto" data-testid={`qty-${i.DetailID}`} /></td>
                        <td className="text-right text-xs text-[#475569]">{i.BalanceQty}</td>
                        <td className="text-right text-xs font-semibold text-[#2563EB]">{fmtCurrency(i.Amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#CBD5E1] bg-[#F8FAFC]">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> Current Subtotal{Number(form.GST) ? ` + GST ${fmtCurrency(Number(form.GST))}` : ''}</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-[#2563EB]">{fmtCurrency(subtotal + (Number(form.GST) || 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button type="submit" disabled={busy === 'save'} className="ec-btn-primary ec-btn-sm inline-flex items-center gap-1.5" data-testid="bill-save">
                <Plus className="w-3.5 h-3.5" /> {editId ? 'Save Changes' : 'Create Draft Bill'}
              </button>
              <button type="button" onClick={closeForm} className="ec-btn-ghost ec-btn-sm">Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="ec-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ec-table min-w-[940px]">
            <thead>
              <tr>
                <th>Bill No</th><th>Estimate</th><th>Work Name</th><th>Type</th><th className="text-right">Net</th>
                <th>Owner</th><th className="text-right">SLA</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => {
                const editable = isEditor && ['Draft', 'ReturnedToBiller'].includes(b.Status)
                const iAmOwner = b.CurrentOwner === user.UserID
                return (
                  <tr key={b.BillID}>
                    <td className="text-xs font-medium text-[#0F172A]">{b.BillNo || '—'}</td>
                    <td className="font-mono text-xs text-[#2563EB]">{b.EstimateNo || b.WorkID}</td>
                    <td className="text-xs max-w-[170px] truncate text-[#475569]">{b.NameOfWork}</td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.BillType === 'RA' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{b.BillType}</span></td>
                    <td className="text-right text-xs font-medium">{fmtCurrency(b.NetAmount || 0)}{b.ApprovedAmount != null && <span className="block text-[10px] text-[#475569]">approved {fmtCurrency(b.ApprovedAmount)}</span>}</td>
                    <td className="text-xs text-[#475569]">{b.CurrentOwnerName || (b.Status === 'Draft' ? 'Draft' : '—')}{iAmOwner && b.CurrentOwner ? ' (you)' : ''}</td>
                    <td className="text-right"><SlaPill sla={b.SlaDueAt ? { dueAt: b.SlaDueAt, status: b.SlaStatus, escalationLevel: b.EscalationLevel } : null} /></td>
                    <td><BillStatusBadge status={b.Status} /></td>
                    <td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/billing/${b.BillID}`} className="text-[#2563EB] hover:underline text-xs inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Review</Link>
                        {editable && (
                          <>
                            <button onClick={() => openEdit(b.BillID)} className="text-[#2563EB] hover:underline text-xs inline-flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button>
                            <button onClick={() => setOtpBill(b)} data-testid="bill-submit" className="text-[#059669] hover:underline text-xs inline-flex items-center gap-1"><Send className="w-3 h-3" /> Submit</button>
                            <button onClick={() => deleteBill(b)} className="text-red-400 hover:text-red-600 text-xs inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>
                          </>
                        )}
                        {!editable && !b.CurrentOwner && <span className="text-[10px] text-[#94A3B8]">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {bills.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-sm text-[#94A3B8]">No bills found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <OtpModal
        open={!!otpBill}
        title="Submit Bill to Manager"
        subtitle={otpBill ? `${otpBill.BillNo || `#${otpBill.BillID}`} · ${otpBill.NameOfWork}` : ''}
        requestUrl={otpBill ? `/billing/${otpBill.BillID}/submit/request-otp` : ''}
        verifyUrl={otpBill ? `/billing/${otpBill.BillID}/submit` : ''}
        onClose={() => setOtpBill(null)}
        onDone={() => { setOtpBill(null); loadBills() }}
      />
    </div>
  )
}