import { useState, useEffect } from 'react'
import { Plus, X, Edit3, Building2, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'

const initialForm = { EstimateID: '', TenderID: '', AgencyName: '', AgencyCode: '', AgreementNo: '', AgreementDate: '', TenderValue: '', CompletionPeriod: '', SecurityDeposit: '', PerformanceGuarantee: '', ContactDetails: '', ContractorName: '', WorkOrderDate: '', StartDate: '', CompletionDate: '' }

export default function AgencyList() {
  const [agencies, setAgencies] = useState([])
  const [estimates, setEstimates] = useState([])
  const [tenders, setTenders] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editId, setEditId] = useState(null)
  const [params] = useSearchParams()
  const estimateId = params.get('estimateId')

  useEffect(() => { load(); loadLookups() }, [estimateId])
  const load = async () => {
    try {
      const res = await api.get(`/agency${estimateId ? `?estimateId=${encodeURIComponent(estimateId)}` : ''}`)
      setAgencies(res.data || [])
    } catch (_) {}
  }
  const loadLookups = async () => {
    try {
      const [estRes, tenRes] = await Promise.all([api.get('/estimates?status=TenderPublished'), api.get('/tender')])
      setEstimates(estRes.data || [])
      setTenders(tenRes.data || [])
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) { await api.put(`/agency/${editId}`, form); toast.success('Updated') }
      else { await api.post('/agency', form); toast.success('Created') }
      setShowForm(false); setEditId(null); setForm(initialForm); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Agencies</h1>
          <p className="ec-page-subtitle">{agencies.length} agenc{agencies.length !== 1 ? 'ies' : 'y'} on record</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(initialForm) }}
          className={`ec-btn-sm ${showForm ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Agency</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ec-card mb-5">
          <div className="ec-card-header">
            <span className="ec-card-title">{editId ? 'Edit Agency' : 'New Agency'}</span>
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label htmlFor="EstimateID" className="ec-label">Estimate *</label>
                <select id="EstimateID" name="EstimateID" value={form.EstimateID} onChange={e => setForm({...form, EstimateID: e.target.value})} className="ec-select" disabled={!!editId}>
                  <option value="">Select Estimate (Tender Published)</option>
                  {estimates.map(est => (
                    <option key={est.EstimateID} value={est.EstimateID}>{est.EstimateNo || est.WorkID}</option>
                  ))}
                </select>
              </div>
              <div className="ec-form-group">
                <label htmlFor="TenderID" className="ec-label">Tender</label>
                <select id="TenderID" name="TenderID" value={form.TenderID} onChange={e => {
                  const ten = tenders.find(t => t.TenderID === parseInt(e.target.value))
                  setForm({...form, TenderID: e.target.value, TenderValue: ten ? ten.EstimatedCost : '' })
                }} className="ec-select">
                  <option value="">Select Tender</option>
                  {tenders.map(t => <option key={t.TenderID} value={t.TenderID}>{t.TenderNo || `Tender #${t.TenderID}`}</option>)}
                </select>
              </div>
              <div className="ec-form-group"><label htmlFor="AgencyName" className="ec-label">Agency Name</label><input id="AgencyName" name="AgencyName" type="text" value={form.AgencyName} onChange={e => setForm({...form, AgencyName: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="AgencyCode" className="ec-label">Agency Code</label><input id="AgencyCode" name="AgencyCode" type="text" value={form.AgencyCode} onChange={e => setForm({...form, AgencyCode: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="ContractorName" className="ec-label">Contractor Name</label><input id="ContractorName" name="ContractorName" type="text" value={form.ContractorName} onChange={e => setForm({...form, ContractorName: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="AgreementNo" className="ec-label">Agreement No</label><input id="AgreementNo" name="AgreementNo" type="text" value={form.AgreementNo} onChange={e => setForm({...form, AgreementNo: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="AgreementDate" className="ec-label">Agreement Date</label><input id="AgreementDate" name="AgreementDate" type="date" value={form.AgreementDate} onChange={e => setForm({...form, AgreementDate: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="TenderValue" className="ec-label">Tender Value</label><input id="TenderValue" name="TenderValue" type="number" step="0.01" value={form.TenderValue} onChange={e => setForm({...form, TenderValue: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="CompletionPeriod" className="ec-label">Completion Period</label><input id="CompletionPeriod" name="CompletionPeriod" type="text" value={form.CompletionPeriod} onChange={e => setForm({...form, CompletionPeriod: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="WorkOrderDate" className="ec-label">Work Order Date</label><input id="WorkOrderDate" name="WorkOrderDate" type="date" value={form.WorkOrderDate} onChange={e => setForm({...form, WorkOrderDate: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="StartDate" className="ec-label">Start Date</label><input id="StartDate" name="StartDate" type="date" value={form.StartDate} onChange={e => setForm({...form, StartDate: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="CompletionDate" className="ec-label">Completion Date</label><input id="CompletionDate" name="CompletionDate" type="date" value={form.CompletionDate} onChange={e => setForm({...form, CompletionDate: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="SecurityDeposit" className="ec-label">Security Deposit</label><input id="SecurityDeposit" name="SecurityDeposit" type="number" step="0.01" value={form.SecurityDeposit} onChange={e => setForm({...form, SecurityDeposit: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group"><label htmlFor="PerformanceGuarantee" className="ec-label">Perf. Guarantee</label><input id="PerformanceGuarantee" name="PerformanceGuarantee" type="number" step="0.01" value={form.PerformanceGuarantee} onChange={e => setForm({...form, PerformanceGuarantee: e.target.value})} className="ec-input" /></div>
              <div className="ec-form-group ec-col-span-2"><label htmlFor="ContactDetails" className="ec-label">Contact Details</label><input id="ContactDetails" name="ContactDetails" type="text" value={form.ContactDetails} onChange={e => setForm({...form, ContactDetails: e.target.value})} className="ec-input" /></div>
              <div className="flex items-end"><button type="submit" className="ec-btn-primary ec-btn-sm">Save</button></div>
            </div>
          </div>
        </form>
      )}

      <div className="ec-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead><tr><th>Agency</th><th>Contractor</th><th>Agreement No</th><th>Work ID</th><th className="text-right">Value</th><th>Start Date</th><th>Completion Date</th><th>Actions</th></tr></thead>
            <tbody>
              {agencies.map(a => (
                <tr key={a.AgencyID}>
                  <td className="font-medium text-xs">{a.AgencyName}</td>
                  <td className="text-xs">{a.ContractorName}</td>
                  <td className="text-xs">{a.AgreementNo}</td>
                  <td className="font-mono text-xs">{a.WorkID}</td>
                  <td className="text-right text-xs font-medium">{fmt(a.TenderValue)}</td>
                  <td className="text-xs text-[#64748B]">{a.StartDate?.slice(0, 10) || '-'}</td>
                  <td className="text-xs text-[#64748B]">{a.CompletionDate?.slice(0, 10) || '-'}</td>
                  <td><button onClick={() => { setEditId(a.AgencyID); setForm(a); setShowForm(true) }} className="text-[#1E3A5F] hover:underline text-xs flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button></td>
                </tr>
              ))}
              {agencies.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">No agencies</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
