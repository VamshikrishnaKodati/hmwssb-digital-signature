import { useState, useEffect } from 'react'
import { Edit3, Eye, RefreshCcw, FileText, Plus, Lock } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'
import StatusBadge from '../components/shared/StatusBadge'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

export default function TenderList() {
  const [tenders, setTenders] = useState([])
  const [ready, setReady] = useState([])
  const [params] = useSearchParams()
  const estimateId = params.get('estimateId')
  const statusFilter = params.get('status')
  const createdByFilter = params.get('createdBy')
  const viewReady = params.get('view') === 'ready'
  const editing = params.get('editing')

  useEffect(() => { load() }, [estimateId, statusFilter, createdByFilter, viewReady, editing])

  const load = async () => {
    try {
      const sp = new URLSearchParams()
      if (estimateId) sp.set('estimateId', estimateId)
      if (statusFilter) sp.set('status', statusFilter)
      if (createdByFilter) sp.set('createdBy', createdByFilter)
      const qs = sp.toString()
      const res = await api.get(`/tender${qs ? `?${qs}` : ''}`)
      setTenders(res.data || [])

      if (viewReady) {
        const r = await api.get('/tender/ready')
        setReady(r.data || [])
      } else {
        setReady([])
      }
    } catch (_) {}
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Tenders</h1>
          <p className="ec-page-subtitle">
            {viewReady
              ? `${ready.length} estimate${ready.length !== 1 ? 's' : ''} ready for tender (TS-approved)`
              : `${tenders.length} tender${tenders.length !== 1 ? 's' : ''} on record`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/tenders?view=ready" className="ec-btn-primary ec-btn-sm inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create Tender
          </Link>
          <button onClick={load} className="ec-btn-secondary ec-btn-sm inline-flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {viewReady && (
        <div className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-800">
          <p className="font-semibold inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Ready for Tender</p>
          <p className="mt-1 text-cyan-700">
            These estimates have completed MD Final Approval, FCN, Administrative Sanction and Technical Sanction approval.
            As Tender Officer, select one to build its tender draft. Drafts stay alive here until the tender is published.
          </p>
        </div>
      )}

      {viewReady ? (
        <div className="ec-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead><tr><th>Estimate No</th><th>Name of Work</th><th className="text-right">Est. Value</th><th>FCN / AS / TS</th><th>Ready Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {ready.map(r => (
                  <tr key={r.EstimateID}>
                    <td className="font-medium text-xs">{r.EstimateNo}</td>
                    <td className="text-xs max-w-[220px] truncate text-[#64748B]">{r.NameOfWork}</td>
                    <td className="text-right text-xs font-medium">{fmt(r.EstimatedContractValue)}</td>
                    <td className="text-[10px] text-[#64748B]">{r.FCNNo} / {r.ASNo} / {r.TSNo}</td>
                    <td className="text-xs text-[#64748B]">{r.ReadyDate?.slice(0, 10)}</td>
                    <td>
                      {r.TenderStatus === 'TenderDraft'
                        ? <span className="ec-badge ec-badge-draft">Draft</span>
                        : <span className="ec-badge ec-badge-warning">Ready</span>}
                    </td>
                    <td>
                      {r.TenderID
                        ? <Link to={`/tenders/${r.TenderID}/edit`} className="text-[#1E3A5F] hover:underline text-xs inline-flex items-center gap-1"><Edit3 className="w-3 h-3" /> Continue Draft</Link>
                        : <Link to={`/tenders/new?estimate=${r.EstimateID}`} className="text-cyan-700 hover:underline text-xs inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Create Tender</Link>}
                    </td>
                  </tr>
                ))}
                {ready.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">No estimates are ready for tender</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="ec-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead><tr><th>Tender No</th><th>Work ID</th><th>Name of Work</th><th>Date</th><th className="text-right">Est. Cost</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {tenders.map(t => (
                  <tr key={t.TenderID}>
                    <td className="font-medium text-xs">{t.TenderNo}</td>
                    <td className="font-mono text-xs text-[#1E3A5F]">{t.WorkID}</td>
                    <td className="text-xs max-w-[200px] truncate text-[#64748B]">{t.NameOfWork}</td>
                    <td className="text-xs text-[#64748B]">{t.TenderDate?.slice(0, 10)}</td>
                    <td className="text-right text-xs font-medium">{fmt(t.EstimatedCost)}</td>
                    <td>
                      <StatusBadge status={t.effectiveStatus || t.Status} />
                    </td>
                    <td><div className="flex items-center gap-3">
                      {t.Status === 'TenderDraft' || t.Status === 'Draft'
                        ? <Link to={`/tenders/${t.TenderID}/edit`} className="text-[#1E3A5F] hover:underline text-xs flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit Draft</Link>
                        : <Link to={`/tenders/${t.TenderID}`} className="text-[#1E3A5F] hover:underline text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> View</Link>}
                      {t.Status === 'TenderDraft' && (
                        <Link to={`/tenders/${t.TenderID}/preview`} className="text-[#1E3A5F] hover:underline text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</Link>
                      )}
                    </div></td>
                  </tr>
                ))}
                {tenders.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">No tenders</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}