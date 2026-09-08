import { useState, useEffect } from 'react'
import { Plus, X, Edit3, Hammer, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'

const STAGES = ['Site Handover', 'Excavation', 'Foundation', 'Superstructure', 'Pipelaying', 'Testing', 'Commissioning']
const initialForm = { EstimateID: '', Stage: '', Percentage: 0, Remarks: '', Date: '', Photos: '', InspectionNotes: '', EngineerRemarks: '', DelayReason: '' }

export default function ProgressList() {
  const [progress, setProgress] = useState([])
  const [estimates, setEstimates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [params] = useSearchParams()
  const estimateId = params.get('estimateId')

  useEffect(() => { load(); loadEstimates() }, [estimateId])
  const load = async () => {
    try {
      const res = await api.get(`/progress${estimateId ? `?estimateId=${encodeURIComponent(estimateId)}` : ''}`)
      setProgress(res.data || [])
    } catch (_) {}
  }
  const loadEstimates = async () => {
    try {
      const res = await api.get('/estimates?status=AgencySelected,WorkStarted,WorkCompleted')
      setEstimates(res.data || [])
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) { await api.put(`/progress/${editId}`, form); toast.success('Updated') }
      else { await api.post('/progress', form); toast.success('Created') }
      setShowForm(false); setEditId(null); setForm(initialForm); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const pctColor = (p) => {
    if (p >= 100) return 'text-[#059669]'
    if (p >= 50) return 'text-[#D97706]'
    return 'text-[#64748B]'
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Work Progress</h1>
          <p className="ec-page-subtitle">{progress.length} progress entr{progress.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(initialForm) }}
          className={`ec-btn-sm ${showForm ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Progress</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ec-card mb-5">
          <div className="ec-card-header">
            <span className="ec-card-title">{editId ? 'Edit Progress' : 'New Progress Entry'}</span>
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label htmlFor="EstimateID" className="ec-label">Estimate *</label>
                <select id="EstimateID" name="EstimateID" value={form.EstimateID} onChange={e => setForm({...form, EstimateID: e.target.value})} className="ec-select" disabled={!!editId}>
                  <option value="">Select Estimate</option>
                  {estimates.map(est => (
                    <option key={est.EstimateID} value={est.EstimateID}>{est.EstimateNo || est.WorkID} — {est.NameOfWork?.substring(0, 40)}</option>
                  ))}
                </select>
              </div>
              <div className="ec-form-group"><label htmlFor="Stage" className="ec-label">Stage</label>
                <select id="Stage" name="Stage" value={form.Stage} onChange={e => setForm({...form, Stage: e.target.value})} className="ec-select">
                  <option value="">Select Stage</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ec-form-group"><label htmlFor="Percentage" className="ec-label">Percentage</label>
                <select id="Percentage" name="Percentage" value={form.Percentage} onChange={e => setForm({...form, Percentage: parseInt(e.target.value)})} className="ec-select">
                  <option value={0}>0%</option><option value={25}>25%</option><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option>
                </select>
              </div>
              <div className="ec-form-group"><label htmlFor="Date" className="ec-label">Date</label><input id="Date" name="Date" type="date" value={form.Date} onChange={e => setForm({...form, Date: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="Remarks" className="ec-label">Remarks</label><input id="Remarks" name="Remarks" type="text" value={form.Remarks} onChange={e => setForm({...form, Remarks: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="InspectionNotes" className="ec-label">Inspection Notes</label><textarea id="InspectionNotes" name="InspectionNotes" value={form.InspectionNotes} onChange={e => setForm({...form, InspectionNotes: e.target.value})} className="ec-input" rows={2} /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="EngineerRemarks" className="ec-label">Engineer Remarks</label><textarea id="EngineerRemarks" name="EngineerRemarks" value={form.EngineerRemarks} onChange={e => setForm({...form, EngineerRemarks: e.target.value})} className="ec-input" rows={2} /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="DelayReason" className="ec-label">Delay Reason (if any)</label><input id="DelayReason" name="DelayReason" type="text" value={form.DelayReason} onChange={e => setForm({...form, DelayReason: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="Photos" className="ec-label">Photos (URLs, comma-separated)</label><input id="Photos" name="Photos" type="text" value={form.Photos} onChange={e => setForm({...form, Photos: e.target.value})} placeholder="https://..., https://..." className="ec-input" /></div>
              <div className="flex items-end"><button type="submit" className="ec-btn-primary ec-btn-sm">Save</button></div>
            </div>
          </div>
        </form>
      )}

      <div className="ec-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead><tr><th>Work ID</th><th>Work Name</th><th>Stage</th><th className="text-right">%</th><th>Date</th><th>Remarks</th><th>Inspection / Engineer</th><th>Delay</th><th>Photos</th><th>Actions</th></tr></thead>
            <tbody>
              {progress.map(p => (
                <tr key={p.ProgressID}>
                  <td className="font-mono text-xs text-[#1E3A5F]">{p.WorkID}</td>
                  <td className="text-xs max-w-[150px] truncate text-[#64748B]">{p.NameOfWork}</td>
                  <td className="text-xs">{p.Stage}</td>
                  <td className={`text-right text-xs font-bold ${pctColor(p.Percentage)}`}>{p.Percentage}%</td>
                  <td className="text-xs text-[#64748B]">{p.Date?.slice(0, 10)}</td>
                  <td className="text-xs max-w-[160px] truncate text-[#64748B]">{p.Remarks}</td>
                  <td className="text-xs max-w-[200px] text-[#64748B]">
                    {p.InspectionNotes && <p className="truncate">Inspection: {p.InspectionNotes}</p>}
                    {p.EngineerRemarks && <p className="truncate">Eng: {p.EngineerRemarks}</p>}
                    {!p.InspectionNotes && !p.EngineerRemarks && '-'}
                  </td>
                  <td className="text-xs max-w-[120px] truncate text-[#64748B]">{p.DelayReason || '-'}</td>
                  <td className="text-xs">
                    {p.Photos ? (
                      <a href={p.Photos.split(',')[0].trim()} target="_blank" rel="noreferrer" className="text-[#1E3A5F] underline">View</a>
                    ) : '-'}
                  </td>
                  <td><button onClick={() => { setEditId(p.ProgressID); setForm(p); setShowForm(true) }} className="text-[#1E3A5F] hover:underline text-xs flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button></td>
                </tr>
              ))}
              {progress.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-sm text-[#94A3B8]">No progress entries</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
