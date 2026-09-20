import { useState, useEffect, useMemo } from 'react'
import { ShieldCheck, RefreshCw, Save, History, Check, X } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { roleLabel } from '../config/navConfig'

const MODULE_LABELS = {
  Agency: 'Agency Selection',
  Work: 'Execution',
  Measurement: 'Execution',
  Billing: 'Billing & Payment',
  Finance: 'Billing & Payment',
}
const MODULE_ORDER = ['Agency', 'Work', 'Measurement', 'Billing', 'Finance']
const OTHER_LABEL = 'Other'

const groupOf = (module) => MODULE_LABELS[module] || OTHER_LABEL

export default function RolePermissions() {
  const [roles, setRoles] = useState([])
  const [selected, setSelected] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permLoading, setPermLoading] = useState(false)
  const [desired, setDesired] = useState(new Set())
  const [original, setOriginal] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [audit, setAudit] = useState([])

  useEffect(() => {
    api.get('/roles').then(r => {
      setRoles(r.data || [])
      if (r.data && r.data.length) setSelected(r.data[0])
    }).catch(() => toast.error('Failed to load roles')).finally(() => setLoading(false))
    api.get('/roles/audit').then(r => setAudit(r.data || [])).catch(() => setAudit([]))
  }, [])

  const loadPermissions = async (roleId) => {
    setPermLoading(true)
    try {
      const res = await api.get(`/roles/${roleId}/permissions`)
      setSummary(res.data)
      const granted = new Set((res.data.permissions || []).filter(p => p.Access === 'ALLOWED').map(p => p.PermissionKey))
      setDesired(granted)
      setOriginal(granted)
    } catch (_) { toast.error('Failed to load permissions') }
    setPermLoading(false)
  }

  const select = (role) => { setSelected(role); loadPermissions(role.RoleID) }

  const changes = useMemo(() => {
    const diff = []
    for (const key of desired) if (!original.has(key)) diff.push({ key, action: 'GRANT' })
    for (const key of original) if (!desired.has(key)) diff.push({ key, action: 'REVOKE' })
    return diff
  }, [desired, original])

  const toggle = (key) => {
    const next = new Set(desired)
    if (next.has(key)) next.delete(key); else next.add(key)
    setDesired(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/roles/${selected.RoleID}/permissions`, { permissions: [...desired] })
      setOriginal(desired)
      toast.success(`Saved ${res.data.changes.length} change(s) to ${roleLabel(res.data.role)}`)
      api.get('/roles/audit').then(r => setAudit(r.data || [])).catch(() => {})
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    setSaving(false)
  }

  const groups = useMemo(() => {
    if (!summary) return []
    const gs = {}
    for (const p of summary.permissions) {
      const g = groupOf(p.Module)
      if (!gs[g]) gs[g] = []
      gs[g].push(p)
    }
    const order = [...MODULE_ORDER.map(m => MODULE_LABELS[m]), OTHER_LABEL]
    return order.filter(g => gs[g]).map(g => ({
      label: g,
      permissions: gs[g].sort((a, b) => a.PermissionKey.localeCompare(b.PermissionKey)),
    }))
  }, [summary])

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="ec-page-title">Role & Permission Management</h1>
          <p className="ec-page-subtitle">Grant or revoke access for each role — changes take effect immediately</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { api.get('/roles').then(r => setRoles(r.data || [])); api.get('/roles/audit').then(r => setAudit(r.data || [])).catch(() => {}) }}
            className="ec-btn-sm ec-btn-ghost" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mb-4 items-start">
        <div className="ec-card overflow-hidden">
          <div className="ec-card-header">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">Roles</span>
          </div>
          <div className="p-2 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="ec-loader"><div className="ec-spinner" /></div>
            ) : roles.length === 0 ? (
              <p className="text-xs text-[#94A3B8] text-center py-6">No roles found</p>
            ) : (
              <ul className="space-y-1">
                {roles.map(r => (
                  <li key={r.RoleID}>
                    <button onClick={() => select(r)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selected && selected.RoleID === r.RoleID ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#475569] hover:bg-[#F1F5F9]'}`}>
                      {roleLabel(r.RoleName)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ec-card overflow-hidden">
          <div className="ec-card-header">
            <span className="ec-card-title">{selected ? `Permissions — ${roleLabel(selected.RoleName)}` : 'Select a role'}</span>
          </div>
          {permLoading ? (
            <div className="ec-loader"><div className="ec-spinner" /></div>
          ) : !summary ? (
            <div className="p-6 text-xs text-[#94A3B8]">Select a role to view its permissions.</div>
          ) : (
            <>
              <div className="max-h-[60vh] overflow-y-auto">
                {groups.map(g => (
                  <div key={g.label}>
                    <div className="px-4 py-1.5 bg-[#F8FAFC] border-y border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      {g.label}
                    </div>
                    <table className="ec-table">
                      <tbody>
                        {g.permissions.map(p => {
                          const on = desired.has(p.PermissionKey)
                          const changed = on !== original.has(p.PermissionKey)
                          return (
                            <tr key={p.PermissionKey} className={changed ? 'bg-[#FFF7ED]' : ''}>
                              <td className="font-mono text-xs">{p.PermissionKey}</td>
                              <td className="text-xs text-[#475569]">{p.Description}</td>
                              <td className="text-right">
                                <span className={`ec-badge ${on ? 'ec-badge-approved' : 'ec-badge-draft'}`}>{on ? 'Allowed' : 'Denied'}</span>
                              </td>
                              <td className="text-right">
                                <button onClick={() => toggle(p.PermissionKey)}
                                  className={`ec-btn-sm ${on ? 'ec-btn-ghost' : 'ec-btn-primary'}`}>
                                  {on ? <><X className="w-3 h-3" /> Revoke</> : <><Check className="w-3 h-3" /> Grant</>}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#E2E8F0]">
                <div className="text-xs text-[#475569]">
                  {changes.length === 0 ? (
                    'No pending changes'
                  ) : (
                    <span>
                      {changes.length} pending change{changes.length > 1 ? 's' : ''}:
                      {' '}{changes.map(c => <span key={c.key} className={`font-mono ${c.action === 'GRANT' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{c.key} {c.action === 'GRANT' ? '+' : '−'}</span>).reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                    </span>
                  )}
                </div>
                <button className="ec-btn-primary ec-btn-sm" disabled={changes.length === 0 || saving} onClick={save}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ec-card overflow-hidden">
        <div className="ec-card-header">
          <History className="w-4 h-4 text-[#2563EB]" />
          <span className="ec-card-title">Audit Trail</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {audit.length === 0 ? (
            <div className="p-6 text-xs text-[#94A3B8]">No permission changes recorded yet.</div>
          ) : (
            <table className="ec-table">
              <thead><tr><th>When</th><th>By</th><th>Role</th><th>Permission</th><th>Action</th></tr></thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.AuditID}>
                    <td className="text-xs text-[#94A3B8] whitespace-nowrap">
                      {new Date(a.CreatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="text-xs">{a.Name || '—'}</td>
                    <td className="text-xs">{roleLabel(a.RoleName)}</td>
                    <td className="font-mono text-xs">{a.PermissionKey}</td>
                    <td>
                      <span className={`ec-badge ${a.Action === 'GRANT' ? 'ec-badge-approved' : 'ec-badge-draft'}`}>{a.Action}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}