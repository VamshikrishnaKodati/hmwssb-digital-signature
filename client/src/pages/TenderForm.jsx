import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Eye, ShieldCheck, FileText, Lock, AlertTriangle } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import WorkStagePipeline from '../components/shared/WorkStagePipeline'
import TenderDocumentChecklist from '../components/tender/TenderDocumentChecklist'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

const TECHNICAL_STAGES = [
  { key: 'final', label: 'MD Final Approval' },
  { key: 'fcn', label: 'FCN' },
  { key: 'as', label: 'Admin Sanction' },
  { key: 'ts', label: 'Technical Sanction' },
  { key: 'draft', label: 'Tender Draft' },
  { key: 'publish', label: 'Tender Publication' },
]

function Field({ label, children }) {
  return (
    <div className="ec-form-group">
      <label className="ec-label">{label}</label>
      {children}
    </div>
  )
}

function ReadOnly({ value, monoSave }) {
  return <div className="text-sm font-medium text-[#0F172A] py-1.5">{value || '—'}</div>
}

export default function TenderForm() {
  const navigate = useNavigate()
  const { id } = useParams() // present when editing an existing draft
  const [params] = useSearchParams()
  const estimateParam = params.get('estimate')
  const mode = id ? 'edit' : 'create'

  const [readyRow, setReadyRow] = useState(null)
  const [existing, setExisting] = useState(null)
  const [config, setConfig] = useState({})
  const [form, setForm] = useState({})
  const [documents, setDocuments] = useState([])
  const [readiness, setReadiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isReadOnly = existing?.Status && existing.Status !== 'TenderDraft'

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const [cfg] = await Promise.all([api.get('/tender/config')])
      setConfig(cfg.data || {})

      if (id) {
        const [t, docs] = await Promise.all([
          api.get(`/tender/${id}`),
          api.get(`/tender/${id}/documents`),
        ])
        setExisting(t.data)
        setForm({ ...t.data, TenderDate: t.data.TenderDate?.slice(0, 10), PreBidMeetingDate: t.data.PreBidMeetingDate?.slice(0, 10), BidStartDate: t.data.BidStartDate?.slice(0, 10), BidEndDate: t.data.BidEndDate?.slice(0, 10), TechnicalBidOpeningDate: t.data.TechnicalBidOpeningDate?.slice(0, 10), FinancialBidOpeningDate: t.data.FinancialBidOpeningDate?.slice(0, 10) })
        setDocuments(docs.data || [])
        setReadiness(null)
      } else {
        // Create mode — the ready-for-tender queue is the single gate.
        const ready = await api.get('/tender/ready')
        const rows = ready.data || []
        const row = estimateParam
          ? rows.find(r => r.EstimateID === Number(estimateParam))
          : rows[0]
        if (!row) {
          setReadyRow(null)
          setLoading(false)
          return
        }
        setReadyRow(row)
        const ex = await api.get(`/tender?estimateId=${row.EstimateID}`)
        const exRow = (ex.data || []).find(t => t.EstimateID === row.EstimateID) || null
        if (exRow && exRow.Status !== 'Draft' && exRow.Status !== 'TenderDraft') {
          setExisting(exRow) // already developed — read-only block + open existing
        } else {
          setForm({ EstimateID: row.EstimateID })
        }
        if (exRow) {
          const docs = await api.get(`/tender/${exRow.TenderID}/documents`).catch(() => ({ data: [] }))
          setDocuments(docs.data || [])
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load tender workbench')
    } finally {
      setLoading(false)
    }
  }

  const reloadDocuments = async () => {
    if (existing?.TenderID) {
      const docs = await api.get(`/tender/${existing.TenderID}/documents`).catch(() => ({ data: [] }))
      setDocuments(docs.data || [])
    }
  }

  const readinessState = useMemo(() => {
    if (readiness) return readiness
    if (!existing || existing.Status !== 'TenderDraft') return null
    return null
  }, [readiness, existing])

  const saveDraft = async () => {
    setSaving(true)
    try {
      let res
      if (id) {
        res = await api.put(`/tender/${id}`, form)
      } else {
        res = await api.post('/tender', form)
        // the POST returns the tender; navigate to edit mode to continue
        const created = res.data
        navigate(`/tenders/${created.TenderID}/edit`, { replace: true })
        toast.success('Tender draft created')
        return
      }
      setExisting(prev => ({ ...prev, ...res.data }))
      setForm(prev => ({ ...prev, ...res.data, TenderDate: res.data.TenderDate?.slice(0, 10) }))
      setReadiness(res.data.readiness || null)
      toast.success('Draft saved. Version ' + (res.data.Version || 1))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const validate = async () => {
    // Front-end readiness preview panel — final authority is the backend.
    const ok = readiness?.passed || 0
    const total = readiness?.total || 0
    if (total > 0 && ok >= total) toast.success(`Readiness ${ok}/${total} — draft is complete`)
    else toast('Prepare all mandatory fields before publishing', { icon: '⚠️' })
    if (readiness) return
    toast('Save the draft first to run validation', { icon: '💡' })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const tenderTypeOptions = config.tenderType || ['Open', 'Limited']
  const categoryOptions = config.tenderCategory || ['Civil', 'Water Supply', 'Sewerage']
  const biddingOptions = config.biddingType || ['Single Cover', 'Two Cover']
  const evaluationOptions = config.evaluationType || ['Percentage', 'Item Rate']

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>

  if (mode === 'create' && !readyRow) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <ShieldCheck className="w-10 h-10 mx-auto text-slate-300" />
        <p className="text-sm font-medium text-[#0F172A]">No estimate is ready for tender creation</p>
        <p className="text-xs text-slate-400">
          Only estimates with MD Final Approval, FCN, Administrative Sanction and approved Technical Sanction can be tendered.
        </p>
        <button onClick={() => navigate('/dashboard')} className="ec-btn-primary ec-btn-sm">Back to Dashboard</button>
      </div>
    )
  }

  const estimateId = existing?.EstimateID || readyRow?.EstimateID || form.EstimateID
  const tenderId = existing?.TenderID || null
  const estimateBlock = existing || readyRow

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/tenders" className="inline-flex items-center gap-1 text-xs text-[#1E3A5F] hover:underline mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Tenders
          </Link>
          <h1 className="ec-page-title">{mode === 'edit' ? 'Edit Tender Draft' : 'Create Tender Draft'}</h1>
          <p className="ec-page-subtitle">Tender Officer · draft workbench</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveDraft} disabled={saving || isReadOnly} className="ec-btn-primary ec-btn-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => navigate(`/tenders/${tenderId}/preview`)} disabled={!tenderId || isReadOnly}
            className="ec-btn-secondary ec-btn-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>This tender has moved past the draft stage ({existing.Status}). It can no longer be edited here. Use the tender detail view to review it.
            {existing.TenderID && <Link to={`/tenders/${existing.TenderID}`} className="ml-1 font-semibold underline">Open Tender</Link>}
          </span>
        </div>
      )}

      {/* Read-only approved-estimate context */}
      <div className="ec-card">
        <div className="ec-card-header flex items-center justify-between">
          <span className="ec-card-title inline-flex items-center gap-1.5"><FileText className="w-4 h-4" /> Approved Estimate</span>
          {estimateId && <Link to={`/estimates/${estimateId}`} className="text-xs text-[#1E3A5F] hover:underline">View estimate</Link>}
        </div>
        <div className="ec-card-body grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Estimate No."><ReadOnly value={estimateBlock?.EstimateNo} /></Field>
          <Field label="Name of Work"><ReadOnly value={estimateBlock?.NameOfWork} /></Field>
          <Field label="Status"><ReadOnly value="TS Approved" /></Field>
          <Field label="Est. Contract Value"><ReadOnly value={fmt(estimateBlock?.EstimatedContractValue ?? estimateBlock?.EstimatedCost)} /></Field>
          <Field label="FCN No."><ReadOnly value={estimateBlock?.FCNNo} /></Field>
          <Field label="AS No."><ReadOnly value={estimateBlock?.ASNo} /></Field>
          <Field label="TS No."><ReadOnly value={estimateBlock?.TSNo} /></Field>
          <Field label="Ready Date"><ReadOnly value={estimateBlock?.ReadyDate?.slice?.(0, 10)} /></Field>
        </div>
      </div>

      {/* Workstage pipeline — shows persisted tender position */}
      <WorkStagePipeline
        title="Tender Lifecycle"
        workflowType="tender"
        stages={TECHNICAL_STAGES}
        currentStage={existing ? 'draft' : 'ts'}
        completed={['final', 'fcn', 'as', 'ts']}
        responsibility={{
          owner: existing ? 'Tender Officer' : estimateBlock?.CreatedByName || 'Tender Officer',
          task: existing?.Status === 'TenderDraft' ? 'Complete and save the tender draft (no publish yet)' : 'Create the tender draft from the approved estimate',
          sla: 'Tender Preparation',
          actions: ['Create', 'Save Draft', 'Preview'],
        }}
        compact
      />

      {/* Main draft form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Identification */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Tender Identification</span></div>
            <div className="ec-card-body grid grid-cols-2 gap-4">
              <Field label="Tender No."><ReadOnly value={existing?.TenderNo || 'Auto-generated on save'} /></Field>
              <Field label="Reference No.">
                <input className="ec-input" value={form.ReferenceNo || ''} onChange={e => set('ReferenceNo', e.target.value)} disabled={isReadOnly} placeholder="e.g. eProc/Ref/2026-27/001" />
              </Field>
              <Field label="Bidding Type">
                <select className="ec-select" value={form.BiddingType || ''} onChange={e => set('BiddingType', e.target.value)} disabled={isReadOnly}>
                  <option value="">Select</option>
                  {biddingOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Tender Type">
                <select className="ec-select" value={form.TenderType || ''} onChange={e => set('TenderType', e.target.value)} disabled={isReadOnly}>
                  <option value="">Select</option>
                  {tenderTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Tender Category">
                <select className="ec-select" value={form.TenderCategory || ''} onChange={e => set('TenderCategory', e.target.value)} disabled={isReadOnly}>
                  <option value="">Select</option>
                  {categoryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Evaluation Type">
                <select className="ec-select" value={form.EvaluationType || ''} onChange={e => set('EvaluationType', e.target.value)} disabled={isReadOnly}>
                  <option value="">Select</option>
                  {evaluationOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Package No."><input className="ec-input" value={form.PackageNumber || ''} onChange={e => set('PackageNumber', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Bid Call No."><input className="ec-input" value={form.BidCallNumber || ''} onChange={e => set('BidCallNumber', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Evaluation Criteria"><textarea className="ec-textarea" rows={2} value={form.EvaluationCriteria || ''} onChange={e => set('EvaluationCriteria', e.target.value)} disabled={isReadOnly} /></Field>
            </div>
          </div>

          {/* Authorities */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Authorities</span></div>
            <div className="ec-card-body grid grid-cols-2 gap-4">
              <Field label="Tender Inviting Authority *">
                <input className="ec-input" value={form.TenderInvitingAuthority || ''} onChange={e => set('TenderInvitingAuthority', e.target.value)} disabled={isReadOnly} placeholder="e.g. Executive Engineer, HMWSSB" />
              </Field>
              <Field label="Officer Inviting Bids *">
                <input className="ec-input" value={form.OfficerInvitingBids || ''} onChange={e => set('OfficerInvitingBids', e.target.value)} disabled={isReadOnly} />
              </Field>
              <Field label="Bid Opening Authority *">
                <input className="ec-input" value={form.BidOpeningAuthority || ''} onChange={e => set('BidOpeningAuthority', e.target.value)} disabled={isReadOnly} />
              </Field>
            </div>
          </div>

          {/* Timeline */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Tender Timeline</span></div>
            <div className="ec-card-body grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Pre-Bid Meeting Date"><input type="date" className="ec-input" value={form.PreBidMeetingDate || ''} onChange={e => set('PreBidMeetingDate', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Submission Start (Bid Start) *"><input type="date" className="ec-input" value={form.BidStartDate || ''} onChange={e => set('BidStartDate', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Submission Closing (Bid End) *"><input type="date" className="ec-input" value={form.BidEndDate || ''} onChange={e => set('BidEndDate', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Bid Opening (Technical) *"><input type="date" className="ec-input" value={form.TechnicalBidOpeningDate || ''} onChange={e => set('TechnicalBidOpeningDate', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Financial Bid Opening"><input type="date" className="ec-input" value={form.FinancialBidOpeningDate || ''} onChange={e => set('FinancialBidOpeningDate', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Bid Validity (days) *"><input type="number" className="ec-input" value={form.BidValidity || ''} onChange={e => set('BidValidity', e.target.value)} disabled={isReadOnly} /></Field>
            </div>
          </div>

          {/* Commercial */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Commercial</span></div>
            <div className="ec-card-body grid grid-cols-2 gap-4">
              <Field label="Est. Contract Value (read-only from approved estimate)"><ReadOnly value={fmt(existing?.EstimatedCost ?? form.EstimatedCost)} /></Field>
              <Field label="EMD / Bid Security *"><input type="number" className="ec-input" value={form.EMD || ''} onChange={e => set('EMD', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Tender Fee"><input type="number" className="ec-input" value={form.TenderFee || ''} onChange={e => set('TenderFee', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Completion Period"><input className="ec-input" value={form.CompletionPeriod || ''} onChange={e => set('CompletionPeriod', e.target.value)} disabled={isReadOnly} placeholder="e.g. 6 months" /></Field>
              <Field label="Contract Period"><input className="ec-input" value={form.ContractPeriod || ''} onChange={e => set('ContractPeriod', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Defect Liability Period"><input className="ec-input" value={form.DefectLiabilityPeriod || ''} onChange={e => set('DefectLiabilityPeriod', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Performance Security"><textarea className="ec-textarea" rows={2} value={form.PerformanceSecurity || ''} onChange={e => set('PerformanceSecurity', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Special Conditions"><textarea className="ec-textarea" rows={2} value={form.SpecialConditions || ''} onChange={e => set('SpecialConditions', e.target.value)} disabled={isReadOnly} /></Field>
            </div>
          </div>

          {/* Structured description */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Scope &amp; Conditions</span></div>
            <div className="ec-card-body space-y-4">
              <Field label="Scope of Work *"><textarea className="ec-textarea" rows={3} value={form.ScopeOfWork || ''} onChange={e => set('ScopeOfWork', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Eligibility Criteria *"><textarea className="ec-textarea" rows={3} value={form.EligibilityCriteria || ''} onChange={e => set('EligibilityCriteria', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Qualification Criteria"><textarea className="ec-textarea" rows={3} value={form.QualificationCriteria || ''} onChange={e => set('QualificationCriteria', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Technical Requirements"><textarea className="ec-textarea" rows={3} value={form.TechnicalRequirements || ''} onChange={e => set('TechnicalRequirements', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Required Documents"><textarea className="ec-textarea" rows={3} value={form.RequiredDocuments || ''} onChange={e => set('RequiredDocuments', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Instructions to Bidders"><textarea className="ec-textarea" rows={3} value={form.InstructionsToBidders || ''} onChange={e => set('InstructionsToBidders', e.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Tender Remarks"><textarea className="ec-textarea" rows={2} value={form.TenderRemarks || ''} onChange={e => set('TenderRemarks', e.target.value)} disabled={isReadOnly} /></Field>
            </div>
          </div>
        </div>

        {/* Right rail: readiness + documents */}
        <div className="space-y-6">
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Tender Readiness</span></div>
            <div className="ec-card-body">
              {readinessState && readinessState.checks ? (
                <>
                  <p className="text-xs text-[#475569] mb-3">
                    {readinessState.passed}/{readinessState.total} mandatory checks complete.
                    {readinessState.passed >= readinessState.total ? ' Ready to publish (publishing is a later phase).' : ''}
                  </p>
                  <ul className="space-y-1.5">
                    {readinessState.checks.map(c => (
                      <li key={c.key} className="flex items-start gap-2 text-xs">
                        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${c.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className={c.ok ? 'text-[#475569]' : 'text-[#0F172A] font-medium'}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-[#94A3B8]">Save the draft to run the readiness check.</p>
              )}
            </div>
          </div>

          <div className="ec-card">
            <div className="ec-card-body">
              <TenderDocumentChecklist
                tenderId={existing?.TenderID || tenderId}
                documents={documents}
                onChange={reloadDocuments}
                readonly={isReadOnly}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}