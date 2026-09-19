import { useState, useEffect } from 'react'
import { Search, Plus, X, Edit3, History } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const initialForm = {
  ItemCode: '', Description: '', Unit: '', Category: 'Civil',
  FormulaType: 'N', RateIncludesGST: false, Rate: '',
}

export default function AdminItems() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [rateHistory, setRateHistory] = useState(null)

  useEffect(() => { loadItems() }, [])

  const loadItems = async () => {
    try {
      const res = await api.get(`/items?search=${search}&active=true`)
      setItems(res.data || [])
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) { await api.put(`/items/${editingId}`, form); toast.success('Item updated') }
      else { await api.post('/items', form); toast.success('Item created') }
      setShowForm(false); setForm(initialForm); setEditingId(null); loadItems()
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving item') }
  }

  const editItem = (item) => {
    setForm({
      ItemCode: item.ItemCode, Description: item.Description, Unit: item.Unit,
      Category: item.Category, FormulaType: item.FormulaType,
      RateIncludesGST: item.RateIncludesGST, Rate: item.Rate || '',
    })
    setEditingId(item.ItemID)
    setShowForm(true)
  }

  const viewRateHistory = async (itemId) => {
    try {
      const res = await api.get(`/items/${itemId}/rate-history`)
      setRateHistory(res.data || [])
    } catch (_) {}
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Item Master</h1>
          <p className="ec-page-subtitle">Manage Schedule of Rates (SoR) items</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(initialForm) }}
          className={`ec-btn-sm ${showForm ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Item</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ec-card mb-5">
          <div className="ec-card-header">
            <span className="ec-card-title">{editingId ? 'Edit Item' : 'New Item'}</span>
          </div>
          <div className="ec-card-body space-y-4">
            <div className="ec-grid-3">
              <div className="ec-form-group">
                <label className="ec-label" htmlFor="item-code">Item Code *</label>
                <input id="item-code" name="ItemCode" type="text" value={form.ItemCode} onChange={e => setForm({...form, ItemCode: e.target.value})}
                  disabled={!!editingId} className="ec-input" required />
              </div>
              <div className="ec-form-group">
                <label className="ec-label" htmlFor="item-unit">Unit *</label>
                <input id="item-unit" name="Unit" type="text" value={form.Unit} onChange={e => setForm({...form, Unit: e.target.value})}
                  className="ec-input" required />
              </div>
              <div className="ec-form-group">
                <label className="ec-label" htmlFor="item-category">Category *</label>
                <select id="item-category" name="Category" value={form.Category} onChange={e => setForm({...form, Category: e.target.value})}
                  className="ec-select">
                  <option value="Civil">Civil</option>
                  <option value="Material">Material</option>
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label" htmlFor="item-formula">Formula Type *</label>
                <select id="item-formula" name="FormulaType" value={form.FormulaType} onChange={e => setForm({...form, FormulaType: e.target.value})}
                  className="ec-select">
                  <option value="N">N (Count)</option>
                  <option value="L">L (Length)</option>
                  <option value="LxB">L x B</option>
                  <option value="LxBxD">L x B x D</option>
                  <option value="NxL">N x L</option>
                  <option value="NxLxBxD">N x L x B x D</option>
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label" htmlFor="item-rate">Rate (₹)</label>
                <input id="item-rate" name="Rate" type="number" step="0.01" value={form.Rate}
                  onChange={e => setForm({...form, Rate: e.target.value})} className="ec-input" />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-[#475569] cursor-pointer">
                  <input id="item-rate-gst" name="RateIncludesGST" type="checkbox" checked={form.RateIncludesGST}
                    onChange={e => setForm({...form, RateIncludesGST: e.target.checked})}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB]" />
                  Rate includes GST
                </label>
              </div>
            </div>
            <div className="ec-form-group">
              <label className="ec-label" htmlFor="item-desc">Description *</label>
              <textarea id="item-desc" name="Description" value={form.Description} onChange={e => setForm({...form, Description: e.target.value})}
                className="ec-textarea" required />
            </div>
            <button type="submit" className="ec-btn-primary">{editingId ? 'Update Item' : 'Create Item'}</button>
          </div>
        </form>
      )}

      <div className="ec-card">
        <div className="ec-card-body">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input id="admin-item-search" name="search" type="text" placeholder="Search by code or description..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="ec-input pl-9"
                onKeyDown={e => e.key === 'Enter' && loadItems()} />
            </div>
            <button onClick={loadItems} className="ec-btn-primary ec-btn-sm">
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Category</th>
                  <th>Formula</th>
                  <th className="text-right">Rate</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.ItemID}>
                    <td className="font-medium text-xs text-[#2563EB]">{item.ItemCode}</td>
                    <td className="max-w-[250px] truncate text-xs">{item.Description}</td>
                    <td className="text-xs">{item.Unit}</td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        item.Category === 'Civil' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>{item.Category}</span>
                    </td>
                    <td className="font-mono text-[10px]">{item.FormulaType}</td>
                    <td className="text-right text-xs font-medium">{fmt(item.Rate)}</td>
                    <td className="text-xs">{item.IsActive ? <span className="text-[#059669] font-bold">&#10003;</span> : <span className="text-[#CBD5E1]">&#10007;</span>}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => editItem(item)}
                          className="text-[#2563EB] hover:underline text-xs flex items-center gap-1">
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => viewRateHistory(item.ItemID)}
                          className="text-[#475569] hover:underline text-xs flex items-center gap-1">
                          <History className="w-3 h-3" /> Rates
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">No items found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {rateHistory && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setRateHistory(null)}>
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full mx-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#0F172A] mb-3">Rate History</h3>
            <table className="ec-table">
              <thead>
                <tr><th>Rate</th><th>From</th><th>To</th></tr>
              </thead>
              <tbody>
                {rateHistory.map(rh => (
                  <tr key={rh.RateHistoryID}>
                    <td className="font-medium text-xs">{fmt(rh.Rate)}</td>
                    <td className="text-xs">{rh.EffectiveFrom?.slice(0, 10)}</td>
                    <td className="text-xs">{rh.EffectiveTo?.slice(0, 10) || 'Current'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setRateHistory(null)} className="ec-btn-ghost ec-btn-sm mt-3">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
