import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Eye, ShieldCheck, FileText, Check } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

export default function TenderPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/tender/${id}/preview`)
      setData(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  if (!data) return <div className="p-6 text-sm text-slate-400">No preview available</div>

  const { tender: t, estimate: e, documents = [], readiness = {} } = data

  const Row = ({ label, value, mono }) => (
    <div className="py-2 border-b border-dashed border-[#E2E8F0] last:border-0">
      <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">{label}</p>
      <p className={`text-sm text-[#0F172A] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/tenders/${id}/edit`} className="inline-flex items-center gap-1 text-xs text-[#1E3A5F] hover:underline mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Draft
          </Link>
          <h1 className="ec-page-title">Tender Preview</h1>
          <p className="ec-page-subtitle">Real data from the saved draft · {t.TenderNo}</p>
        </div>
        <button onClick={() => navigate(`/tenders/${id}/edit`)} className="ec-btn-secondary ec-btn-sm inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Edit Draft
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Notice header */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="text-center mb-6">
              <p className="text-xs text-[#64748B]">HMWSSB · NOTICE INVITING TENDER</p>
              <p className="text-lg font-bold text-[#1E3A5F] mt-1">Tender No. {t.TenderNo}</p>
              <p className="text-sm text-[#475569] mt-1">{e?.NameOfWork}</p>
              <p className="text-[10px] text-[#94A3B8]">{e?.WorkID}</p>
            </div>

            <div className="text-xs text-[#0F172A] leading-relaxed space-y-2">
              <p>
                The Executive Engineer / authority invites <strong>sealed tenders</strong> {t.TenderType ? ` (${t.TenderType}) ` : ' '}
                for the work {e?.NameOfWork} referenced as {e?.EstimateNo}, as per the details below.
              </p>
              {t.ScopeOfWork && <p><strong>Scope of Work:</strong> {t.ScopeOfWork}</p>}
              {t.PackageNumber && <p><strong>Package No.:</strong> {t.PackageNumber}</p>}
              {t.BidCallNumber && <p><strong>Bid Call No.:</strong> {t.BidCallNumber}</p>}
            </div>
          </div>

          {/* Key dates */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Schedule</span></div>
            <div className="ec-card-body grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              <Row label="Pre-Bid Meeting" value={fmtDate(t.PreBidMeetingDate)} />
              <Row label="Bid Submission Start" value={fmtDate(t.BidStartDate)} />
              <Row label="Bid Submission Closing" value={fmtDate(t.BidEndDate)} />
              <Row label="Technical Bid Opening" value={fmtDate(t.TechnicalBidOpeningDate)} />
              <Row label="Financial Bid Opening" value={fmtDate(t.FinancialBidOpeningDate)} />
              <Row label="Bid Validity" value={t.BidValidity ? `${t.BidValidity} days` : null} />
            </div>
          </div>

          {/* Commercial */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Commercial Details</span></div>
            <div className="ec-card-body grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              <Row label="Estimated Contract Value" value={fmt(t.EstimatedCost)} />
              <Row label="EMD / Bid Security" value={fmt(t.EMD)} />
              <Row label="Tender Fee" value={fmt(t.TenderFee)} />
              <Row label="Completion Period" value={t.CompletionPeriod} />
              <Row label="Contract Period" value={t.ContractPeriod} />
              <Row label="Defect Liability Period" value={t.DefectLiabilityPeriod} />
              <div className="col-span-full"><Row label="Performance Security" value={t.PerformanceSecurity} /></div>
              <div className="col-span-full"><Row label="Special Conditions" value={t.SpecialConditions} /></div>
            </div>
          </div>

          {/* Conditions */}
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Terms &amp; Conditions</span></div>
            <div className="ec-card-body space-y-4">
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Eligibility Criteria</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.EligibilityCriteria || '—'}</p></div>
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Qualification Criteria</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.QualificationCriteria || '—'}</p></div>
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Technical Requirements</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.TechnicalRequirements || '—'}</p></div>
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Required Documents</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.RequiredDocuments || '—'}</p></div>
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Instructions to Bidders</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.InstructionsToBidders || '—'}</p></div>
              <div><p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Tender Remarks</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{t.TenderRemarks || '—'}</p></div>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title">Authorities</span></div>
            <div className="ec-card-body">
              <Row label="Tender Inviting Authority" value={t.TenderInvitingAuthority} />
              <Row label="Officer Inviting Bids" value={t.OfficerInvitingBids} />
              <Row label="Bid Opening Authority" value={t.BidOpeningAuthority} />
              <Row label="Evaluation Type" value={t.EvaluationType} />
            </div>
          </div>

          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Readiness</span></div>
            <div className="ec-card-body">
              {readiness?.checks ? (
                <ul className="space-y-1.5">
                  {readiness.checks.map(c => (
                    <li key={c.key} className="flex items-start gap-2 text-xs">
                      {c.ok
                        ? <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        : <span className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0">•</span>
                      }
                      <span className={c.ok ? 'text-[#475569]' : 'text-[#0F172A] font-medium'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-[#94A3B8]">No readiness data saved.</p>}
            </div>
          </div>

          <div className="ec-card">
            <div className="ec-card-header"><span className="ec-card-title inline-flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documents ({documents.length})</span></div>
            <div className="ec-card-body">
              {documents.length === 0
                ? <p className="text-xs text-[#94A3B8]">No documents attached yet.</p>
                : <ul className="space-y-1.5">
                    {documents.map(d => (
                      <li key={d.DocumentID} className="flex items-center gap-2 text-xs text-[#475569]">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> {d.DocumentName}
                      </li>
                    ))}
                  </ul>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d)
  if (isNaN(dt)) return null
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}