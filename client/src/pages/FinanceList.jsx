import { useState, useEffect } from 'react'
import { Inbox, FileText, ClipboardCheck, Send, ShieldCheck, Banknote, X, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = ['Inward', 'Verification', 'Recommended', 'Approved', 'ChequeIssued']
const STATUS_STYLES = {
  Inward: 'bg-indigo-100 text-indigo-700',
  Verification: 'bg-amber-100 text-amber-700',
  Recommended: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  ChequeIssued: 'bg-purple-100 text-purple-700',
  SubmittedToFinance: 'bg-orange-100 text-orange-700',
}

export default function FinanceList() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const [showInward, setShowInward] = useState(false)
  const [inwardForm, setInwardForm] = useState({ BillID: '', Amount: '', InwardNumber: '', Remarks: '' })
  const [chequeForm, setChequeForm] = useState({ FinanceID: '', ChequeNumber: '', ChequeDate: '', Remarks: '' })
  const [showCheque, setShowCheque] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const role = user.Designation
  const [params] = useSearchParams()
  const statusFilter = params.get('status')

  useEffect(() => { load() }, [statusFilter])

  const load = async () => {
    try {
      if (statusFilter === 'SubmittedToFinance') {
        const res = await api.get('/finance/awaiting-inward')
        setItems(res.data || [])
        return
      }
      const sp = new URLSearchParams()
      if (statusFilter) sp.set('status', statusFilter)
      const qs = sp.toString()
      const res = await api.get(`/finance${qs ? `?${qs}` : ''}`)
      setItems(res.data || [])
    } catch (err) { console.error(err) }
  }

  const createInward = async (e) => {
    e.preventDefault()
    setBusy('inward')
    try {
      await api.post('/finance/inward', inwardForm)
      toast.success('Inward recorded')
      setShowInward(false); setInwardForm({ BillID: '', Amount: '', InwardNumber: '', Remarks: '' }); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    setBusy('')
  }

  const verify = async (id) => {
    setBusy(`verify-${id}`)
    try {
      await api.post(`/finance/${id}/verify`, { Remarks: 'Verified' })
      toast.success('Verified'); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    setBusy('')
  }

  const recommend = async (id) => {
    setBusy(`recommend-${id}`)
    try {
      await api.post(`/finance/${id}/recommend`, { Remarks: 'Recommended for approval' })
      toast.success('Recommended'); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    setBusy('')
  }

  const approve = async (id) => {
    setBusy(`approve-${id}`)
    try {
      await api.post(`/finance/${id}/approve`, { Remarks: 'Approved' })
      toast.success('Approved'); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    setBusy('')
  }

  const issueCheque = async (e) => {
    e.preventDefault()
    setBusy('cheque')
    try {
      await api.post(`/finance/${chequeForm.FinanceID}/cheque`, {
        ChequeNumber: chequeForm.ChequeNumber,
        ChequeDate: chequeForm.ChequeDate,
        Remarks: chequeForm.Remarks,
      })
      toast.success('Cheque issued')
      setShowCheque(false); setChequeForm({ FinanceID: '', ChequeNumber: '', ChequeDate: '', Remarks: '' }); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    setBusy('')
  }

  const openCheque = (item) => {
    setChequeForm({ FinanceID: item.FinanceID, ChequeNumber: '', ChequeDate: '', Remarks: '' })
    setShowCheque(true)
  }

  const openInward = (item) => {
    setInwardForm({ BillID: item.BillID ?? '', Amount: item.NetAmount ?? item.Amount ?? '', InwardNumber: '', Remarks: '' })
    setShowInward(true)
  }

  const canAction = (item) => {
    if (role === 'FinanceClerk' && item.Status === 'Inward') return 'verify'
    if (role === 'FinanceManager' && item.Status === 'Verification') return 'recommend'
    if (role === 'FinanceHead' && item.Status === 'Recommended') return 'approve'
    if (role === 'FinanceHead' && item.Status === 'Approved') return 'cheque'
    return null
  }

  const statusIcon = (s) => {
    if (s === 'Inward' || s === 'SubmittedToFinance') return <Inbox className="w-3.5 h-3.5" />
    if (s === 'Verification') return <ClipboardCheck className="w-3.5 h-3.5" />
    if (s === 'Recommended') return <Send className="w-3.5 h-3.5" />
    if (s === 'Approved') return <ShieldCheck className="w-3.5 h-3.5" />
    if (s === 'ChequeIssued') return <Banknote className="w-3.5 h-3.5" />
    return <FileText className="w-3.5 h-3.5" />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2563EB]">Finance Workflow</h1>
          <p className="text-sm text-[#475569] mt-1">Track bills through finance processing</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { const sp = new URLSearchParams(params); if (params.get('status') === 'SubmittedToFinance') sp.delete('status'); else sp.set('status', 'SubmittedToFinance'); window.history.pushState({}, '', `${window.location.pathname}?${sp}`); load() }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${params.get('status') === 'SubmittedToFinance' ? STATUS_STYLES.SubmittedToFinance + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Awaiting Inward
          </button>
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => { const sp = new URLSearchParams(params); if (params.get('status') === s) sp.delete('status'); else sp.set('status', s); window.history.pushState({}, '', `${window.location.pathname}?${sp}`); load() }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${params.get('status') === s ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
          {role === 'FinanceClerk' && (
            <button onClick={() => setShowInward(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> Record Inward
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#CBD5E1] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#CBD5E1]">
                <th className="text-left px-4 py-3 font-semibold text-[#475569]">Inward No.</th>
                <th className="text-left px-4 py-3 font-semibold text-[#475569]">Bill No.</th>
                <th className="text-left px-4 py-3 font-semibold text-[#475569] hidden sm:table-cell">Estimate</th>
                <th className="text-left px-4 py-3 font-semibold text-[#475569] hidden md:table-cell">Work Name</th>
                <th className="text-right px-4 py-3 font-semibold text-[#475569]">Amount</th>
                <th className="text-center px-4 py-3 font-semibold text-[#475569]">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-[#475569] hidden lg:table-cell">Received By</th>
                <th className="text-right px-4 py-3 font-semibold text-[#475569]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#475569]">No finance items found</td></tr>
              ) : items.map(item => {
                const action = item.Status === 'SubmittedToFinance' && role === 'FinanceClerk' ? 'inward' : canAction(item)
                return (
                  <tr key={item.FinanceID ?? item.BillID} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#2563EB]">{item.InwardNumber || '—'}</td>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">{item.BillNo || `#${item.BillID || ''}`}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[#475569]">{item.EstimateNo || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[#475569] truncate max-w-[200px]">{item.NameOfWork}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#2563EB]">₹{Number(item.Amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[item.Status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusIcon(item.Status)} {item.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#475569]">{item.ReceivedByName || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {action === 'inward' && (
                        <button onClick={() => openInward(item)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" data-testid="record-inward">
                          Record Inward
                        </button>
                      )}
                      {action === 'verify' && (
                        <button onClick={() => verify(item.FinanceID)} disabled={busy === `verify-${item.FinanceID}`}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                          {busy === `verify-${item.FinanceID}` ? '...' : 'Verify'}
                        </button>
                      )}
                      {action === 'recommend' && (
                        <button onClick={() => recommend(item.FinanceID)} disabled={busy === `recommend-${item.FinanceID}`}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {busy === `recommend-${item.FinanceID}` ? '...' : 'Recommend'}
                        </button>
                      )}
                      {action === 'approve' && (
                        <button onClick={() => approve(item.FinanceID)} disabled={busy === `approve-${item.FinanceID}`}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                          {busy === `approve-${item.FinanceID}` ? '...' : 'Approve'}
                        </button>
                      )}
                      {action === 'cheque' && (
                        <button onClick={() => openCheque(item)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                          Issue Cheque
                        </button>
                      )}
                      {!action && <span className="text-xs text-[#94A3B8]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showInward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowInward(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#2563EB]">Record Inward</h3>
              <button onClick={() => setShowInward(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createInward} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill ID</label>
                <input type="number" required value={inwardForm.BillID} onChange={e => setInwardForm({ ...inwardForm, BillID: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" required value={inwardForm.Amount} onChange={e => setInwardForm({ ...inwardForm, Amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inward Number</label>
                <input type="text" required value={inwardForm.InwardNumber} onChange={e => setInwardForm({ ...inwardForm, InwardNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea value={inwardForm.Remarks} onChange={e => setInwardForm({ ...inwardForm, Remarks: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={2} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowInward(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy === 'inward'}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {busy === 'inward' ? 'Saving...' : 'Record Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCheque(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#2563EB]">Issue Cheque</h3>
              <button onClick={() => setShowCheque(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={issueCheque} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                <input type="text" required value={chequeForm.ChequeNumber} onChange={e => setChequeForm({ ...chequeForm, ChequeNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date</label>
                <input type="date" required value={chequeForm.ChequeDate} onChange={e => setChequeForm({ ...chequeForm, ChequeDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea value={chequeForm.Remarks} onChange={e => setChequeForm({ ...chequeForm, Remarks: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" rows={2} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCheque(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={busy === 'cheque'}
                  className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {busy === 'cheque' ? 'Saving...' : 'Issue Cheque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
