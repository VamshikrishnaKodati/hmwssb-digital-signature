import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, RefreshCw, MapPin, Globe2, Info } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { roleLabel } from '../config/navConfig'
import { applyLocationChange, optionsFor } from '../utils/locationUtils'

const DESIGNATIONS = ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead']

// Role -> scope-node level. Manager/DGM/GM/CGM/DOP hold a location assignment
// record (dedicated assignment tables); DOP corporation is data/config.
const SCOPE_LEVEL = {
  Manager: { key: 'CircleID', node: 'Circle' },
  DGM: { key: 'DivisionID', node: 'Division' },
  GM: { key: 'ZoneID', node: 'Zone' },
  CGM: { key: 'RegionID', node: 'Corporation' },
  DOP: { key: 'RegionID', node: 'Corporation' },
}

const GLOBAL_SCOPE_ROLES = ['ED', 'MD']

const isAssignableRole = (desig) => Boolean(SCOPE_LEVEL[desig])

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lookups, setLookups] = useState({ regions: [], zones: [], divisions: [], circles: [], wards: [] })
  const [form, setForm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/users/${id}`)
      setData(res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('User not found')
        navigate('/users')
      } else {
        toast.error('Failed to load user')
      }
    }
    setLoading(false)
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([
      api.get('/lookups/regions'),
      api.get('/lookups/zones'),
      api.get('/lookups/divisions'),
      api.get('/lookups/circles'),
      api.get('/lookups/wards'),
    ]).then(([reg, zon, div, cir, war]) => {
      setLookups({
        regions: reg.data || [], zones: zon.data || [], divisions: div.data || [],
        circles: cir.data || [], wards: war.data || [],
      })
    }).catch(() => {})
  }, [])

  if (loading) {
    return <div className="ec-loader"><div className="ec-spinner" /></div>
  }
  if (!data) return null

  const { user, assignments } = data
  const primary = assignments.find(a => a.Role === user.Designation) || null
  const assignables = assignments.filter(a => a.Role === user.Designation)

  // Resolved top-down location chain for one assignment record (real names only).
  const chainParts = (a) =>
    [a.RegionName, a.ZoneName, a.DivisionName, a.CircleName, a.WardName].filter(Boolean).join(' → ') || a.NodeName || '—'

  const legacyChainParts =
    [user.RegionName, user.ZoneName, user.DivisionName, user.CircleName, user.WardName].filter(Boolean).join(' → ')

  const openEdit = () => {
    setForm({
      Name: user.Name, Username: user.Username, Designation: user.Designation,
      DesignationTitle: user.DesignationTitle || '', EmployeeCode: user.EmployeeCode || '',
      EffectiveFrom: (user.EffectiveFrom || '').slice(0, 10), EffectiveTo: (user.EffectiveTo || '').slice(0, 10),
      Email: user.Email || '', MobileNumber: user.MobileNumber || '',
      RegionID: user.RegionID || '', ZoneID: user.ZoneID || '', DivisionID: user.DivisionID || '',
      CircleID: user.CircleID || '', WardID: user.WardID || '',
      AssignedNodeId: primary ? String(primary.NodeID) : '',
    })
    setEditing(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const p = {
        Name: form.Name, Designation: form.Designation, DesignationTitle: form.DesignationTitle,
        EmployeeCode: form.EmployeeCode,
        EffectiveFrom: form.EffectiveFrom || null, EffectiveTo: form.EffectiveTo || null,
        Email: form.Email, MobileNumber: form.MobileNumber,
      }
      if (isAssignableRole(form.Designation)) {
        const nextNode = form.AssignedNodeId === '' ? null : Number(form.AssignedNodeId)
        const curNode = primary ? Number(primary.NodeID) : null
        if (nextNode !== curNode) {
          p.AssignedRole = form.Designation
          p.AssignedNodeId = nextNode
        }
      } else {
        p.RegionID = Number(form.RegionID) || null
        p.ZoneID = Number(form.ZoneID) || null
        p.DivisionID = Number(form.DivisionID) || null
        p.CircleID = Number(form.CircleID) || null
        p.WardID = Number(form.WardID) || null
      }
      await api.put(`/users/${id}`, p)
      toast.success('User updated')
      setEditing(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    }
    setBusy(false)
  }

  const scopeNodeOptions = (() => {
    const lvl = SCOPE_LEVEL[form ? form.Designation : user.Designation]
    if (!lvl) return []
    const list = { CircleID: lookups.circles, DivisionID: lookups.divisions, ZoneID: lookups.zones, RegionID: lookups.regions }[lvl.key] || []
    return list
      .map(n => ({ id: n[lvl.key], name: n.Name }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
  })()

  const changeLoc = (field, value) => setForm(f => applyLocationChange(lookups, f, field, value))

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Link to="/users" className="ec-btn-sm ec-btn-ghost" title="Back to User Management"><ArrowLeft className="w-3.5 h-3.5" /> Users</Link>
          <div>
            <h1 className="ec-page-title">User Details</h1>
            <p className="ec-page-subtitle">SoR Admin — User Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="ec-btn-sm ec-btn-ghost" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          {!editing && (
            <button onClick={openEdit} className="ec-btn-sm ec-btn-primary"><Pencil className="w-3.5 h-3.5" /> Edit User</button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="ec-card mb-5">
          <div className="ec-card-header">
            <Pencil className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">Edit — {form.Name}</span>
          </div>
          <div className="ec-card-body">
            <div className="ec-grid-4">
              <div className="ec-form-group">
                <label className="ec-label">Name *</label>
                <input className="ec-input" value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} required />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Username *</label>
                <input className="ec-input" value={form.Username} disabled />
                <p className="text-[10px] text-[#94A3B8] mt-0.5">Preserved — Username is the unique login identifier.</p>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Role *</label>
                <select className="ec-select ec-input" value={form.Designation} onChange={e => { const v = e.target.value; setForm({
                  ...form, Designation: v,
                  RegionID: '', ZoneID: '', DivisionID: '', CircleID: '', WardID: '', AssignedNodeId: '',
                }) }} required>
                  <option value="">Select Role</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{roleLabel(d)}</option>)}
                </select>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">Changing role updates the location scope record.</p>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Employee Code</label>
                <input className="ec-input" value={form.EmployeeCode} disabled />
                <p className="text-[10px] text-[#94A3B8] mt-0.5">Preserved — unique identifier.</p>
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Designation Title</label>
                <input className="ec-input" value={form.DesignationTitle} onChange={e => setForm({ ...form, DesignationTitle: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Email</label>
                <input className="ec-input" type="email" value={form.Email} onChange={e => setForm({ ...form, Email: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Mobile Number</label>
                <input className="ec-input" value={form.MobileNumber} onChange={e => setForm({ ...form, MobileNumber: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Effective From</label>
                <input className="ec-input" type="date" value={form.EffectiveFrom} onChange={e => setForm({ ...form, EffectiveFrom: e.target.value })} />
              </div>
              <div className="ec-form-group">
                <label className="ec-label">Effective To</label>
                <input className="ec-input" type="date" value={form.EffectiveTo} onChange={e => setForm({ ...form, EffectiveTo: e.target.value })} />
              </div>
            </div>

            {isAssignableRole(form.Designation) ? (
              <div className="mt-4">
                <p className="ec-label mb-1">Location Scope</p>
                <div className="ec-grid-2">
                  <div className="ec-form-group">
                    <label className="ec-label">{SCOPE_LEVEL[form.Designation].node} *</label>
                    <select className="ec-select ec-input" value={form.AssignedNodeId}
                      onChange={e => setForm({ ...form, AssignedNodeId: e.target.value })}>
                      <option value="">— No scope —</option>
                      {scopeNodeOptions.map(n => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-[#94A3B8]">
                  {roleLabel(form.Designation)} scope is one {SCOPE_LEVEL[form.Designation].node.toLowerCase()}.{' '}
                  {form.Designation === 'Manager' ? 'A circle includes its Wards.' : ''}
                  {form.Designation === 'DGM' ? 'A division includes its Circles and Wards.' : ''}
                  {form.Designation === 'GM' ? 'A zone includes its Divisions, Circles and Wards.' : ''}
                  {form.Designation === 'CGM' || form.Designation === 'DOP' ? 'A corporation includes all descendant Zones, Divisions, Circles and Wards.' : ''}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="ec-label mb-1">
                  {GLOBAL_SCOPE_ROLES.includes(form.Designation) ? 'Location Scope — Global' : 'Location (duty station)'}
                </p>
                {GLOBAL_SCOPE_ROLES.includes(form.Designation) ? (
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                    <Globe2 className="w-4 h-4" /> {roleLabel(form.Designation)} exercises jurisdiction across all corporations, zones, divisions, circles and wards.
                  </p>
                ) : (
                  <div className="ec-grid-5">
                    <div className="ec-form-group">
                      <label className="ec-label">Corporation</label>
                      <select className="ec-select ec-input" value={form.RegionID} onChange={e => changeLoc('RegionID', e.target.value)}>
                        <option value="">—</option>
                        {lookups.regions.map(r => <option key={r.RegionID} value={r.RegionID}>{r.Name}</option>)}
                      </select>
                    </div>
                    <div className="ec-form-group">
                      <label className="ec-label">Zone</label>
                      <select className="ec-select ec-input" value={form.ZoneID} onChange={e => changeLoc('ZoneID', e.target.value)}>
                        <option value="">—</option>
                        {optionsFor(lookups, 'zones', form).map(z => <option key={z.ZoneID} value={z.ZoneID}>{z.Name}</option>)}
                      </select>
                    </div>
                    <div className="ec-form-group">
                      <label className="ec-label">Division</label>
                      <select className="ec-select ec-input" value={form.DivisionID} onChange={e => changeLoc('DivisionID', e.target.value)}>
                        <option value="">—</option>
                        {optionsFor(lookups, 'divisions', form).map(d => <option key={d.DivisionID} value={d.DivisionID}>{d.Name}</option>)}
                      </select>
                    </div>
                    <div className="ec-form-group">
                      <label className="ec-label">Circle</label>
                      <select className="ec-select ec-input" value={form.CircleID} onChange={e => changeLoc('CircleID', e.target.value)}>
                        <option value="">—</option>
                        {optionsFor(lookups, 'circles', form).map(c => <option key={c.CircleID} value={c.CircleID}>{c.Name}</option>)}
                      </select>
                    </div>
                    <div className="ec-form-group">
                      <label className="ec-label">Ward</label>
                      <select className="ec-select ec-input" value={form.WardID} onChange={e => changeLoc('WardID', e.target.value)}>
                        <option value="">—</option>
                        {optionsFor(lookups, 'wards', form).map(w => <option key={w.WardID} value={w.WardID}>{w.Name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <button type="submit" className="ec-btn-primary ec-btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save User'}</button>
              <button type="button" className="ec-btn-sm ec-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="ec-card mb-5">
            <div className="ec-card-header">
              <Info className="w-4 h-4 text-[#2563EB]" />
              <span className="ec-card-title">Profile</span>
            </div>
            <div className="ec-card-body">
              <div className="ec-grid-4">
                <div className="ec-form-group"><label className="ec-label">Name</label><div className="text-sm font-medium">{user.Name}</div></div>
                <div className="ec-form-group"><label className="ec-label">Username</label><div className="text-sm font-mono">{user.Username}</div></div>
                <div className="ec-form-group">
                  <label className="ec-label">Role / Designation</label>
                  <span className="ec-badge ec-badge-info">{roleLabel(user.Designation)}</span>
                </div>
                <div className="ec-form-group">
                  <label className="ec-label">Status</label>
                  <span className={`ec-badge ${user.IsActive === false ? 'ec-badge-draft' : 'ec-badge-approved'}`}>
                    {user.IsActive === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <div className="ec-form-group"><label className="ec-label">Designation Title</label><div className="text-sm">{user.DesignationTitle || '—'}</div></div>
                <div className="ec-form-group"><label className="ec-label">Employee Code</label><div className="text-sm font-mono">{user.EmployeeCode || '—'}</div></div>
                <div className="ec-form-group"><label className="ec-label">Email</label><div className="text-sm">{user.Email || '—'}</div></div>
                <div className="ec-form-group"><label className="ec-label">Mobile</label><div className="text-sm">{user.MobileNumber || '—'}</div></div>
                <div className="ec-form-group"><label className="ec-label">Effective From</label><div className="text-sm">{(user.EffectiveFrom || '').slice(0, 10) || '—'}</div></div>
                <div className="ec-form-group"><label className="ec-label">Effective To</label><div className="text-sm">{(user.EffectiveTo || '').slice(0, 10) || '—'}</div></div>
              </div>
            </div>
          </div>

          <div className="ec-card overflow-hidden">
            <div className="ec-card-header">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              <span className="ec-card-title">Location Scope</span>
            </div>
            <div className="ec-card-body">
              {isAssignableRole(user.Designation) ? (
                assignables.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No location scope assigned to {user.Username} yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {assignables.map(a => (
                      <li key={`${a.Role}-${a.AssignmentID}`} className="ec-card ec-card-body !py-3 !px-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="ec-badge ec-badge-info">{roleLabel(a.Role)}</span>
                          <span className="ec-badge ec-badge-approved">{a.NodeType}</span>
                          <span className="text-xs font-mono text-[#94A3B8]">#ASN-{a.AssignmentID}</span>
                          <span className="text-xs text-[#64748B]">
                            {a.AssignedAt ? new Date(a.AssignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            {a.AssignedByName ? ` by ${a.AssignedByName}` : ''}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-sm">{chainParts(a)}</span>
                          {a.Notes && <span className="text-[11px] italic text-[#94A3B8]">“{a.Notes}”</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : GLOBAL_SCOPE_ROLES.includes(user.Designation) ? (
                <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4" /> {roleLabel(user.Designation)} is a global role — jurisdiction covers all locations.
                </p>
              ) : (
                <div>
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5 mb-2">
                    <Globe2 className="w-4 h-4" /> Board-wide role — no location restriction.
                  </p>
                  <div className="text-sm">{legacyChainParts || 'No duty-station location recorded.'}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}