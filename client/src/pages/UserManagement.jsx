import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Edit3, Users, ShieldCheck, RefreshCw, Power, History } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { roleLabel } from '../config/navConfig'

const DESIGNATIONS = ['Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'SoRAdmin', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead']
const SCOPE_LEVEL = {
  Manager: { key: 'CircleID', node: 'Circle' },
  DGM: { key: 'DivisionID', node: 'Division' },
  GM: { key: 'ZoneID', node: 'Zone' },
  CGM: { key: 'RegionID', node: 'Corporation' },
  DOP: { key: 'RegionID', node: 'Corporation' },
}

const emptyForm = {
  Username: '', Password: '', Name: '', Designation: '',
  DesignationTitle: '', EmployeeCode: '', EffectiveFrom: '', EffectiveTo: '',
  RegionID: '', ZoneID: '', DivisionID: '', CircleID: '', WardID: '',
  MobileNumber: '', Email: '', AssignedNodeId: '',
}

export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [assignments, setAssignments] = useState({})
  const [audits, setAudits] = useState({})
  const [auditOpen, setAuditOpen] = useState(null)

  const [regions, setRegions] = useState([])
  const [zones, setZones] = useState([])
  const [divisions, setDivisions] = useState([])
  const [circles, setCircles] = useState([])
  const [wards, setWards] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, aRes] = await Promise.all([api.get('/users'), api.get('/users/admin/assignments')])
      setUsers(uRes.data || [])
      // All ACTIVE assignments per user, deduped at the data level (same
      // role + node appears once). Distinct valid assignments stay separate.
      const map = {}
      for (const a of (aRes.data || [])) {
        if (!a.IsActive) continue
        const list = map[a.UserID] || []
        if (!list.some(x => x.Role === a.Role && x.NodeID === a.NodeID)) list.push(a)
        map[a.UserID] = list
      }
      setAssignments(map)
    } catch (_) { toast.error('Failed to load users') }
    setLoading(false)
  }

  useEffect(() => {
    load()
    Promise.all([
      api.get('/lookups/regions'),
      api.get('/lookups/zones'),
      api.get('/lookups/divisions'),
      api.get('/lookups/circles'),
      api.get('/lookups/wards'),
    ]).then(([reg, zon, div, cir, war]) => {
      setRegions(reg.data || []); setZones(zon.data || [])
      setDivisions(div.data || []); setCircles(cir.data || []); setWards(war.data || [])
    }).catch(() => {})
  }, [])

  const scopeNodes = (() => {
    const lvl = SCOPE_LEVEL[form.Designation]
    if (!lvl) return []
    const list = { CircleID: circles, DivisionID: divisions, ZoneID: zones, RegionID: regions }[lvl.key]
    const key = lvl.key
    return (list || []).map(n => ({ NodeID: n[key], Name: n.Name })).sort((a, b) => String(a.NodeID).localeCompare(String(b.NodeID), undefined, { numeric: true }))
  })()

  const assignmentsOf = (u) => assignments[u.UserID] || []

  const openNew = () => { setForm(emptyForm); setShowForm(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form }
      if (!payload.Password) { toast.error('Password is required'); setBusy(false); return }
      if (SCOPE_LEVEL[payload.Designation]) {
        payload.AssignedRole = payload.Designation
        payload.AssignedNodeId = payload.AssignedNodeId === '' ? null : Number(payload.AssignedNodeId)
        for (const k of ['RegionID', 'ZoneID', 'DivisionID', 'CircleID', 'WardID']) delete payload[k]
      } else {
        delete payload.AssignedNodeId
        delete payload.AssignedRole
      }
      await api.post('/users', payload)
      toast.success('User created')
      setShowForm(false); setForm(emptyForm); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    setBusy(false)
  }

  const toggleStatus = async (u) => {
    try {
      await api.put(`/users/${u.UserID}/status`, { isActive: !u.IsActive })
      toast.success(u.IsActive ? 'User deactivated' : 'User activated')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Status update failed') }
  }

  const showAudit = async (u) => {
    if (auditOpen === u.UserID) { setAuditOpen(null); return }
    setAuditOpen(u.UserID)
    try {
      const res = await api.get(`/users/${u.UserID}/audit`)
      setAudits(prev => ({ ...prev, [u.UserID]: res.data || [] }))
    } catch (_) { setAudits(prev => ({ ...prev, [u.UserID]: [] })) }
  }

  const locationOf = (u) =>
    [u.RegionName, u.ZoneName, u.DivisionName, u.CircleName, u.WardName].filter(Boolean).join(' → ') || '—'

  const scopeOf = (u) => {
    const list = assignmentsOf(u)
    if (list.length) return list.map(a => `${a.Role} → ${a.NodeName}`).join(' · ')
    return SCOPE_LEVEL[u.Designation] ? 'No scope assigned' : locationOf(u)
  }

  const fmtAuditScope = (s) => {
    try { const p = JSON.parse(s); return p ? `${p.nodeType}: ${p.nodeName}` : '—' } catch (_) { return s || '—' }
  }

  const auditRows = auditOpen ? audits[auditOpen] || [] : []

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
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">New User</span>
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label className="ec-label">Username *</label>
                <input className="ec-input" value={form.Username}
                  onChange={e => setForm({ ...form, Username: e.target.value.trim() })} required autoComplete="off" />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Password *</label>
                <input className="ec-input" type="password" value={form.Password} autoComplete="new-password"
                  onChange={e => setForm({ ...form, Password: e.target.value })}
                  required minLength={6} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Name *</label>
                <input className="ec-input" value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} required />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Designation *</label>
                <select className="ec-select ec-input" value={form.Designation} onChange={e => setForm({ ...form, Designation: e.target.value })} required>
                  <option value="">Select Designation</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{roleLabel(d)}</option>)}
                </select>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Designation Title</label>
                <input className="ec-input" value={form.DesignationTitle} onChange={e => setForm({ ...form, DesignationTitle: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Employee Code</label>
                <input className="ec-input" value={form.EmployeeCode} onChange={e => setForm({ ...form, EmployeeCode: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Effective From</label>
                <input className="ec-input" type="date" value={form.EffectiveFrom} onChange={e => setForm({ ...form, EffectiveFrom: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Effective To</label>
                <input className="ec-input" type="date" value={form.EffectiveTo} onChange={e => setForm({ ...form, EffectiveTo: e.target.value })} />
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

            {SCOPE_LEVEL[form.Designation] ? (
              <div className="mt-4">
                <p className="ec-label mb-1">Location Scope</p>
                <div className="ec-grid-2">
                  <div className="ec-form-group">
                    <label className="ec-label">{SCOPE_LEVEL[form.Designation].node} *</label>
                    <select className="ec-select ec-input" value={form.AssignedNodeId}
                      onChange={e => setForm({ ...form, AssignedNodeId: e.target.value })}>
                      <option value="">— No scope —</option>
                      {scopeNodes.map(n => <option key={n.NodeID} value={n.NodeID}>{n.Name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-[#94A3B8]">
                  {form.Designation} scope is one {SCOPE_LEVEL[form.Designation].node.toLowerCase()} ('{SCOPE_LEVEL[form.Designation].node}' ={' '}
                  {form.Designation === 'Manager' ? 'its Circles' : form.Designation === 'DGM' ? 'its Divisions' : form.Designation === 'GM' ? 'its Zones' : 'Corporation + descendant Zones/Divisions/Circles/Wards'}).
                </p>
              </div>
            ) : (
              <div>
                <p className="ec-label mt-4 mb-1">Location (duty station)</p>
                <div className="ec-grid-5">
                  <div className="ec-form-group">
                    <label className="ec-label">Region</label>
                    <select className="ec-select ec-input" value={form.RegionID} onChange={e => { const v = e.target.value; setForm({ ...form, RegionID: v, ZoneID: '', DivisionID: '', CircleID: '', WardID: '' }); }}>
                      <option value="">—</option>
                      {regions.map(r => <option key={r.RegionID} value={r.RegionID}>{r.Name}</option>)}
                    </select>
                  </div>
                  <div className="ec-form-group">
                    <label className="ec-label">Zone</label>
                    <select className="ec-select ec-input" value={form.ZoneID} onChange={e => { const v = e.target.value; setForm({ ...form, ZoneID: v, DivisionID: '', CircleID: '', WardID: '' }); }}>
                      <option value="">—</option>
                      {zones.filter(z => !form.RegionID || z.RegionID === Number(form.RegionID)).map(z => <option key={z.ZoneID} value={z.ZoneID}>{z.Name}</option>)}
                    </select>
                  </div>
                  <div className="ec-form-group">
                    <label className="ec-label">Division</label>
                    <select className="ec-select ec-input" value={form.DivisionID} onChange={e => { const v = e.target.value; setForm({ ...form, DivisionID: v, CircleID: '', WardID: '' }); }}>
                      <option value="">—</option>
                      {divisions.filter(d => !form.ZoneID || d.ZoneID === Number(form.ZoneID)).map(d => <option key={d.DivisionID} value={d.DivisionID}>{d.Name}</option>)}
                    </select>
                  </div>
                  <div className="ec-form-group">
                    <label className="ec-label">Circle</label>
                    <select className="ec-select ec-input" value={form.CircleID} onChange={e => { const v = e.target.value; setForm({ ...form, CircleID: v, WardID: '' }); }}>
                      <option value="">—</option>
                      {circles.filter(c => !form.DivisionID || c.DivisionID === Number(form.DivisionID)).map(c => <option key={c.CircleID} value={c.CircleID}>{c.Name}</option>)}
                    </select>
                  </div>
                  <div className="ec-form-group">
                    <label className="ec-label">Ward</label>
                    <select className="ec-select ec-input" value={form.WardID} onChange={e => setForm({ ...form, WardID: e.target.value })}>
                      <option value="">—</option>
                      {wards.filter(w => !form.CircleID || w.CircleID === Number(form.CircleID)).map(w => <option key={w.WardID} value={w.WardID}>{w.Name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end mt-4"><button type="submit" className="ec-btn-primary ec-btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Create User'}</button></div>
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
                <th>Scope</th><th>Email</th><th>Mobile</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <FragmentRow key={u.UserID} u={u}
                    expandedAudit={auditOpen === u.UserID}
                    auditRows={auditOpen === u.UserID ? auditRows : []}
                    scopeOf={scopeOf}
                    onView={() => navigate(`/users/${u.UserID}`)}
                    onToggleStatus={() => toggleStatus(u)}
                    onAudit={() => showAudit(u)}
                    fmtAuditScope={fmtAuditScope}
                  />
                ))}
                {users.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-xs text-slate-400">No users</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FragmentRow({ u, expandedAudit, auditRows, scopeOf, onView, onToggleStatus, onAudit, fmtAuditScope }) {
  return (
    <>
      <tr>
        <td className="text-xs font-medium">
          <button onClick={onView} className="text-[#2563EB] hover:underline text-left" title="View / edit user details">
            {u.Name}
          </button>
          {u.EmployeeCode && <span className="block font-mono text-[10px] text-[#94A3B8]">{u.EmployeeCode}</span>}
        </td>
        <td className="font-mono text-xs">{u.Username}</td>
        <td>
          <span className="ec-badge ec-badge-info">{roleLabel(u.Designation)}</span>
          {u.DesignationTitle && <span className="block text-[10px] text-[#475569] mt-0.5">{u.DesignationTitle}</span>}
        </td>
        <td className="text-xs text-[#475569]">{scopeOf(u)}</td>
        <td className="text-xs">{u.Email || '—'}</td>
        <td className="text-xs">{u.MobileNumber || '—'}</td>
        <td>
          <span className={`ec-badge ${u.IsActive === false ? 'ec-badge-draft' : 'ec-badge-approved'}`}>
            {u.IsActive === false ? 'Inactive' : 'Active'}
          </span>
        </td>
        <td>
          <div className="flex items-center gap-2">
            <button onClick={onView} className="text-[#2563EB] hover:opacity-70" title="View / edit user">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onToggleStatus} className={u.IsActive === false ? 'text-[#16A34A] hover:opacity-70' : 'text-[#DC2626] hover:opacity-70'}
              title={u.IsActive === false ? 'Activate user' : 'Deactivate user'}>
              <Power className="w-4 h-4" />
            </button>
            <button onClick={onAudit} className={`hover:opacity-70 ${expandedAudit ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`} title="Scope audit trail">
              <History className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expandedAudit && (
        <tr className="bg-[#F8FAFC]">
          <td colSpan={8} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Scope Assignment History — {u.Username}</p>
            {auditRows.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No scope assignment changes for this user.</p>
            ) : (
              <ul className="space-y-1.5">
                {auditRows.map(a => (
                  <li key={a.AssignmentAuditID || a.ChangedAt} className="text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="ec-badge ec-badge-info">{a.Role}</span>
                    <span className={`font-medium ${a.Action === 'Deactivate' ? 'text-[#DC2626]' : 'text-[#2563EB]'}`}>{a.Action}</span>
                    <span className="text-[#475569]">
                      {fmtAuditScope(a.OldScope)} {a.NewScope ? `→ ${fmtAuditScope(a.NewScope)}` : ''}
                    </span>
                    <span className="text-[#94A3B8]">
                      {new Date(a.ChangedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' '}(by {a.ChangedByName || 'unknown'})
                    </span>
                    {a.Notes && <span className="text-[#475569] italic">“{a.Notes}”</span>}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  )
}