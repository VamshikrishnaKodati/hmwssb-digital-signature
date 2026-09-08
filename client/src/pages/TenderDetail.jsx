import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Plus, XCircle, Loader2,
  ClipboardList, Users, Send, Lock, Eye, Unlock
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { downloadExport } from '../utils/download'
import StatusBadge from '../components/shared/StatusBadge'
import WorkflowProgress from '../components/shared/WorkflowProgress'
import { getStatusOwner } from '../utils/workflowMapping'
import { useAuth } from '../contexts/AuthContext'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

// Structured technical evaluation checklist (per-bid, persisted as JSONB on Bid).
// The backend force-disqualifies a bid carrying a failed criterion — this list is
// only the UI editor, never the arbiter.
const TECH_CRITERIA = ['Eligibility', 'Registration', 'Experience', 'Qualification', 'Financial Capacity', 'Technical Compliance', 'Required Documents']

const emptyTender = {
  TenderType: '', BidStartDate: '', BidEndDate: '', TechnicalBidOpeningDate: '',
  FinancialBidOpeningDate: '', CompletionPeriod: '', EMD: '', TenderFee: '',
  BidValidity: '', EligibilityCriteria: '', RequiredDocuments: '',
  PerformanceSecurity: '', SpecialConditions: '', TenderRemarks: '',
}

const emptyBid = {
  ContractorID: '', ContractorName: '', RegistrationNo: '', Email: '', Phone: '',
  Address: '', TechnicalBid: '', FinancialBidAmount: '', EMD: '', Documents: '',
}

