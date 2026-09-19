import { useState, useEffect, useMemo } from 'react'
import { Plus, X, CheckCircle, Trash2, Eye, Pencil, Search, Filter } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'

const initialForm = { EstimateID: '', DetailID: '', PreviousQty: 0, CurrentQty: '', MeasuredDate: '', Remarks: '' }

export default function MeasurementList() {
  const [entries, setEntries] = useState([])
  const [estimates, setEstimates] = useState([])
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const role = user.Designation
  const [params] = useSearchParams()
  const estimateId = params.get('estimateId')

  useEffect(() => { load(); loadEstimates() }, [estimateId])
  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/measurement' + (estimateId ? '?estimateId=' + encodeURIComponent(estimateId) : ''))
      setEntries(res.data || [])
    } catch (_) { toast.error('Unable to load measurements') }
    setLoading(false)
  }
  const loadEstimates = async () => {
    try {
      const res = await api.get('/estimates?status=AgencySelected,WorkStarted,WorkCompleted')
      setEstimates(res.data || [])
    } catch (_) {}
  }
  const loadItems = async (id) => {
    if (!id) { setItems([]); return }
    try {
      const res = await api.get('/estimates/' + id)
      setItems(res.data?.Items || [])
    } catch (_) { setItems([]) }
  }

  const filtered = useMemo(() => {
    let list = entries
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        (m.EstimateNo || '').toLowerCase().includes(q) ||
        (m.NameOfWork || '').toLowerCase().includes(q) ||
        (m.ItemCode || '').toLowerCase().includes(q) ||
        (m.Description || '').toLowerCase().includes(q) ||
        String(m.MeasurementID).includes(q)
      )
    }
    if (filterStatus) list = list.filter(m => m.Status === filterStatus)
    if (filterDate) list = list.filter(m => (m.MeasuredDate || '').slice(0, 10) === filterDate)
    return list
  }, [entries, search, filterStatus, filterDate])

  const handleEstimateChange = (e) => {
    setForm({ ...form, EstimateID: e.target.value, DetailID: '' })
    loadItems(e.target.value)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({
      EstimateID: m.EstimateID,
      DetailID: m.DetailID || '',
      PreviousQty: m.PreviousQty,
      CurrentQty: m.CurrentQty,
      MeasuredDate: m.MeasuredDate ? m.MeasuredDate.slice(0, 10) : '',
      Remarks: m.Remarks || '',
    })
    loadItems(m.EstimateID)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false); setEditing(null); setForm(initialForm); setItems([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const sel = items.find(it => it.DetailID === parseInt(form.DetailID))
    const payload = {
      EstimateID: parseInt(form.EstimateID),
      DetailID: sel ? sel.DetailID : (form.DetailID || null),
      PreviousQty: parseFloat(form.PreviousQty || 0),
      CurrentQty: parseFloat(form.CurrentQty),
      MeasuredDate: form.MeasuredDate || null,
      Remarks: form.Remarks || null,
    }
    try {
      if (editing) {
        await api.put('/measurement/' + editing.MeasurementID, payload)
        toast.success('Measurement updated')
      } else {
        await api.post('/measurement', payload)
        toast.success('Measurement recorded')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const verify = async (id) => {
    setBusy(id)
    try { await api.post('/measurement/' + id + '/verify'); toast.success('Verified'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Verify failed') }
    setBusy('')
  }

  const remove = async (id) => {
    if (!confirm('Delete this measurement?')) return
    setBusy(id)
    try { await api.delete('/measurement/' + id); toast.success('Deleted'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
    setBusy('')
  }

  const fmt = (v) => v === null || v === undefined ? '-' : parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Measurement Book</h1>
          <p className="ec-page-subtitle">{entries.length} measurement{entries.length !== 1 ? 's' : ''} on record</p>
        </div>
        {role === 'SiteEngineer' && (
          <button onClick={() => { showForm ? closeForm() : setShowForm(true) }}
            className={'ec-btn-sm ' + (showForm ? 'ec-btn-ghost' : 'ec-btn-primary')}>
            {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Record Measurement</>}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input type="text" placeholder="Search by estimate, item, or MB ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="ec-input pl-8 text-xs" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ec-select text-xs w-auto">
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Verified">Verified</option>
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="ec-input text-xs w-auto" />
        {(search || filterStatus || filterDate) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterDate('') }}
            className="text-xs text-[#475569] hover:text-[#2563EB] flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ec-card mb-5">
          <div className="ec-card-header"><span className="ec-card-title">{editing ? 'Edit Measurement #' + editing.MeasurementID : 'New Measurement Entry'}</span></div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label htmlFor="EstimateID" className="ec-label">Estimate *</label>
                <select id="EstimateID" name="EstimateID" value={form.EstimateID} onChange={handleEstimateChange} className="ec-select" disabled={!!editing}>
                  <option value="">Select Estimate</option>
                  {estimates.map(est => (
                    <option key={est.EstimateID} value={est.EstimateID}>{est.EstimateNo} — {est.NameOfWork?.substring(0, 40)}</option>
                  ))}
                </select>
              </div>
              <div className="ec-form-group">
                <label htmlFor="DetailID" className="ec-label">Item</label>
                <select id="DetailID" name="DetailID" value={form.DetailID} onChange={e => setForm({...form, DetailID: e.target.value})} className="ec-select" disabled={!form.EstimateID}>
                  <option value="">Free text item</option>
                  {items.map(it => (
                    <option key={it.DetailID} value={it.DetailID}>{it.ItemCode} — {it.Description?.substring(0, 40)}</option>
                  ))}
                </select>
              </div>
              <div className="ec-form-group">
                <label htmlFor="PreviousQty" className="ec-label">Previous Qty</label>
                <input id="PreviousQty" name="PreviousQty" type="number" step="0.001" min="0" value={form.PreviousQty} onChange={e => setForm({...form, PreviousQty: e.target.value})} className="ec-input" />
              </div>
              <div className="ec-form-group">
                <label htmlFor="CurrentQty" className="ec-label">Current Qty *</label>
                <input id="CurrentQty" name="CurrentQty" type="number" step="0.001" min="0" value={form.CurrentQty} onChange={e => setForm({...form, CurrentQty: e.target.value})} className="ec-input" required />
              </div>
              <div className="ec-form-group">
                <label htmlFor="MeasuredDate" className="ec-label">Measured Date</label>
                <input id="MeasuredDate" name="MeasuredDate" type="date" value={form.MeasuredDate} onChange={e => setForm({...form, MeasuredDate: e.target.value})} className="ec-input" />
              </div>
              <div className="ec-form-group ec-col-span-2">
                <label htmlFor="Remarks" className="ec-label">Remarks</label>
                <input id="Remarks" name="Remarks" type="text" value={form.Remarks} onChange={e => setForm({...form, Remarks: e.target.value})} className="ec-input" />
              </div>
              <div className="flex items-end"><button type="submit" className="ec-btn-primary ec-btn-sm">{editing ? 'Update' : 'Save'}</button></div>
            </div>
          </div>
        </form>
      )}

      <div className="ec-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead><tr>
              <th>MB ID</th><th>Estimate</th><th>Item</th>
              <th className="text-right">Prev Qty</th><th className="text-right">Current Qty</th>
              <th className="text-right">Cumulative</th><th className="text-right">Balance</th>
              <th>Date</th><th>Status</th><th>Recorded By</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center py-8 text-sm text-[#475569]">Loading...</td></tr>}
              {!loading && filtered.map(m => (
                <tr key={m.MeasurementID}>
                  <td className="font-mono text-xs text-[#2563EB] font-medium">#{m.MeasurementID}</td>
                  <td className="text-xs">{m.EstimateNo || '-'}</td>
                  <td className="text-xs max-w-[180px]"><span className="font-medium">{m.ItemCode || '-'}</span><span className="block text-[10px] text-[#475569] truncate">{m.Description}</span></td>
                  <td className="text-right text-xs">{fmt(m.PreviousQty)}</td>
                  <td className="text-right text-xs font-medium">{fmt(m.CurrentQty)} <span className="text-[10px] text-[#94A3B8]">{m.Unit || ''}</span></td>
                  <td className="text-right text-xs font-bold text-[#2563EB]">{fmt(m.CumulativeQty)}</td>
                  <td className="text-right text-xs">{fmt(m.BalanceQty)}</td>
                  <td className="text-xs text-[#475569]">{m.MeasuredDate?.slice(0, 10)}</td>
                  <td><span className={'ec-badge ' + (m.Status === 'Verified' ? 'ec-badge-success' : 'ec-badge-draft')}>{m.Status}</span></td>
                  <td className="text-xs text-[#475569]">{m.MeasuredByName || '-'}{m.VerifiedByName && <span className="block text-[10px] text-[#059669]">v {m.VerifiedByName}</span>}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setViewing(m)} className="text-[#475569] hover:text-[#2563EB] text-xs" title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {m.Status === 'Draft' && role === 'SiteEngineer' && (
                        <button onClick={() => openEdit(m)} className="text-[#2563EB] hover:underline text-xs flex items-center gap-0.5" title="Edit">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {m.Status === 'Draft' && role === 'BillingOfficer' && (
                        <button onClick={() => verify(m.MeasurementID)} disabled={busy === m.MeasurementID}
                          className="text-[#059669] hover:underline text-xs flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" /> {busy === m.MeasurementID ? '...' : 'Verify'}
                        </button>
                      )}
                      {m.Status === 'Draft' && role === 'SiteEngineer' && (
                        <button onClick={() => remove(m.MeasurementID)} disabled={busy === m.MeasurementID}
                          className="text-[#DC2626] hover:underline text-xs flex items-center gap-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && entries.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-sm text-[#94A3B8]">No measurements recorded yet. Use "Record Measurement" to add one.</td></tr>
              )}
              {!loading && filtered.length === 0 && entries.length > 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-sm text-[#94A3B8]">No measurements match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 text-[10px] text-[#94A3B8] border-t border-[#CBD5E1]">
            Showing {filtered.length} of {entries.length} measurement{entries.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#0F172A]">Measurement #{viewing.MeasurementID}</h2>
              <button onClick={() => setViewing(null)} className="text-[#94A3B8] hover:text-[#475569]"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Estimate', viewing.EstimateNo || '-'],
                ['Work', viewing.NameOfWork || '-'],
                ['Item Code', viewing.ItemCode || '-'],
                ['Description', viewing.Description || '-'],
                ['Unit', viewing.Unit || '-'],
                ['Previous Qty', fmt(viewing.PreviousQty)],
                ['Current Qty', fmt(viewing.CurrentQty)],
                ['Cumulative Qty', fmt(viewing.CumulativeQty)],
                ['Balance Qty', fmt(viewing.BalanceQty)],
                ['Date', viewing.MeasuredDate?.slice(0, 10) || '-'],
                ['Status', viewing.Status],
                ['Recorded By', viewing.MeasuredByName || '-'],
                ['Verified By', viewing.VerifiedByName || '-'],
                ['Remarks', viewing.Remarks || '-'],
              ].map(([label, value]) => (
                <div key={label} className={label === 'Work' || label === 'Description' || label === 'Remarks' ? 'col-span-2' : ''}>
                  <span className="text-[#94A3B8] block mb-0.5">{label}</span>
                  <span className="text-[#0F172A] font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
