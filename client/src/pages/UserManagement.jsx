import { useState, useEffect } from 'react'
import { Plus, X, Edit3, Users, ShieldCheck, RefreshCw } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { roleLabel } from '../config/navConfig'

const DESIGNATIONS = ['Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'SoRAdmin', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead']

const emptyForm = {
  Username: '', Password: '', Name: '', Designation: '',
  RegionID: '', ZoneID: '', DivisionID: '', CircleID: '', WardID: '',
  MobileNumber: '', Email: '',
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  const [regions, setRegions] = useState([])
  const [zones, setZones] = useState([])
  const [divisions, setDivisions] = useState([])
  const [circles, setCircles] = useState([])
  const [wards, setWards] = useState([])

  const load = async () => {
    setLoading(true)
    try { const res = await api.get('/users'); setUsers(res.data || []) }
    catch (_) { toast.error('Failed to load users') }
    setLoading(false)
  }

  useEffect(() => {
    load()
    api.get('/lookups/regions').then(r => setRegions(r.data || [])).catch(() => {})
  }, [])

  const loadChild = async (endpoint, setter) => {
    try { const res = await api.get(endpoint); setter(res.data || []) }
    catch (_) { setter([]) }
  }

  const onRegion = (v) => {
    setForm({ ...form, RegionID: v, ZoneID: '', DivisionID: '', CircleID: '', WardID: '' })
    setZones([]); setDivisions([]); setCircles([]); setWards([])
    if (v) loadChild(`/lookups/zones?regionId=${v}`, setZones)
  }
  const onZone = (v) => {
    setForm({ ...form, ZoneID: v, DivisionID: '', CircleID: '', WardID: '' })
    setDivisions([]); setCircles([]); setWards([])
    if (v) loadChild(`/lookups/divisions?zoneId=${v}`, setDivisions)
  }
  const onDivision = (v) => {
    setForm({ ...form, DivisionID: v, CircleID: '', WardID: '' })
    setCircles([]); setWards([])
    if (v) loadChild(`/lookups/circles?divisionId=${v}`, setCircles)
  }
  const onCircle = (v) => {
    setForm({ ...form, CircleID: v, WardID: '' })
    setWards([])
    if (v) loadChild(`/lookups/wards?circleId=${v}`, setWards)
  }

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (u) => {
    setEditId(u.UserID)
    setForm({
      Username: u.Username, Password: '', Name: u.Name, Designation: u.Designation,
      RegionID: u.RegionID || '', ZoneID: u.ZoneID || '', DivisionID: u.DivisionID || '',
      CircleID: u.CircleID || '', WardID: u.WardID || '',
      MobileNumber: u.MobileNumber || '', Email: u.Email || '',
    })
    setShowForm(true)
    if (u.ZoneID) loadChild(`/lookups/zones?regionId=${u.RegionID}`, setZones)
    if (u.DivisionID) loadChild(`/lookups/divisions?zoneId=${u.ZoneID}`, setDivisions)
    if (u.CircleID) loadChild(`/lookups/circles?divisionId=${u.DivisionID}`, setCircles)
    if (u.WardID) loadChild(`/lookups/wards?circleId=${u.CircleID}`, setWards)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form }
      if (!payload.Password) delete payload.Password
      if (editId) {
        await api.put(`/users/${editId}`, payload)
        toast.success('User updated')
      } else {
        await api.post('/users', payload)
        toast.success('User created')
      }
      setShowForm(false); setForm(emptyForm); setEditId(null); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    setBusy(false)
  }

  const locationOf = (u) =>
    [u.RegionName, u.ZoneName, u.DivisionName, u.CircleName, u.WardName].filter(Boolean).join(' → ') || '—'

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">User Management</h1>
          <p className="ec-page-subtitle">{users.length} users on record</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="ec-btn-sm ec-btn-ghost" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={showForm ? () => setShowForm(false) : openNew}
            className={`ec-btn-sm ${showForm ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
            {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add User</>}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ec-card mb-5">
          <div className="ec-card-header">
            <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
            <span className="ec-card-title">{editId ? `Edit — ${form.Name}` : 'New User'}</span>
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label className="ec-label">Username *</label>
                <input className="ec-input" value={form.Username} disabled={!!editId}
                  onChange={e => setForm({ ...form, Username: e.target.value.trim() })} required autoComplete="off" />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">{editId ? 'Reset Password (blank = keep)' : 'Password *'}</label>
                <input className="ec-input" type="password" value={form.Password} autoComplete="new-password"
                  onChange={e => setForm({ ...form, Password: e.target.value })}
                  required={!editId} minLength={6} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Name *</label>
                <input className="ec-input" value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} required />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Designation *</label>
                <select className="ec-select" value={form.Designation} onChange={e => setForm({ ...form, Designation: e.target.value })} required>
                  <option value="">Select Designation</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{roleLabel(d)}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Email</label>
                <input className="ec-input" type="email" value={form.Email} onChange={e => setForm({ ...form, Email: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Mobile Number</label>
                <input className="ec-input" value={form.MobileNumber} onChange={e => setForm({ ...form, MobileNumber: e.target.value })} />
              </div>
            </div>

            <p className="ec-label mt-4 mb-1">Location Scope</p>
            <div className="ec-grid-5">
              <div className="ec-form-group">
                <label className="ec-label">Region</label>
                <select className="ec-select" value={form.RegionID} onChange={e => onRegion(e.target.value)}>
                  <option value="">—</option>
                  {regions.map(r => <option key={r.RegionID} value={r.RegionID}>{r.Name}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Zone</label>
                <select className="ec-select" value={form.ZoneID} onChange={e => onZone(e.target.value)}>
                  <option value="">—</option>
                  {zones.map(z => <option key={z.ZoneID} value={z.ZoneID}>{z.Name}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Division</label>
                <select className="ec-select" value={form.DivisionID} onChange={e => onDivision(e.target.value)}>
                  <option value="">—</option>
                  {divisions.map(d => <option key={d.DivisionID} value={d.DivisionID}>{d.Name}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Circle</label>
                <select className="ec-select" value={form.CircleID} onChange={e => onCircle(e.target.value)}>
                  <option value="">—</option>
                  {circles.map(c => <option key={c.CircleID} value={c.CircleID}>{c.Name}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Ward</label>
                <select className="ec-select" value={form.WardID} onChange={e => setForm({ ...form, WardID: e.target.value })}>
                  <option value="">—</option>
                  {wards.map(w => <option key={w.WardID} value={w.WardID}>{w.Name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-end mt-4"><button type="submit" className="ec-btn-primary ec-btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save User'}</button></div>
          </div>
        </form>
      )}

      <div className="ec-card overflow-hidden">
        {loading ? (
          <div className="ec-loader"><div className="ec-spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead><tr>
                <th>Name</th><th>Username</th><th>Designation</th>
                <th>Location</th><th>Email</th><th>Mobile</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.UserID}>
                    <td className="text-xs font-medium">{u.Name}</td>
                    <td className="font-mono text-xs">{u.Username}</td>
                    <td><span className="ec-badge ec-badge-info">{roleLabel(u.Designation)}</span></td>
                    <td className="text-xs text-[#64748B]">{locationOf(u)}</td>
                    <td className="text-xs">{u.Email || '—'}</td>
                    <td className="text-xs">{u.MobileNumber || '—'}</td>
                    <td>
                      <button onClick={() => openEdit(u)} className="text-[#1E3A5F] hover:opacity-70" title="Edit user">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-xs text-slate-400">No users</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
