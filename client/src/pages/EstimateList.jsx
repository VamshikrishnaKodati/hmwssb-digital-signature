import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Plus, Search, Eye, FileText, Edit3, Send, X, Loader,
  CheckCircle, RotateCcw, SlidersHorizontal, Trash2, ShieldCheck,
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import StatusBadge from '../components/shared/StatusBadge'
import OtpInput from '../components/shared/OtpInput'
import EstimateRowActions from '../components/EstimateRowActions'
import ActionFan from '../components/ActionFan'

export default function EstimateList() {
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [highlightId, setHighlightId] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [filters, setFilters] = useState({
    statuses: [], assignedTo: '', createdBy: '', actedBy: '', action: '', sort: '', stage: '', today: '',
  })

  const [submitTarget, setSubmitTarget] = useState(null)
  const [submitRemarks, setSubmitRemarks] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)

  const [approveTarget, setApproveTarget] = useState(null)
  const [approveLoading, setApproveLoading] = useState(false)
  const [revertTarget, setRevertTarget] = useState(null)
  const [revertRemarks, setRevertRemarks] = useState('')
  const [revertLoading, setRevertLoading] = useState(false)

  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [remarksTarget, setRemarksTarget] = useState(null)
  const [remarksRows, setRemarksRows] = useState([])

  const [menuState, setMenuState] = useState(null) // { estimate, anchor }

  // Delete OTP state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deletePhase, setDeletePhase] = useState('confirm') // confirm | otp | success
  const [deleteOtpSent, setDeleteOtpSent] = useState(false)
  const [deleteOtpSentTo, setDeleteOtpSentTo] = useState('')
  const [deleteOtpDigits, setDeleteOtpDigits] = useState(Array(6).fill(''))
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteResendIn, setDeleteResendIn] = useState(0)

  const STATUS_LABELS = {
    Draft: 'Draft', Submitted: 'With DGM', DGM_Approved: 'Verified',
    GM_Recommended: 'Recommended', CGM_Submitted: 'With DOP',
    DOP_Approved: 'Approved', ED_Approved: 'Approved',
    MD_Approved: 'Final Approved', FinalApproved: 'Final Approved',
    Signed: 'Approved', Reverted: 'Reverted',
    TenderPublished: 'Tender Published', AgencySelected: 'Agency Selected',
    WorkStarted: 'Work Started', WorkCompleted: 'Work Completed',
    Billing: 'Billing', Completed: 'Completed',
  }

  const ACTION_LABELS = {
    Approve: 'Approved', PublishTender: 'Published', SelectAgency: 'Selected',
    CompleteWork: 'Completed', SubmitBill: 'Submitted',
  }

  // Pipeline stage labels — mirrors server PIPELINE_STAGES ("currently with").
  const PIPELINE_STAGE_LABELS = {
    Draft: 'Draft', DGM: 'DGM', GM: 'GM', CGM: 'CGM',
    DOP: 'DOP', ED: 'ED', MD: 'MD', Approved: 'Approved',
  }

  const parseQuery = (searchStr) => {
    const qs = new URLSearchParams(searchStr)
    const statuses = (qs.get('status') || '').split(',').map(s => s.trim()).filter(Boolean)
    return {
      statuses, assignedTo: qs.get('assignedTo') || '', createdBy: qs.get('createdBy') || '',
      actedBy: qs.get('actedBy') || '', action: qs.get('action') || '',
      sort: qs.get('sort') || '', stage: qs.get('stage') || '',
      today: qs.get('today') === 'true' || qs.get('today') === '1',
      search: qs.get('search') || '',
    }
  }

  useEffect(() => {
    const st = location.state
    const parsed = parseQuery(location.search)
    const initSearch = st?.search || parsed.search
    if (st?.statusFilter && !parsed.statuses.length) parsed.statuses = [st.statusFilter]
    const { search: _ignored, ...filtersOnly } = parsed
    setSearch(initSearch)
    setStatusFilter(filtersOnly.statuses.length === 1 ? filtersOnly.statuses[0] : '')
    setFilters(filtersOnly)
    if (st?.highlightEstimateId) setHighlightId(st.highlightEstimateId)
    loadEstimates({ search: initSearch, filters: filtersOnly })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const loadEstimates = async (overrides = {}) => {
    setRefreshing(true)
    try {
      const params = new URLSearchParams()
      const q = overrides.search !== undefined ? overrides.search : search
      const f = overrides.filters !== undefined ? overrides.filters : filters
      if (q) params.append('search', q)
      if (f.statuses && f.statuses.length) params.append('status', f.statuses.join(','))
      if (f.assignedTo) params.append('assignedTo', f.assignedTo)
      if (f.createdBy) params.append('createdBy', f.createdBy)
      if (f.actedBy && f.action) { params.append('actedBy', f.actedBy); params.append('action', f.action) }
      if (f.sort) params.append('sort', f.sort)
      if (f.stage) params.append('stage', f.stage)
      if (f.today) params.append('today', 1)
      const res = await api.get(`/estimates/my?${params.toString()}`)
      setEstimates(res.data)
    } catch (_) { toast.error('Failed to load estimates') }
    setLoading(false)
    setRefreshing(false)
  }

  const setFilter = (patch, reload = true) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    if (reload) loadEstimates({ filters: next })
  }

  const removeStatus = (s) => setFilter({ statuses: filters.statuses.filter(x => x !== s) })
  const clearAllFilters = () => setFilter({ statuses: [], assignedTo: '', createdBy: '', actedBy: '', action: '', sort: '', stage: '' })

  const activeChips = []
  if (filters.statuses?.length) {
    filters.statuses.forEach(s => activeChips.push({ key: `st-${s}`, label: `Status: ${STATUS_LABELS[s] || s}`, remove: () => removeStatus(s) }))
  }
  if (filters.assignedTo === 'me') activeChips.push({ key: 'assignedTo', label: 'Assigned to: Me', remove: () => setFilter({ assignedTo: '' }) })
    if (filters.createdBy === 'me') activeChips.push({ key: 'createdBy', label: 'Created by: Me', remove: () => setFilter({ createdBy: '' }) })
    if (filters.stage) activeChips.push({ key: 'stage', label: `Currently With: ${PIPELINE_STAGE_LABELS[filters.stage] || filters.stage}`, remove: () => setFilter({ stage: '' }) })
  if (filters.actedBy === 'me' && filters.action) {
    activeChips.push({ key: 'actedBy', label: `${ACTION_LABELS[filters.action] || filters.action} by: Me`, remove: () => setFilter({ actedBy: '', action: '' }) })
  }
  if (filters.sort === 'priority') activeChips.push({ key: 'sort', label: 'Sorted by: Priority', remove: () => setFilter({ sort: '' }) })

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => document.getElementById(`est-row-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200)
    return () => clearTimeout(t)
  }, [highlightId])

  useEffect(() => {
    if (deleteResendIn <= 0) return
    const t = setTimeout(() => setDeleteResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [deleteResendIn])

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
  const fmtDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const openSubmit = async (est) => {
    setSubmittingId(est.EstimateID)
    try {
      const res = await api.get(`/estimates/${est.EstimateID}`)
      const e = res.data
      const missing = []
      if (!e.NameOfWork?.trim()) missing.push('Name of Work')
      if (!e.WorkCategory) missing.push('Work Category')
      if (!e.WardID) missing.push('Ward')
      if (!e.GSTPercent || parseFloat(e.GSTPercent) <= 0) missing.push('GST (%)')
      if (!e.Items || e.Items.length === 0) missing.push('Estimate Items')
      if (missing.length > 0) { toast.error(`Cannot submit — missing: ${missing.join(', ')}`); return }
      setSubmitTarget({ EstimateID: e.EstimateID, EstimateNo: e.EstimateNo, Status: e.Status })
      setSubmitRemarks('')
    } catch (_) { toast.error('Failed to validate estimate before submission') }
    finally { setSubmittingId(null) }
  }

  const closeSubmit = () => { if (submitLoading) return; setSubmitTarget(null); setSubmitRemarks('') }

  const doSubmit = async () => {
    if (!submitTarget) return
    if (submitTarget.Status === 'Reverted' && !submitRemarks.trim()) { toast.error('Action Taken Report is mandatory before resubmission'); return }
    setSubmitLoading(true)
    try {
      await api.post(`/workflow/${submitTarget.EstimateID}/submit`, { remarks: submitRemarks.trim() || undefined })
      toast.success(`Estimate ${submitTarget.EstimateNo} forwarded to DGM for review`)
      setSubmitTarget(null); setSubmitRemarks(''); loadEstimates()
    } catch (err) { toast.error(err.response?.data?.error || 'Submission failed') }
    finally { setSubmitLoading(false) }
  }

  const doApprove = async () => {
    if (!approveTarget) return
    setApproveLoading(true)
    try {
      await api.post(`/workflow/${approveTarget.EstimateID}/approve`)
      toast.success(`Estimate ${approveTarget.EstimateNo} verified & forwarded to GM`)
      setApproveTarget(null); loadEstimates()
    } catch (err) { toast.error(err.response?.data?.error || 'Approval failed') }
    finally { setApproveLoading(false) }
  }

  const doRevert = async () => {
    if (!revertTarget) return
    if (!revertRemarks.trim()) { toast.error('Remarks are required for reversion'); return }
    setRevertLoading(true)
    try {
      await api.post(`/workflow/${revertTarget.EstimateID}/revert`, { remarks: revertRemarks.trim() })
      toast.success(`Estimate ${revertTarget.EstimateNo} reverted to creator`)
      setRevertTarget(null); setRevertRemarks(''); loadEstimates()
    } catch (err) { toast.error(err.response?.data?.error || 'Reversion failed') }
    finally { setRevertLoading(false) }
  }

  const openHistory = async (est) => {
    setHistoryTarget(est); setHistoryLoading(true); setHistoryRows([])
    try { const res = await api.get(`/workflow/${est.EstimateID}/history`); setHistoryRows(res.data) }
    catch (_) { setHistoryRows([]) }
    setHistoryLoading(false)
  }

  const openRemarks = async (est) => {
    setRemarksTarget(est); setRemarksRows([])
    try { const res = await api.get(`/workflow/${est.EstimateID}/history`); setRemarksRows(res.data.filter(r => r.Action === 'Revert')) }
    catch (_) { setRemarksRows([]) }
  }

  // Delete OTP flow
  const canDelete = (e) => (e.Status === 'Draft' || e.Status === 'Reverted') && e.CreatedBy === user.UserID

  const openDelete = (e) => {
    setDeleteTarget(e); setDeletePhase('confirm'); setDeleteReason('')
    setDeleteOtpSent(false); setDeleteOtpSentTo(''); setDeleteOtpDigits(Array(6).fill(''))
    setDeleteResendIn(0)
  }

  const sendDeleteOtp = async () => {
    if (!deleteTarget) return
    setSendingDeleteOtp(true)
    try {
      const res = await api.post(`/workflow/${deleteTarget.EstimateID}/delete/request-otp`)
      setDeleteOtpSent(true); setDeleteOtpSentTo(res.data.maskedEmail || '')
      setDeleteResendIn(res.data.resendIn || 30); setDeletePhase('otp')
      setDeleteOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setDeleteResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingDeleteOtp(false)
  }

  const verifyDeleteOtp = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.post(`/workflow/${deleteTarget.EstimateID}/delete`, {
        otpCode: deleteOtpDigits.join(''), reason: deleteReason || undefined,
      })
      setDeletePhase('success')
      toast.success('Estimate deleted successfully')
      setTimeout(() => { setDeleteTarget(null); loadEstimates() }, 1200)
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
    setDeleting(false)
  }

  const maskEmail = (email) => {
    if (!email || !String(email).includes('@')) return email || ''
    const [local, domain] = String(email).split('@')
    if (local.length <= 2) return `${local[0]}*@${domain}`
    return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`
  }

  const handleAction = (action, est) => {
    switch (action) {
      case 'view': navigate(`/estimates/${est.EstimateID}/view`); break
      case 'preview': navigate(`/estimates/${est.EstimateID}/preview`); break
      case 'edit': navigate(`/estimates/${est.EstimateID}/edit`); break
      case 'delete': openDelete(est); break
      default: break
    }
  }

  const buildMenuActions = useCallback((est) => {
    if (!est) return []
    const canEdit = est.Status === 'Draft' || est.Status === 'Reverted'
    const canDelete = canEdit && est.CreatedBy === user.UserID
    const items = [
      { key: 'view', icon: Eye, label: 'View Estimate', onClick: () => handleAction('view', est) },
      { key: 'preview', icon: FileText, label: 'Preview Estimate', onClick: () => handleAction('preview', est) },
    ]
    if (canEdit) items.push({ key: 'edit', icon: Edit3, label: 'Edit Estimate', onClick: () => handleAction('edit', est) })
    if (canDelete) items.push({ key: 'delete', icon: Trash2, label: 'Delete Estimate', tone: 'danger', onClick: () => handleAction('delete', est) })
    return items
  }, [user.UserID])

  const renderHistoryRow = (w, i) => (
    <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#E2E8F0] last:border-l-0 last:pb-0">
      <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#1E3A5F]" />
      <p className="text-xs font-semibold text-[#0F172A]">{w.Action}</p>
      <p className="text-[10px] text-[#64748B]">{w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})</p>
      {w.Remarks && <p className="text-[10px] text-[#64748B] mt-0.5">{w.Remarks}</p>}
      <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
    </div>
  )

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="ec-page-title">My Estimates</h1>
          <p className="ec-page-subtitle">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''} found</p>
        </div>
        <Link to="/estimates/new" className="ec-btn-primary ec-btn-sm">
          <Plus className="w-4 h-4" /> New Estimate
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input id="search-estimate" name="search" type="text" placeholder="Search by Estimate No, Name of Work or ID..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="ec-input pl-9 py-1.5 text-sm" onKeyDown={e => e.key === 'Enter' && loadEstimates()} />
        </div>
        <label htmlFor="status-filter" className="sr-only">Filter by status</label>
        <select id="status-filter" name="statusFilter" value={statusFilter}
          onChange={e => { const value = e.target.value; setStatusFilter(value); setFilter({ statuses: value ? [value] : [] }) }}
          className="ec-select py-1.5 text-sm">
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">With DGM</option>
          <option value="DGM_Approved">Verified</option>
          <option value="GM_Recommended">Recommended</option>
          <option value="CGM_Submitted">With DOP</option>
          <option value="DOP_Approved">Approved</option>
          <option value="ED_Approved">Approved</option>
          <option value="MD_Approved">Final Approved</option>
          <option value="FinalApproved">Final Approved</option>
          <option value="Signed">Approved</option>
          <option value="Reverted">Reverted</option>
          <option value="TenderPublished">Tender Published</option>
          <option value="AgencySelected">Agency Selected</option>
          <option value="WorkStarted">Work Started</option>
          <option value="WorkCompleted">Work Completed</option>
          <option value="Billing">Billing</option>
          <option value="Completed">Completed</option>
        </select>
        <button onClick={() => loadEstimates()} className="ec-btn-primary ec-btn-sm py-1.5">
          <Search className="w-3.5 h-3.5" /> Search
        </button>
        {refreshing && <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B]"><Loader className="w-3.5 h-3.5 animate-spin" /> Updating...</span>}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F]"><SlidersHorizontal className="w-3.5 h-3.5" /> Active filters:</span>
          {activeChips.map(chip => (
            <button key={chip.key} type="button" onClick={chip.remove}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 text-xs text-[#1E3A5F] hover:bg-[#1E3A5F]/10 transition-colors">
              {chip.label} <X className="w-3 h-3 text-[#64748B] hover:text-[#1E3A5F]" />
            </button>
          ))}
          <button type="button" onClick={clearAllFilters} className="text-xs text-[#64748B] hover:text-[#1E3A5F] hover:underline">Clear all</button>
        </div>
      )}

      <div className="ec-card">
        {estimates.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
            <p className="text-sm font-medium text-[#475569]">{activeChips.length > 0 ? 'No estimates match this queue.' : 'No estimates found.'}</p>
            {activeChips.length > 0 && <button type="button" onClick={clearAllFilters} className="mt-3 text-xs text-[#1E3A5F] hover:underline">Clear filters to see all estimates</button>}
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on small screens */}
            <div className="hidden md:block">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '48px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Est. ID</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Work Name</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Work Type</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Created Date</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Grand Total</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {estimates.map((e) => (
                      <tr key={e.EstimateID} id={`est-row-${e.EstimateID}`}
                        className={`transition-colors hover:bg-[#F8FAFC] ${e.EstimateID === highlightId ? 'ec-row-highlight' : ''}`}>
                        <td className="px-3 py-3 align-top">
                          <div className="font-mono text-[11px] font-semibold text-[#1E3A5F] leading-tight" title={e.EstimateNo}>{e.EstimateNo || e.WorkID}</div>
                          <div className="text-[10px] text-[#94A3B8] mt-0.5">v{e.Version}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-xs font-medium text-[#0F172A] leading-snug line-clamp-2" title={e.NameOfWork}>{e.NameOfWork}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {e.WorkCategory ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] leading-tight">{e.WorkCategory}</span>
                          ) : <span className="text-[10px] text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-[#64748B] whitespace-nowrap align-top">{fmtDate(e.CreatedDate)}</td>
                        <td className="px-3 py-3 align-top"><StatusBadge status={e.Status} /></td>
                        <td className="px-3 py-3 text-right align-top whitespace-nowrap"><span className="text-xs font-semibold text-[#0F172A]">{fmt(e.GrandTotal)}</span></td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center justify-end">
                            <EstimateRowActions
                              estimate={e}
                              isOpen={menuState?.estimate?.EstimateID === e.EstimateID}
                              onTrigger={(est, anchor) => setMenuState({ estimate: est, anchor })}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-[#F1F5F9]">
              {estimates.map((e) => (
                  <div key={e.EstimateID} id={`est-row-${e.EstimateID}`}
                    className={`p-3 ${e.EstimateID === highlightId ? 'ec-row-highlight' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-[#1E3A5F]">{e.EstimateNo || e.WorkID} <span className="text-[10px] text-[#94A3B8] font-normal">v{e.Version}</span></div>
                        <div className="text-xs font-medium text-[#0F172A] truncate max-w-[220px]" title={e.NameOfWork}>{e.NameOfWork}</div>
                      </div>
                      <StatusBadge status={e.Status} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B] mb-2">
                      {e.WorkCategory && <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0]">{e.WorkCategory}</span>}
                      <span>{fmtDate(e.CreatedDate)}</span>
                      <span className="ml-auto font-semibold text-[#0F172A] text-[11px]">{fmt(e.GrandTotal)}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <EstimateRowActions
                        estimate={e}
                        isOpen={menuState?.estimate?.EstimateID === e.EstimateID}
                        onTrigger={(est, anchor) => setMenuState({ estimate: est, anchor })}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      <ActionFan
        anchor={menuState?.anchor}
        actions={buildMenuActions(menuState?.estimate)}
        isOpen={!!menuState}
        onClose={() => setMenuState(null)}
      />

      {/* Submit to DGM modal */}
      {submitTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={closeSubmit}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#1E3A5F]" />
                {submitTarget.Status === 'Reverted' ? 'Resubmit to DGM' : 'Submit to DGM'}
              </h3>
              <button onClick={closeSubmit} className="p-1 rounded hover:bg-[#F1F5F9]"><X className="w-4 h-4 text-[#64748B]" /></button>
            </div>
            <p className="text-sm text-[#475569] mb-3">
              Submit <span className="font-mono font-semibold text-[#1E3A5F]">{submitTarget.EstimateNo}</span> for DGM review? The estimate will become read-only for you.
            </p>
            {submitTarget.Status === 'Reverted' && (
              <div className="mb-3">
                <label htmlFor="submit-atr" className="ec-label">Action Taken Report <span className="text-[#DC2626]">*</span></label>
                <textarea id="submit-atr" name="submitRemarks" rows={3} value={submitRemarks}
                  onChange={e => setSubmitRemarks(e.target.value)}
                  className="ec-input w-full text-sm"
                  placeholder="Describe the corrections made in response to the reversion remarks" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={closeSubmit} disabled={submitLoading} className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={doSubmit} disabled={submitLoading} className="ec-btn-primary flex-1">
                {submitLoading ? 'Submitting...' : submitTarget.Status === 'Reverted' ? 'Resubmit' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete OTP Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => { if (!deleting) setDeleteTarget(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="w-5 h-5 text-[#DC2626]" />
              <h3 className="font-semibold text-[#0F172A]">Delete Estimate</h3>
            </div>

            {deletePhase === 'success' ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">Estimate Deleted</p>
                <p className="text-xs text-[#64748B]">Moved to Deleted Estimates archive.</p>
              </div>
            ) : deletePhase === 'confirm' ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-[#64748B]">Estimate</span><span className="font-mono font-medium text-[#0F172A]">{deleteTarget.EstimateNo}</span></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">Work</span><span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{deleteTarget.NameOfWork}</span></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">Version</span><span className="font-medium text-[#0F172A]">v{deleteTarget.Version}</span></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">Grand Total</span><span className="font-semibold text-[#1E3A5F]">{fmt(deleteTarget.GrandTotal)}</span></div>
                </div>
                <p className="text-xs text-[#64748B] mb-3">
                  This estimate will be moved to Deleted Estimates. It can be restored later by an authorized user.
                </p>
                <label htmlFor="delete-reason" className="ec-label">Deletion Reason (optional)</label>
                <textarea id="delete-reason" name="deleteReason" rows={2} value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  className="ec-input w-full text-sm mb-4" placeholder="Why are you deleting this estimate?" />
                <div className="flex items-center gap-2">
                  <button onClick={() => setDeleteTarget(null)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={sendDeleteOtp} disabled={sendingDeleteOtp} className="ec-btn-primary flex-1 bg-[#DC2626] hover:bg-[#B91C1C]">
                    {sendingDeleteOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {sendingDeleteOtp ? 'Sending OTP...' : 'Continue to OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">
                  Enter the 6-digit OTP sent to {deleteOtpSentTo ? <span className="font-medium text-[#0F172A]">{deleteOtpSentTo}</span> : 'your registered email'}.
                </p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>

                {deleteReason && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Reason</p>
                    <p className="text-xs text-[#0F172A]">{deleteReason}</p>
                  </div>
                )}

                <label className="ec-label">Enter OTP</label>
                <div className="mb-3">
                  <OtpInput value={deleteOtpDigits} onChange={setDeleteOtpDigits} />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendDeleteOtp} disabled={sendingDeleteOtp || deleteResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingDeleteOtp ? 'Sending...' : deleteResendIn > 0 ? `Resend OTP (${deleteResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyDeleteOtp} disabled={deleting || deleteOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-[#DC2626] hover:bg-[#B91C1C]">
                    {deleting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deleting ? 'Deleting...' : 'Verify & Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Movement history modal */}
      {historyTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setHistoryTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#0F172A]">Movement History</h3>
                <p className="text-[10px] text-[#64748B] font-mono">{historyTarget.EstimateNo || ''}</p>
              </div>
              <button onClick={() => setHistoryTarget(null)} className="p-1 rounded hover:bg-[#F1F5F9]"><X className="w-4 h-4 text-[#64748B]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {historyLoading && <div className="ec-loader"><div className="ec-spinner" /></div>}
              {!historyLoading && historyRows.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
              {!historyLoading && historyRows.map(renderHistoryRow)}
            </div>
          </div>
        </div>
      )}

      {/* Approve modal */}
      {approveTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setApproveTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><CheckCircle className="w-5 h-5 text-[#059669]" /><h3 className="font-semibold text-[#0F172A]">Verify &amp; Forward to GM</h3></div>
            <p className="text-sm text-[#475569] mb-3">Verify <span className="font-mono font-semibold text-[#1E3A5F]">{approveTarget.EstimateNo}</span>? It will be forwarded to the GM for digital signature &amp; OTP verification.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setApproveTarget(null)} disabled={approveLoading} className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={doApprove} disabled={approveLoading} className="ec-btn-primary flex-1">
                {approveLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {approveLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert modal */}
      {revertTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setRevertTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><RotateCcw className="w-5 h-5 text-[#DC2626]" /><h3 className="font-semibold text-[#0F172A]">Revert with Remarks</h3></div>
            <p className="text-sm text-[#475569] mb-3">Return <span className="font-mono font-semibold text-[#1E3A5F]">{revertTarget.EstimateNo}</span> to its creator? A reversion requires remarks explaining the change needed.</p>
            <div className="mb-4">
              <label htmlFor="revert-remarks" className="ec-label">Reversion Remarks <span className="text-[#DC2626]">*</span></label>
              <textarea id="revert-remarks" name="revertRemarks" rows={3} value={revertRemarks}
                onChange={e => setRevertRemarks(e.target.value)} className="ec-input w-full text-sm" placeholder="Explain why the estimate is being returned" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setRevertTarget(null); setRevertRemarks('') }} disabled={revertLoading} className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={doRevert} disabled={revertLoading} className="ec-btn-primary flex-1 bg-[#DC2626] hover:bg-[#B91C1C]">
                {revertLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {revertLoading ? 'Reverting...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View remarks modal */}
      {remarksTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setRemarksTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
              <div><h3 className="font-semibold text-[#0F172A]">Reversion Remarks</h3><p className="text-[10px] text-[#64748B] font-mono">{remarksTarget.EstimateNo || ''}</p></div>
              <button onClick={() => setRemarksTarget(null)} className="p-1 rounded hover:bg-[#F1F5F9]"><X className="w-4 h-4 text-[#64748B]" /></button>
            </div>
            <div className="p-5">
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-[10px] font-medium text-[#64748B] mb-1">Action Taken Report</p>
                <p className="text-sm text-red-800 whitespace-pre-line">{remarksTarget.ActionTakenReport || 'No Action Taken Report recorded yet'}</p>
              </div>
              <p className="text-[10px] font-medium text-[#64748B] mb-2">DGM Reversion Remarks</p>
              {remarksRows.length === 0 && <p className="text-xs text-[#94A3B8]">No reversion remarks recorded</p>}
              <div className="space-y-2">
                {remarksRows.map((r, i) => (
                  <div key={r.WorkflowID || i} className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                    <p className="whitespace-pre-line">{r.Remarks || '—'}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-1">{r.FromUserName} ({r.FromDesignation}) · {new Date(r.DateTime).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setRemarksTarget(null)} className="ec-btn-secondary w-full justify-center mt-4"><X className="w-3.5 h-3.5" /> Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