export default function TenderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.designation || user?.Designation
  const canManage = role === 'TenderOfficer' || role === 'DirectorOfAdministration'

  const [tender, setTender] = useState(null)
  const [boq, setBoq] = useState([])
  const [bids, setBids] = useState([])
  const [contractors, setContractors] = useState([])
  const [opening, setOpening] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nitLoading, setNitLoading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(emptyTender)
  const [showBid, setShowBid] = useState(false)
  const [bidForm, setBidForm] = useState(emptyBid)
  const [busy, setBusy] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [woForm, setWoForm] = useState('')
  const [agForm, setAgForm] = useState('')
  const [criteria, setCriteria] = useState({})

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id])

  const eff = tender?.effectiveStatus || tender?.Status

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, b, bidsRes] = await Promise.all([
        api.get(`/tender/${id}`),
        api.get(`/tender/${id}/boq`),
        api.get(`/bids/tender/${id}`),
      ])
      setTender(t.data)
      setBoq(b.data || [])
      setBids(bidsRes.data || [])
      try {
        const c = await api.get('/bids/contractors')
        setContractors(c.data || [])
      } catch (_) { /* 403 expected for non-management roles — non-critical */ }
      const openingStatus = t.data?.effectiveStatus || t.data?.Status
      if (['BidsClosed', 'BidOpeningInProgress', 'TechnicalEvaluationPending'].includes(openingStatus) && canManage) {
        try { setOpening((await api.get(`/tender/${id}/bid-opening`)).data); } catch (_) { setOpening(null) }
      } else {
        setOpening(null)
      }
    } catch (err) {
      setError(err)
      toast.error(err.response?.data?.error || 'Failed to load tender details')
    } finally {
      setLoading(false)
    }
  }

  const downloadNIT = async () => {
    setNitLoading(true)
    try {
      await downloadExport(`/tender/${id}/nit`, `NIT_${tender?.TenderNo}.pdf`)
      toast.success('NIT downloaded')
    } catch (_) { toast.error('Failed to generate NIT') } finally { setNitLoading(false) }
  }

  const publishTender = async () => {
    setBusy(true)
    try {
      await api.post(`/tender/${id}/publish`)
      toast.success('Tender published')
      setShowPublishConfirm(false)
      loadAll()
    } catch (err) {
      toast.error(Array.isArray(err.response?.data?.error?.details) ? err.response.data.error.details.join(', ') : (err.response?.data?.error || 'Publish failed'))
    } finally { setBusy(false) }
  }

  const closeTender = async () => {
    if (!window.confirm('Close bid submission now? Late bids will be rejected.')) return
    setBusy(true)
    try {
      await api.post(`/tender/${id}/close`)
      toast.success('Bid submission closed')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Close failed') } finally { setBusy(false) }
  }

  const saveTender = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put(`/tender/${id}`, editForm)
      toast.success('Tender updated')
      setShowEdit(false)
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed') } finally { setBusy(false) }
  }

  const submitBid = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api.post(`/bids/tender/${id}`, bidForm)
      toast.success(`Bid submitted (${res.data.SubmissionReference})`)
      setShowBid(false)
      setBidForm(emptyBid)
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Bid submission failed') } finally { setBusy(false) }
  }

  const startOpening = async () => {
    setBusy(true)
    try {
      await api.post(`/tender/${id}/bid-opening/start`)
      toast.success('Bid opening started')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Cannot start bid opening') } finally { setBusy(false) }
  }

  const openOne = async (bidId) => {
    setBusy(true)
    try {
      const res = await api.post(`/bids/${bidId}/open`)
      toast.success(res.data.alreadyOpened ? 'Bid was already opened' : 'Bid opened')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Open failed') } finally { setBusy(false) }
  }

  const completeOpening = async () => {
    if (!window.confirm('Complete bid opening? The tender moves to TechnicalEvaluationPending.')) return
    setBusy(true)
    try {
      await api.post(`/tender/${id}/bid-opening/complete`, { remarks: 'Bid opening completed' })
      toast.success('Bid opening completed')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Cannot complete bid opening') } finally { setBusy(false) }
  }

  const runTechnical = async (bidId, qualified) => {
    let remarks = null
    if (!qualified) {
      remarks = window.prompt('Disqualification remark (recorded with the result):')
      if (!remarks) return
    }
    const Checklist = TECH_CRITERIA.map(c => ({ Criterion: c, Passed: criteria[bidId]?.[c] ?? true, Remarks: null }))
    setBusy(true)
    try {
      await api.post(`/bids/tender/${id}/evaluate/technical`, { results: [{ BidID: bidId, Qualified: qualified, Remarks: remarks, Checklist }] })
      toast.success('Technical result recorded')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Evaluation failed') } finally { setBusy(false) }
  }

  const runFinancial = async () => {
    setBusy(true)
    try {
      await api.post(`/bids/tender/${id}/evaluate/financial`, {})
      toast.success('Financial bids ranked')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Financial evaluation failed') } finally { setBusy(false) }
  }

  const identifyL1 = async () => {
    if (!window.confirm('Record L1 for this tender? The evaluation result is persisted and handed to the Director for award.')) return
    setBusy(true)
    try {
      const res = await api.post(`/bids/tender/${id}/l1`, {})
      toast.success(`L1 identified: ${res.data.l1.ContractorName}`)
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'L1 identification failed') } finally { setBusy(false) }
  }

  const awardTender = async () => {
    if (!window.confirm(`Award this work to the L1 bidder (${l1Bid?.ContractorName || 'L1'})? The bidder becomes an agency record.`)) return
    setBusy(true)
    try {
      const res = await api.post(`/bids/tender/${id}/award`, {})
      toast.success(`Awarded to ${res.data.winner.ContractorName}`)
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Award failed') } finally { setBusy(false) }
  }

  const issueWorkOrder = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/bids/tender/${id}/work-order`, { WorkOrderNo: woForm })
      toast.success('Work order issued')
      setWoForm('')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Work order failed') } finally { setBusy(false) }
  }

  const recordAgreement = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/bids/tender/${id}/agreement`, { AgreementNo: agForm })
      toast.success('Agreement recorded')
      setAgForm('')
      loadAll()
    } catch (err) { toast.error(err.response?.data?.error || 'Agreement failed') } finally { setBusy(false) }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>

  if (error) {
    const status = error.response?.status
    const message = status === 404 ? 'Tender not found'
      : status === 403 ? 'You do not have permission to view this tender.'
      : error.response?.data?.error || 'Something went wrong while loading this tender.'
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <p className="text-sm font-medium text-[#0F172A]">{message}</p>
        <p className="text-xs text-slate-400">Tender: #{id}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={loadAll} className="ec-btn-sm ec-btn-primary">Retry</button>
          <button onClick={() => navigate('/tenders')} className="ec-btn-sm ec-btn-ghost">Back to Tenders</button>
        </div>
      </div>
    )
  }

  if (!tender) return null

  const cap = tender
  const showOpeningPanel = ['BidsClosed', 'BidOpeningInProgress'].includes(eff) && canManage
  const l1Bid = bids.find(b => b.Rank === 1)
  const evaluationStage = ['TechnicalEvaluationPending', 'UnderTechnicalEvaluation', 'FinancialEvaluationPending', 'FinancialEvaluation', 'L1Identified'].includes(eff)

  const editFields = [
    ['BidStartDate', 'Bid Start Date', 'date'], ['BidEndDate', 'Bid End Date', 'date'],
    ['TechnicalBidOpeningDate', 'Technical Bid Opening', 'date'],
    ['FinancialBidOpeningDate', 'Financial Bid Opening', 'date'], ['CompletionPeriod', 'Completion Period'],
    ['EMD', 'EMD (₹)', 'number'], ['TenderFee', 'Tender Fee (₹)', 'number'],
    ['BidValidity', 'Bid Validity (days)', 'number'],
  ]
  const editTextareas = [
    ['EligibilityCriteria', 'Eligibility Criteria'], ['RequiredDocuments', 'Required Documents'],
    ['PerformanceSecurity', 'Performance Security'], ['SpecialConditions', 'Special Conditions'],
    ['TenderRemarks', 'Tender Remarks'],
  ]

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#64748B] hover:bg-[#F1F5F9]"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="ec-page-title">{tender.TenderNo}</h1>
            <p className="ec-page-subtitle">{tender.NameOfWork}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cap.canPublish && (
            <button onClick={() => setShowPublishConfirm(true)} className="ec-btn-sm ec-btn-primary">
              <Send className="w-3.5 h-3.5" /> Publish Tender
            </button>
          )}
          {cap.canClose && (
            <button onClick={closeTender} className="ec-btn-sm ec-btn-ghost" disabled={busy}>
              <Lock className="w-3.5 h-3.5" /> Close Submission
            </button>
          )}
          {cap.canEdit && (
            <button onClick={() => { setEditForm({ ...emptyTender, ...tender }); setShowEdit(!showEdit) }}
              className={`ec-btn-sm ${showEdit ? 'ec-btn-ghost' : 'ec-btn-secondary'}`}>Configure Tender</button>
          )}
          <button onClick={downloadNIT} disabled={nitLoading} className="ec-btn-sm ec-btn-ghost">
            {nitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Download NIT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ec-card p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Tender Status</p><StatusBadge status={eff} /></div>
        <div className="ec-card p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Estimated Cost</p><p className="text-sm font-semibold">{fmt(tender.EstimatedCost)}</p></div>
        <div className="ec-card p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Bids Received</p><p className="text-sm font-semibold">{bids.length}</p></div>
        <div className="ec-card p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Submission Window</p><p className="text-xs font-medium">
          {fmtDate(tender.BidStartDate)} → {fmtDate(tender.BidEndDate)}
        </p></div>
      </div>

      {tender.EvaluationAuthorityID && (
        <p className="text-[11px] text-slate-500">
          Evaluation Authority: <b className="text-slate-700">{tender.EvaluationAuthorityName || `User #${tender.EvaluationAuthorityID}`}</b>
        </p>
      )}

      <WorkflowProgress
        status={tender.EstimateStatus || 'TSApproved'}
        context={{ tenderStatus: eff }}
        showOwner
        ownerName={tender.EvaluationAuthorityName || getStatusOwner(eff, { tenderStatus: eff }) || '—'}
        sla={undefined}
      />

      {showEdit && (
        <form onSubmit={saveTender} className="ec-card">
          <div className="ec-card-header"><span className="ec-card-title">Tender Configuration</span></div>
          <div className="ec-card-body space-y-3">
            <div className="ec-grid-4">
              {editFields.map(([key, label, type = 'text']) => (
                <div key={key} className="ec-form-group">
                  <label className="ec-label">{label}</label>
                  <input type={type} className="ec-input" value={editForm[key] || ''}
                    onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            {editTextareas.map(([key, label]) => (
              <div key={key} className="ec-form-group">
                <label className="ec-label">{label}</label>
                <textarea className="ec-textarea" rows={2} value={editForm[key] || ''}
                  onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
              </div>
            ))}
            <div className="flex items-end"><button type="submit" className="ec-btn-primary ec-btn-sm" disabled={busy}>Save</button></div>
          </div>
        </form>
      )}

      {showPublishConfirm && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 space-y-3">
          <p className="text-sm font-semibold text-teal-900">Publish tender {tender.TenderNo}?</p>
          <p className="text-xs text-teal-800">Publication is permanent: the tender snapshot is locked and the bid submission window opens on <b>{fmtDate(tender.BidStartDate)}</b> and closes on <b>{fmtDate(tender.BidEndDate)}</b> (server time).</p>
          <div className="flex items-center gap-2">
            <button onClick={publishTender} disabled={busy} className="ec-btn-sm ec-btn-primary"><Send className="w-3.5 h-3.5" /> Confirm Publish</button>
            <button onClick={() => setShowPublishConfirm(false)} className="ec-btn-sm ec-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="ec-card overflow-hidden">
        <div className="ec-card-header flex items-center justify-between">
          <span className="ec-card-title"><ClipboardList className="w-4 h-4 inline mr-1" /> BOQ — Bill of Quantities</span>
          <span className="text-xs text-slate-400">{boq.length} items (read-only, from approved estimate)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead><tr>
              <th>S.No</th><th>Item Code</th><th>Description</th><th>Is Material</th>
              <th className="text-center">N</th><th className="text-center">L</th><th className="text-center">B</th><th className="text-center">D</th>
              <th className="text-right">Qty</th><th>Unit</th><th className="text-right">Rate</th><th className="text-right">Amount</th>
            </tr></thead>
            <tbody>
              {boq.map(r => (
                <tr key={r.DetailID}>
                  <td className="text-xs text-slate-500">{r.SNo}</td>
                  <td className="font-mono text-xs">{r.ItemCode}</td>
                  <td className="text-xs max-w-[220px]">{r.Description}</td>
                  <td><span className={`ec-badge ${r.Category === 'Material' ? 'ec-badge-warning' : 'ec-badge-info'}`}>{r.Category === 'Material' ? 'Yes' : 'No'}</span></td>
                  <td className="text-center text-xs">{r.N}</td><td className="text-center text-xs">{r.L}</td><td className="text-center text-xs">{r.B}</td><td className="text-center text-xs">{r.D}</td>
                  <td className="text-right text-xs">{r.Qty}</td><td className="text-xs">{r.Unit}</td>
                  <td className="text-right text-xs">{fmt(r.Rate)}</td><td className="text-right text-xs font-medium">{fmt(r.Amount)}</td>
                </tr>
              ))}
              {boq.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-xs text-slate-400">No BOQ items</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ec-card overflow-hidden">
        <div className="ec-card-header flex items-center justify-between">
          <span className="ec-card-title"><Users className="w-4 h-4 inline mr-1" /> Bids</span>
          <div className="flex items-center gap-2">
            {(cap.canSubmitBid || canManage) && ['BidsClosed', 'BidOpeningInProgress', 'TechnicalEvaluationPending'].includes(eff) && bids.length > 0 && (
              <span className="text-[11px] text-slate-400">
                {eff === 'BidsClosed' ? 'Submission window closed — awaiting bid opening' : eff === 'BidOpeningInProgress' ? 'Bid opening in progress' : 'Bid opening completed'}
              </span>
            )}
            {cap.canSubmitBid && (
              <button onClick={() => { setBidForm(emptyBid); setShowBid(!showBid) }}
                className={`ec-btn-sm ${showBid ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
                {showBid ? <><XCircle className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Submit Bid</>}
              </button>
            )}
          </div>
        </div>

        {!cap.canSubmitBid && eff === 'BidsClosed' && (
          <div className="px-4 py-2 text-[11px] text-slate-400 border-t">Submission is closed. Bids received are listed below until the opening authority acts.</div>
        )}

        {showBid && (
          <form onSubmit={submitBid} className="ec-card-body border-t">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label className="ec-label">Existing Contractor</label>
                <select className="ec-select" value={bidForm.ContractorID}
                  onChange={e => { const c = contractors.find(x => String(x.ContractorID) === e.target.value); setBidForm({ ...bidForm, ContractorID: e.target.value, ContractorName: c ? c.ContractorName : '' }) }}>
                  <option value="">— New contractor —</option>
                  {contractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.ContractorName}</option>)}
                </select>
              </div>
              <div className="ec-form-group"><label className="ec-label">Contractor Name *</label>
                <input className="ec-input" value={bidForm.ContractorName} onChange={e => setBidForm({ ...bidForm, ContractorName: e.target.value })} required /></div>
              <div className="ec-form-group"><label className="ec-label">Registration No</label>
                <input className="ec-input" value={bidForm.RegistrationNo} onChange={e => setBidForm({ ...bidForm, RegistrationNo: e.target.value })} /></div>
              <div className="ec-form-group"><label className="ec-label">Email</label>
                <input className="ec-input" type="email" value={bidForm.Email} onChange={e => setBidForm({ ...bidForm, Email: e.target.value })} /></div>
              <div className="ec-form-group"><label className="ec-label">Phone</label>
                <input className="ec-input" value={bidForm.Phone} onChange={e => setBidForm({ ...bidForm, Phone: e.target.value })} /></div>
              <div className="ec-form-group"><label className="ec-label">Financial Bid Amount (₹) *</label>
                <input className="ec-input" type="number" step="0.01" value={bidForm.FinancialBidAmount} onChange={e => setBidForm({ ...bidForm, FinancialBidAmount: e.target.value })} required /></div>
              <div className="ec-form-group"><label className="ec-label">EMD (₹)</label>
                <input className="ec-input" type="number" step="0.01" value={bidForm.EMD} onChange={e => setBidForm({ ...bidForm, EMD: e.target.value })} /></div>
              <div className="ec-form-group"><label className="ec-label">Technical Bid</label>
                <input className="ec-input" value={bidForm.TechnicalBid} onChange={e => setBidForm({ ...bidForm, TechnicalBid: e.target.value })} placeholder="Experience / certifications" /></div>
              <div className="ec-form-group"><label className="ec-label">Documents (categories: Technical / Financial / EMD / Declaration)</label>
                <textarea className="ec-textarea" rows={2} value={bidForm.Documents} onChange={e => setBidForm({ ...bidForm, Documents: e.target.value })}
                  placeholder={'{"Category":"Technical","DocumentName":"Bid security","FilePath":"uploads/x.pdf"}'} /></div>
            </div>
            <div className="flex items-end"><button type="submit" className="ec-btn-primary ec-btn-sm" disabled={busy}>Submit Bid</button></div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead><tr>
              <th>Contractor</th><th>Registration</th><th>Submission Ref</th><th>Submitted At</th>
              <th>Opening</th><th>Docs (T/F/E/D)</th>
              <th className="text-right">Financial Bid</th>
            </tr></thead>
            <tbody>
              {bids.map(b => (
                <tr key={b.BidID}>
                  <td className="text-xs font-medium">{b.ContractorName}</td>
                  <td className="font-mono text-xs">{b.RegistrationNo || '—'}</td>
                  <td className="font-mono text-xs text-[#1E3A5F]">{b.SubmissionReference || '—'}</td>
                  <td className="text-xs text-slate-500">{fmtDateTime(b.SubmittedAt || b.CreatedDate)}</td>
                  <td>
                    {b.OpeningStatus === 'Opened'
                      ? <span className="ec-badge ec-badge-success">Opened</span>
                      : <span className="ec-badge ec-badge-warning">Pending</span>}
                  </td>
                  <td className="text-[10px] text-slate-500">
                    {(b.TechnicalDocCount || 0) + (b.FinancialDocCount || 0) + (b.EmdDocCount || 0) + (b.DeclarationDocCount || 0)}
                    {b.TechnicalDocCount || b.FinancialDocCount || b.EmdDocCount || b.DeclarationDocCount
                      ? ` (${b.TechnicalDocCount || 0}/${b.FinancialDocCount || 0}/${b.EmdDocCount || 0}/${b.DeclarationDocCount || 0})`
                      : ''}
                  </td>
                  <td className="text-right text-xs">
                    {b.FinancialBidAmount === null || b.FinancialBidAmount === undefined
                      ? <span className="text-[10px] text-slate-400">— masked (financial)</span>
                      : <span className="font-medium">{fmt(b.FinancialBidAmount)}</span>}
                  </td>
                </tr>
              ))}
              {bids.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-xs text-slate-400">No bids yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {evaluationStage && (
        <div className="ec-card overflow-hidden">
          <div className="ec-card-header flex items-center justify-between">
            <span className="ec-card-title"><ClipboardList className="w-4 h-4 inline mr-1" /> Evaluation</span>
            <StatusBadge status={eff} />
          </div>
          <div className="ec-card-body space-y-4">
            {eff === 'L1Identified' && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
                <b>L1 identified:</b> {l1Bid?.ContractorName || '—'}
                {l1Bid?.FinancialBidAmount ? ` — ${fmt(l1Bid.FinancialBidAmount)}` : ''} (Rank 1). Handed to the Director for award.
              </div>
            )}

            {cap.canEvaluateTechnical && ['TechnicalEvaluationPending', 'UnderTechnicalEvaluation'].includes(eff) && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Technical qualification</p>
                <div className="space-y-2">
                  {bids.filter(b => b.TechnicalStatus === 'Pending').map(b => (
                    <div key={b.BidID} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{b.ContractorName}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => runTechnical(b.BidID, false)} disabled={busy} className="ec-btn-sm ec-btn-ghost">Disqualify</button>
                          <button onClick={() => runTechnical(b.BidID, true)} disabled={busy} className="ec-btn-sm ec-btn-primary">Qualify</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {TECH_CRITERIA.map(c => {
                          const passed = criteria[b.BidID]?.[c] ?? true
                          return (
                            <button
                              key={c} type="button"
                              onClick={() => setCriteria({ ...criteria, [b.BidID]: { ...(criteria[b.BidID] || {}), [c]: !passed } })}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${passed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                              {passed ? '✓' : '✗'} {c}
                            </button>
                          )
                        })}
                        <span className="text-[10px] text-slate-400 self-center">A failed criterion disqualifies the bid</span>
                      </div>
                    </div>
                  ))}
                  {bids.length > 0 && bids.every(b => b.TechnicalStatus !== 'Pending') && (
                    <p className="text-xs text-slate-400">All bids have a technical result. The next stage can begin once the tender reaches it.</p>
                  )}
                  {bids.length === 0 && <p className="text-xs text-slate-400">No bids received.</p>}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {bids.filter(b => b.TechnicalStatus === 'Qualified').length > 0 &&
                    <span className="ec-badge ec-badge-success">{bids.filter(b => b.TechnicalStatus === 'Qualified').length} qualified</span>}
                  {bids.filter(b => b.TechnicalStatus === 'Disqualified').length > 0 &&
                    <span className="ec-badge ec-badge-danger">{bids.filter(b => b.TechnicalStatus === 'Disqualified').length} disqualified</span>}
                </div>
              </div>
            )}

            {cap.canEvaluateFinancial && eff === 'FinancialEvaluationPending' && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{bids.filter(b => b.TechnicalStatus === 'Qualified').length} qualified bid(s) will be ranked by quoted amount.</p>
                <button onClick={runFinancial} disabled={busy} className="ec-btn-sm ec-btn-primary">Run Financial Evaluation</button>
              </div>
            )}

            {eff === 'FinancialEvaluation' && (
              <div>
                <div className="overflow-x-auto">
                  <table className="ec-table">
                    <thead><tr><th>Rank</th><th>Bidder</th><th className="text-right">Quoted Amount</th></tr></thead>
                    <tbody>
                      {bids.filter(b => b.Rank).sort((a, b) => a.Rank - b.Rank).map(b => (
                        <tr key={b.BidID}>
                          <td className="text-xs font-semibold">{b.Rank}</td>
                          <td className="text-xs">{b.ContractorName}</td>
                          <td className="text-right text-xs">{b.FinancialBidAmount ? fmt(b.FinancialBidAmount) : '—'}</td>
                        </tr>
                      ))}
                      {bids.filter(b => b.Rank).length === 0 && <tr><td colSpan={3} className="text-center py-6 text-xs text-slate-400">No ranked bids</td></tr>}
                    </tbody>
                  </table>
                </div>
                {cap.canIdentifyL1 && (
                  <button onClick={identifyL1} disabled={busy} className="ec-btn-sm ec-btn-primary mt-3">Identify L1</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {cap.canAward && eff === 'L1Identified' && (
        <div className="ec-card">
          <div className="ec-card-header"><span className="ec-card-title">Director Action — Award</span></div>
          <div className="ec-card-body flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-600">Award to the L1 bidder <b>{l1Bid?.ContractorName || '—'}</b>
              {l1Bid?.FinancialBidAmount ? ` (${fmt(l1Bid.FinancialBidAmount)})` : ''}? The winning bidder becomes an agency record.</p>
            <button onClick={awardTender} disabled={busy} className="ec-btn-sm ec-btn-primary">Award Work</button>
          </div>
        </div>
      )}

      {cap.canIssueWorkOrder && (
        <div className="ec-card">
          <div className="ec-card-header"><span className="ec-card-title">Director Action — Work Order</span></div>
          <form onSubmit={issueWorkOrder} className="ec-card-body flex items-end gap-3">
            <div className="ec-form-group grow">
              <label className="ec-label">Work Order No *</label>
              <input className="ec-input" value={woForm} onChange={e => setWoForm(e.target.value)} required />
            </div>
            <button type="submit" className="ec-btn-sm ec-btn-primary" disabled={busy}>Issue Work Order</button>
          </form>
        </div>
      )}

      {cap.canRecordAgreement && (
        <div className="ec-card">
          <div className="ec-card-header"><span className="ec-card-title">Director Action — Agreement</span></div>
          <form onSubmit={recordAgreement} className="ec-card-body flex items-end gap-3">
            <div className="ec-form-group grow">
              <label className="ec-label">Agreement No *</label>
              <input className="ec-input" value={agForm} onChange={e => setAgForm(e.target.value)} required />
            </div>
            <button type="submit" className="ec-btn-sm ec-btn-primary" disabled={busy}>Record Agreement</button>
          </form>
        </div>
      )}

      {['WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted'].includes(eff) && (
        <div className="ec-card overflow-hidden">
          <div className="ec-card-header"><span className="ec-card-title">Post-Award</span></div>
          <div className="ec-card-body grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Awarded Bidder</p><p className="font-medium">{l1Bid?.ContractorName || '—'}{l1Bid?.FinancialBidAmount ? ` — ${fmt(l1Bid.FinancialBidAmount)}` : ''}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Work Order</p><p className="font-medium">{tender.WorkOrderNo || '—'}{tender.WorkOrderIssuedAt ? ` (${fmtDateTime(tender.WorkOrderIssuedAt)})` : ''}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Agreement</p><p className="font-medium">{tender.AgreementNo || '—'}{tender.AgreementExecutedAt ? ` (${fmtDateTime(tender.AgreementExecutedAt)})` : ''}</p></div>
          </div>
        </div>
      )}

      {showOpeningPanel && (
        <div className="ec-card overflow-hidden">
          <div className="ec-card-header flex items-center justify-between">
            <span className="ec-card-title"><Eye className="w-4 h-4 inline mr-1" /> Bid Opening</span>
            <div className="flex items-center gap-2">
              {opening && <span className="text-[11px] text-slate-400">
                {opening.counts.opened} of {opening.counts.received} bid(s) opened
              </span>}
              {cap.canStartOpening && (
                <button onClick={startOpening} disabled={busy} className="ec-btn-sm ec-btn-primary">
                  <Unlock className="w-3.5 h-3.5" /> Start Bid Opening
                </button>
              )}
              {cap.canCompleteOpening && bids.length > 0 && (
                <button onClick={completeOpening} disabled={busy} className="ec-btn-sm ec-btn-primary">
                  <Lock className="w-3.5 h-3.5" /> Complete Bid Opening
                </button>
              )}
            </div>
          </div>
          {opening && (
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead><tr><th>Contractor</th><th>Submission Ref</th><th>Submitted At</th><th>Opening Status</th><th>Open Bid</th></tr></thead>
                <tbody>
                  {(opening.bids || []).map(b => (
                    <tr key={b.BidID}>
                      <td className="text-xs font-medium">{b.ContractorName}</td>
                      <td className="font-mono text-xs">{b.SubmissionReference || '—'}</td>
                      <td className="text-xs text-slate-500">{fmtDateTime(b.SubmittedAt || b.CreatedDate)}</td>
                      <td>
                        {b.OpeningStatus === 'Opened'
                          ? <span className="ec-badge ec-badge-success">Opened</span>
                          : <span className="ec-badge ec-badge-warning">Pending</span>}
                      </td>
                      <td>
                        {cap.canOpenIndividual && b.OpeningStatus !== 'Opened' ? (
                          <button onClick={() => openOne(b.BidID)} disabled={busy} className="ec-btn-sm ec-btn-primary">
                            <Unlock className="w-3.5 h-3.5" /> Open Bid
                          </button>
                        ) : <span className="text-[10px] text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}