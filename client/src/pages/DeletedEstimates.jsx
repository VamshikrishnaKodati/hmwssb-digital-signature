import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Eye, RotateCcw, X, Loader, ShieldCheck, History,
  ChevronLeft, ChevronRight, SlidersHorizontal, MoreVertical,
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import StatusBadge from '../components/shared/StatusBadge'
import OtpInput from '../components/shared/OtpInput'

const ICON_BTN = 'inline-flex items-center justify-center w-7 h-7 rounded-md text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 shrink-0'

export default function DeletedEstimates() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restorePhase, setRestorePhase] = useState('confirm')
  const [restoreOtpDigits, setRestoreOtpDigits] = useState(Array(6).fill(''))
  const [restoreOtpSent, setRestoreOtpSent] = useState(false)
  const [restoreOtpSentTo, setRestoreOtpSentTo] = useState('')
  const [restoreSendingOtp, setRestoreSendingOtp] = useState(false)
  const [restoreVerifying, setRestoreVerifying] = useState(false)
  const [restoreResendIn, setRestoreResendIn] = useState(0)

  const navigate = useNavigate()
  const limit = 20

  useEffect(() => {
    if (restoreResendIn <= 0) return
    const t = setTimeout(() => setRestoreResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [restoreResendIn])

  const loadList = async (p = page, q = search) => {
    setRefreshing(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (q) params.append('search', q)
      const res = await api.get(`/deleted-estimates?${params.toString()}`)
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (_) { toast.error('Failed to load deleted estimates') }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadList(1, search) }, [])

  const goPage = (p) => { setPage(p); loadList(p, search) }
  const doSearch = () => { setPage(1); loadList(1, searchInput); setSearch(searchInput) }

  const openDetail = async (item) => {
    setSelected(item)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await api.get(`/deleted-estimates/${item.DeletedEstimateID}`)
      setDetail(res.data)
    } catch (_) { toast.error('Failed to load estimate details') }
    setDetailLoading(false)
  }

  const closeDetail = () => { setSelected(null); setDetail(null) }

  const closeRestore = () => {
    if (restoreSendingOtp || restoreVerifying) return
    setRestoreTarget(null); setRestorePhase('confirm')
    setRestoreOtpDigits(Array(6).fill('')); setRestoreOtpSent(false); setRestoreOtpSentTo(''); setRestoreResendIn(0)
  }

  const initiateRestore = (item) => {
    setRestoreTarget(item); setRestorePhase('confirm')
    setRestoreOtpDigits(Array(6).fill('')); setRestoreOtpSent(false); setRestoreResendIn(0)
  }

  const sendRestoreOtp = async () => {
    if (!restoreTarget) return
    setRestoreSendingOtp(true)
    try {
      const res = await api.post(`/deleted-estimates/${restoreTarget.DeletedEstimateID}/restore/request-otp`)
      setRestoreOtpSent(true); setRestoreOtpSentTo(res.data.sentTo || ''); setRestoreResendIn(res.data.resendIn || 30); setRestorePhase('otp')
      setRestoreOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) { setRestoreResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait before resending') }
      else toast.error(err.response?.data?.error || 'Failed to send OTP')
    }
    setRestoreSendingOtp(false)
  }

  const verifyRestoreOtp = async () => {
    if (!restoreTarget) return
    setRestoreVerifying(true)
    try {
      const res = await api.post(`/deleted-estimates/${restoreTarget.DeletedEstimateID}/restore`, { otpCode: restoreOtpDigits.join('') })
      toast.success(res.data.message || 'Estimate restored')
      const restoredId = res.data.restoredEstimateID
      closeRestore(); loadList()
      if (restoredId) navigate(`/estimates/${restoredId}/edit`)
    } catch (err) { toast.error(err.response?.data?.error || 'Restore failed') }
    setRestoreVerifying(false)
  }

  const maskEmail = (email) => { if (!email || !String(email).includes('@')) return email || ''; const [l, d] = String(email).split('@'); if (l.length <= 2) return `${l[0]}*@${d}`; return `${l[0]}${'*'.repeat(Math.max(3, l.length - 2))}${l[l.length - 1]}@${d}` }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="ec-page-title">Deleted Estimates</h1>
          <p className="ec-page-subtitle">{total} deleted estimate{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/estimates" className="ec-btn-secondary ec-btn-sm">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to My Estimates
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input id="search-deleted" name="search" type="text" placeholder="Search by Estimate No, Work Name..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="ec-input pl-9 py-1.5 text-sm" />
        </div>
        <button onClick={doSearch} className="ec-btn-primary ec-btn-sm py-1.5">
          <Search className="w-3.5 h-3.5" /> Search
        </button>
        {refreshing && <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B]"><Loader className="w-3.5 h-3.5 animate-spin" /> Updating...</span>}
      </div>

      <div className="ec-card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#475569]">No deleted estimates found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '17%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Est. ID</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Work Name</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Type</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Deleted</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Total</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {items.map((e) => (
                  <tr key={e.DeletedEstimateID} className="transition-colors hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px] font-semibold text-[#1E3A5F] truncate" title={e.EstimateNo}>{e.EstimateNo}</div>
                      <div className="text-[10px] text-[#94A3B8]">v{e.Version}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[11px] font-medium text-[#0F172A] truncate" title={e.NameOfWork}>{e.NameOfWork}</div>
                      <div className="text-[10px] text-[#94A3B8] truncate">{e.DeletedByName || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      {e.WorkCategory ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                          {e.WorkCategory}
                        </span>
                      ) : <span className="text-[10px] text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[#64748B] whitespace-nowrap">{fmtDateTime(e.DeletedAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${e.RestoreStatus === 'restored' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {e.RestoreStatus === 'restored' ? 'Restored' : 'Deleted'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right"><span className="text-[11px] font-semibold text-[#0F172A]">{fmt(e.GrandTotal)}</span></td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-0.5 justify-end">
                        <button type="button" onClick={() => openDetail(e)} title="View Details" className={ICON_BTN}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {e.RestoreStatus !== 'restored' && (
                          <button type="button" onClick={() => initiateRestore(e)} title="Restore Estimate"
                            className={`${ICON_BTN} hover:!text-[#059669] hover:!bg-emerald-50`}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-1">
              <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="ec-btn-secondary ec-btn-sm py-1 px-2 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
              <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="ec-btn-secondary ec-btn-sm py-1 px-2 disabled:opacity-40">Next <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={closeDetail}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#0F172A]">Deleted Estimate Details</h3>
                <p className="text-[10px] text-[#64748B] font-mono">{selected.EstimateNo}</p>
              </div>
              <button onClick={closeDetail} className="p-1 rounded hover:bg-[#F1F5F9]"><X className="w-4 h-4 text-[#64748B]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading && <div className="ec-loader"><div className="ec-spinner" /></div>}
              {detail && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5">
                      <p className="text-[10px] font-medium text-[#64748B] uppercase">Original Details</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-[#64748B]">Work Name</span><span className="font-medium text-[#0F172A] text-right max-w-[160px] truncate">{detail.NameOfWork}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Category</span><span className="font-medium text-[#0F172A]">{detail.WorkCategory || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Version</span><span className="font-medium text-[#0F172A]">v{detail.Version}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Grand Total</span><span className="font-semibold text-[#1E3A5F]">{fmt(detail.GrandTotal)}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Status at Delete</span><StatusBadge status={detail.Status} /></div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5">
                      <p className="text-[10px] font-medium text-[#64748B] uppercase">Deletion Info</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-[#64748B]">Deleted By</span><span className="font-medium text-[#0F172A]">{detail.DeletedByName}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Deleted At</span><span className="font-medium text-[#0F172A]">{fmtDateTime(detail.DeletedAt)}</span></div>
                        <div className="flex justify-between"><span className="text-[#64748B]">Restore Status</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${detail.RestoreStatus === 'restored' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {detail.RestoreStatus === 'restored' ? 'Restored' : 'Deleted'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {detail.DeletionReason && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] font-medium text-amber-700 mb-1">Deletion Reason</p>
                      <p className="text-xs text-amber-800">{detail.DeletionReason}</p>
                    </div>
                  )}

                  {detail.Items && detail.Items.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-[#64748B] uppercase mb-2">Estimate Items ({detail.Items.length})</p>
                      <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <th className="text-left px-2 py-1.5 font-medium text-[#64748B]">S.No</th>
                            <th className="text-left px-2 py-1.5 font-medium text-[#64748B]">Description</th>
                            <th className="text-right px-2 py-1.5 font-medium text-[#64748B]">Qty</th>
                            <th className="text-right px-2 py-1.5 font-medium text-[#64748B]">Unit</th>
                            <th className="text-right px-2 py-1.5 font-medium text-[#64748B]">Total</th>
                          </tr></thead>
                          <tbody className="divide-y divide-[#F1F5F9]">
                            {detail.Items.map((item, i) => (
                              <tr key={item.EstimateItemID || i} className="hover:bg-[#F8FAFC]">
                                <td className="px-2 py-1.5 text-[#64748B]">{i + 1}</td>
                                <td className="px-2 py-1.5 text-[#0F172A] max-w-[200px] truncate">{item.Description}</td>
                                <td className="px-2 py-1.5 text-right text-[#0F172A]">{item.Quantity}</td>
                                <td className="px-2 py-1.5 text-right text-[#64748B]">{item.Unit}</td>
                                <td className="px-2 py-1.5 text-right font-medium text-[#1E3A5F]">{fmt(item.Total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button onClick={closeDetail} className="ec-btn-secondary flex-1"><X className="w-3.5 h-3.5" /> Close</button>
                    {detail.RestoreStatus !== 'restored' && (
                      <button onClick={() => { closeDetail(); initiateRestore(selected) }}
                        className="ec-btn-primary flex-1 bg-[#059669] hover:bg-[#047857]">
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Estimate
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore OTP Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={closeRestore}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-5 h-5 text-[#059669]" />
              <h3 className="font-semibold text-[#0F172A]">Restore Estimate</h3>
            </div>

            {restorePhase === 'confirm' && (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 my-4 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-[#64748B]">Estimate</span><span className="font-mono font-medium text-[#0F172A]">{restoreTarget.EstimateNo}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#64748B]">Work</span><span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{restoreTarget.NameOfWork}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#64748B]">Version</span><span className="font-medium text-[#0F172A]">v{restoreTarget.Version}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#64748B]">Grand Total</span><span className="font-semibold text-[#1E3A5F]">{fmt(restoreTarget.GrandTotal)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#64748B]">Deleted By</span><span className="font-medium text-[#0F172A]">{restoreTarget.DeletedByName}</span></div>
                </div>
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-xs text-emerald-800">This will create a new Draft estimate (next version) with the same data. You can edit it after restoration.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={closeRestore} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={sendRestoreOtp} disabled={restoreSendingOtp} className="ec-btn-primary flex-1 bg-[#059669] hover:bg-[#047857]">
                    {restoreSendingOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {restoreSendingOtp ? 'Sending OTP...' : 'Continue to OTP'}
                  </button>
                </div>
              </>
            )}

            {restorePhase === 'otp' && !restoreVerifying && (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">
                  Enter the 6-digit OTP sent to {restoreOtpSentTo ? <span className="font-medium text-[#0F172A]">{maskEmail(restoreOtpSentTo)}</span> : 'your registered email'}.
                </p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>

                <label className="ec-label">Enter OTP</label>
                <div className="mb-3">
                  <OtpInput value={restoreOtpDigits} onChange={setRestoreOtpDigits} />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendRestoreOtp} disabled={restoreSendingOtp || restoreResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {restoreSendingOtp ? 'Sending...' : restoreResendIn > 0 ? `Resend OTP (${restoreResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={closeRestore} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyRestoreOtp} disabled={restoreVerifying || restoreOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-[#059669] hover:bg-[#047857]">
                    {restoreVerifying ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {restoreVerifying ? 'Restoring...' : 'Verify & Restore'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
