import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Send, RotateCcw, CheckCircle, FileSpreadsheet,
  X, Download, History, FileDown, PenSquare, ClipboardList, FileText, Eye,
  Briefcase, Building2, Hammer, DollarSign, Archive, Plus, Users, Loader, ShieldCheck,
  ArrowRight, Info, FileCheck, Landmark, Stamp, Megaphone, Wallet
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import StatusBadge from '../components/shared/StatusBadge'
import OtpInput from '../components/shared/OtpInput'
import ActionPanel from '../components/estimate/ActionPanel'
import WorkProgressPhotos from '../components/estimate/WorkProgressPhotos'
import { canPerform, hasPermission } from '../utils/permissions'
import useCurrentUser from '../utils/useCurrentUser'

const PROC_PANEL = {
  FinalApproved: { stage: 'FCN', role: 'Director of Administration', task: 'Generate FCN number' },
  FCNGenerated: { stage: 'Administrative Sanction', role: 'Director of Administration', task: 'Generate Administrative Sanction' },
  AdminSanctionGenerated: { stage: 'Technical Sanction assignment', role: 'Director of Administration', task: 'Assign one competent technical authority (Director / GM / DGM)' },
  TSPending: { stage: 'Technical Sanction approval', role: 'Assigned TS authority', task: 'Review and approve the Technical Sanction' },
  TSApproved: { stage: 'Tender', role: 'Tender Officer', task: 'Publish the auto-created tender' },
  TenderPublished: { stage: 'Tender', role: 'Tender Officer', task: 'Monitor bids until closing' },
  TenderClosed: { stage: 'Bid Opening / Evaluation', role: 'Tender Officer', task: 'Open bids and proceed to evaluation' },
}

const slaTone = (dueAt, now = Date.now()) => {
  if (!dueAt) return { tone: 'neutral', label: '—' }
  const diff = new Date(dueAt).getTime() - now
  if (diff < 0) return { tone: 'danger', label: 'Overdue' }
  const mins = Math.floor(diff / 60000)
  if (mins < 720) return { tone: 'danger', label: `${Math.max(1, Math.ceil(mins / 60))}h left` }
  if (mins < 2880) return { tone: 'warn', label: `${Math.floor(mins / 60)}h left` }
  return { tone: 'ok', label: `${Math.floor(mins / 1440)}d left` }
}
import WorkflowProgress from '../components/shared/WorkflowProgress'
import { getStatusInfo, getStatusLabel, getStatusKeyForStage, resolveWorkflowPosition } from '../utils/workflowMapping'
import { downloadExport } from '../utils/download'

function OTPVerifyModal({
  open, icon: Icon, iconClass = 'text-[#2563EB]', title, submitted, verified,
  sentTo, digits, setDigits, resendIn, sending, verifying, verifyLabel, verifyingLabel,
  onResend, onClose, onVerify, buttonClass = '',
  showCertificate, certificateId, setCertificateId,
  remarkValue, successTitle, successText,
  nonce = 0, expiresIn = 300,
}) {
  const [secondsLeft, setSecondsLeft] = useState(expiresIn)
  useEffect(() => {
    if (!open || !submitted) return
    setSecondsLeft(expiresIn)
  }, [open, submitted, nonce, expiresIn])
  useEffect(() => {
    if (!open || !submitted || secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [open, submitted, secondsLeft])

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => !verifying && onClose()}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-5 h-5 ${iconClass}`} />
          <h3 className="font-semibold text-[#0F172A]">{title}</h3>
        </div>

        {verified ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <CheckCircle className="w-10 h-10 text-[#059669]" />
            <p className="text-sm font-semibold text-[#0F172A]">{successTitle}</p>
            <p className="text-xs text-[#475569]">{successText}</p>
          </div>
        ) : !submitted ? (
          <>
            <p className="text-xs font-semibold text-[#059669] mb-1">Verify OTP</p>
            <p className="text-xs text-[#475569] mb-4">
              {sending
                ? 'An OTP is being sent to your registered contact. Please wait...'
                : 'Enter the 6-digit OTP sent to your registered contact.'}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={sending} className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={onResend} disabled={sending} className="ec-btn-primary flex-1">
                {sending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
            <p className="text-xs text-[#475569] mb-1">
              Enter the 6-digit OTP sent to {sentTo ? (
                <span className="font-medium text-[#0F172A]">{sentTo}</span>
              ) : 'your registered contact'}.
            </p>
            <p className="text-xs text-[#475569] mb-3">
              {secondsLeft > 0 ? (
                <>OTP expires in <span className="font-medium text-[#0F172A]">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</span></>
              ) : (
                <span className="font-medium text-red-600">OTP expired. Please resend a new OTP.</span>
              )}
            </p>

            {showCertificate && (
              <>
                <label htmlFor="certificateId" className="ec-label">Certificate ID</label>
                <input id="certificateId" type="text" value={certificateId}
                  onChange={e => setCertificateId(e.target.value)}
                  placeholder="HMWSSB-DSC-000000" className="ec-input mb-3" />
              </>
            )}

            {remarkValue && (
              <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1]">
                <p className="text-[10px] font-medium text-[#475569]">Remarks</p>
                <p className="text-xs text-[#0F172A]">{remarkValue}</p>
              </div>
            )}

            <label className="ec-label">Enter OTP</label>
            <div className="mb-3">
              <OtpInput
                value={digits}
                onChange={setDigits}
                onSubmit={e => { if (digits.join('').length === 6 && !verifying) onVerify(e) }}
              />
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[#94A3B8]">5 attempts</span>
              <button type="button" onClick={onResend} disabled={sending || resendIn > 0}
                className="text-xs text-[#2563EB] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                {sending ? 'Sending...' : resendIn > 0 ? `Resend OTP (${resendIn}s)` : 'Resend OTP'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={verifying} className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={onVerify} disabled={verifying || digits.join('').length !== 6 || secondsLeft <= 0}
                className={`ec-btn-primary flex-1 ${buttonClass}`}>
                {verifying ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {verifying ? verifyingLabel : verifyLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function EstimateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [workflow, setWorkflow] = useState([])
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState('civil')
  const [action, setAction] = useState('')
  const [remarks, setRemarks] = useState('')
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [openingDoc, setOpeningDoc] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [tsAuthority, setTsAuthority] = useState('')
  const [processing, setProcessing] = useState(false)
  const [exporting, setExporting] = useState('')
  const [showSign, setShowSign] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''))
  const [certificateId, setCertificateId] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [signing, setSigning] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [verified, setVerified] = useState(false)
  const [showSubmitOtp, setShowSubmitOtp] = useState(false)
  const [submitOtpSent, setSubmitOtpSent] = useState(false)
  const [submitOtpSentTo, setSubmitOtpSentTo] = useState('')
  const [submitOtpDigits, setSubmitOtpDigits] = useState(Array(6).fill(''))
  const [sendingSubmitOtp, setSendingSubmitOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResendIn, setSubmitResendIn] = useState(0)
  const [submitVerified, setSubmitVerified] = useState(false)
  const [showDgmApprove, setShowDgmApprove] = useState(false)
  const [dgmOtpSent, setDgmOtpSent] = useState(false)
  const [dgmOtpSentTo, setDgmOtpSentTo] = useState('')
  const [dgmOtpDigits, setDgmOtpDigits] = useState(Array(6).fill(''))
  const [sendingDgmOtp, setSendingDgmOtp] = useState(false)
  const [approving, setApproving] = useState(false)
  const [dgmResendIn, setDgmResendIn] = useState(0)
  const [dgmVerified, setDgmVerified] = useState(false)
  const [showCgmSubmit, setShowCgmSubmit] = useState(false)
  const [cgmOtpSent, setCgmOtpSent] = useState(false)
  const [cgmOtpSentTo, setCgmOtpSentTo] = useState('')
  const [cgmOtpDigits, setCgmOtpDigits] = useState(Array(6).fill(''))
  const [sendingCgmOtp, setSendingCgmOtp] = useState(false)
  const [submittingCgm, setSubmittingCgm] = useState(false)
  const [cgmResendIn, setCgmResendIn] = useState(0)
  const [cgmVerified, setCgmVerified] = useState(false)
  const [showDopApprove, setShowDopApprove] = useState(false)
  const [dopOtpSent, setDopOtpSent] = useState(false)
  const [dopOtpSentTo, setDopOtpSentTo] = useState('')
  const [dopOtpDigits, setDopOtpDigits] = useState(Array(6).fill(''))
  const [sendingDopOtp, setSendingDopOtp] = useState(false)
  const [approvingDop, setApprovingDop] = useState(false)
  const [dopResendIn, setDopResendIn] = useState(0)
  const [dopVerified, setDopVerified] = useState(false)
  const [showEdApprove, setShowEdApprove] = useState(false)
  const [edOtpSent, setEdOtpSent] = useState(false)
  const [edOtpSentTo, setEdOtpSentTo] = useState('')
  const [edOtpDigits, setEdOtpDigits] = useState(Array(6).fill(''))
  const [sendingEdOtp, setSendingEdOtp] = useState(false)
  const [approvingEd, setApprovingEd] = useState(false)
  const [edResendIn, setEdResendIn] = useState(0)
  const [edVerified, setEdVerified] = useState(false)
  const [showMdFinal, setShowMdFinal] = useState(false)
  const [mdOtpSent, setMdOtpSent] = useState(false)
  const [mdOtpSentTo, setMdOtpSentTo] = useState('')
  const [mdOtpDigits, setMdOtpDigits] = useState(Array(6).fill(''))
  const [sendingMdOtp, setSendingMdOtp] = useState(false)
  const [finalizingMd, setFinalizingMd] = useState(false)
  const [mdResendIn, setMdResendIn] = useState(0)
  const [mdVerified, setMdVerified] = useState(false)
  const [otpNonce, setOtpNonce] = useState(0)
  const submitLockRef = useRef(false)
  const signLockRef = useRef(false)
  const billLockRef = useRef(false)
  const dgmLockRef = useRef(false)
  const cgmLockRef = useRef(false)
  const dopLockRef = useRef(false)
  const edLockRef = useRef(false)
  const mdLockRef = useRef(false)
  const [stepKey, setStepKey] = useState(null)
  const [tenders, setTenders] = useState([])
  const [agencies, setAgencies] = useState([])
  const [progressList, setProgressList] = useState([])
  const [bills, setBills] = useState([])
  const user = useCurrentUser()
  const hasMaterial = (estimate?.Items || []).some(i => i.Category === 'Material')

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (activeTab !== 'documents') return
    let live = true
    setDocsLoading(true)
    api.get('/estimate-documents', { params: { estimateId: id } })
      .then(res => { if (live) setDocs(res.data || []) })
      .catch(() => { if (live) setDocs([]) })
      .finally(() => { if (live) setDocsLoading(false) })
    return () => { live = false }
  }, [id, activeTab])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  useEffect(() => {
    if (submitResendIn <= 0) return
    const t = setTimeout(() => setSubmitResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [submitResendIn])

  useEffect(() => {
    if (dgmResendIn <= 0) return
    const t = setTimeout(() => setDgmResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [dgmResendIn])

  useEffect(() => {
    if (cgmResendIn <= 0) return
    const t = setTimeout(() => setCgmResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [cgmResendIn])

  useEffect(() => {
    if (dopResendIn <= 0) return
    const t = setTimeout(() => setDopResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [dopResendIn])

  useEffect(() => {
    if (edResendIn <= 0) return
    const t = setTimeout(() => setEdResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [edResendIn])

  useEffect(() => {
    if (mdResendIn <= 0) return
    const t = setTimeout(() => setMdResendIn(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [mdResendIn])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const eRes = await api.get(`/estimates/${id}`)
      setEstimate(eRes.data)
    } catch (err) {
      const status = err.response?.status
      setLoadError(status === 404 ? 'not_found' : status === 403 ? 'forbidden' : status == null ? 'network' : 'server')
      setLoading(false)
      return
    }
    // Supplementary related-data calls must never block the estimate from
    // rendering: a reviewer role may lack permission for one module (e.g.
    // tender.view) or a module may be empty, so resolve them independently.
    const settled = await Promise.allSettled([
      api.get(`/workflow/${id}/history`),
      api.get(`/estimates/${id}/versions`),
      api.get('/tender'),
      api.get('/agency'),
      api.get('/progress'),
      api.get('/billing'),
    ])
    const [wfRes, vRes, tenRes, agRes, prRes, biRes] = settled
    setWorkflow(wfRes.status === 'fulfilled' ? wfRes.value.data : [])
    setVersions(vRes.status === 'fulfilled' ? vRes.value.data : [])
    setTenders((tenRes.status === 'fulfilled' ? tenRes.value.data || [] : []).filter(x => x.EstimateID === Number(id)))
    setAgencies((agRes.status === 'fulfilled' ? agRes.value.data || [] : []).filter(x => x.EstimateID === Number(id)))
    setProgressList((prRes.status === 'fulfilled' ? prRes.value.data || [] : []).filter(x => x.EstimateID === Number(id)))
    setBills((biRes.status === 'fulfilled' ? biRes.value.data || [] : []).filter(x => x.EstimateID === Number(id)))
    setLoading(false)
  }

  const fmtSize = (bytes) => {
    if (!bytes && bytes !== 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let v = bytes
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${v.toFixed(i ? 1 : 0)} ${units[i]}`
  }

  const viewDoc = async (d) => {
    try {
      setOpeningDoc(d.DocumentID)
      const res = await api.get(`/estimate-documents/${d.DocumentID}/file`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      window.open(url, '_blank')
      setOpeningDoc(null)
    } catch (_) { toast.error('Could not open document'); setOpeningDoc(null) }
  }

  const downloadDoc = async (d) => {
    try {
      const fallback = d.OriginalName || `document_${d.DocumentID}`
      await downloadExport(`/estimate-documents/${d.DocumentID}/file`, fallback)
    } catch (_) { toast.error('Could not download document') }
  }

  const exportFile = async (format) => {
    setExporting(format)
    try {
      const fallback = `${(estimate.EstimateNo || estimate.WorkID || `ESTIMATE_${id}`).replace(/\//g, '_')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      const name = await downloadExport(`/exports/${id}/${format === 'pdf' ? 'pdf' : 'excel'}`, fallback)
      toast.success(`${name} downloaded`)
    } catch (_) { toast.error('Export failed') }
    setExporting('')
  }

  const ACTION_SUCCESS = {
    submit: 'Submitted for review',
    approve: 'Approved and forwarded to GM',
    'publish-tender': 'Tender published',
    'select-agency': 'Agency finalized',
    'start-work': 'Work started successfully',
    'complete-work': 'Work marked as completed',
    'submit-bill': 'Bill submitted',
    archive: 'Estimate archived and completed',
    revert: 'Estimate reverted to creator',
    'generate-fcn': 'FCN generated. Ready for Administrative Sanction.',
    'generate-admin-sanction': 'Administrative Sanction generated. Ready for Technical Sanction assignment.',
    'assign-ts-authority': 'Technical Sanction authority assigned. Awaiting TS approval.',
    'approve-ts': 'Technical Sanction approved. Forwarded to Tender Officer.',
    'return-ts': 'Technical Sanction returned for corrections.',
  }

  const handleAction = async (actionType) => {
    setProcessing(true)
    try {
      const payload = { remarks: remarks || undefined }
      if (actionType === 'assign-ts-authority') {
        payload.AuthorityRole = tsAuthority
        delete payload.remarks
      }
      if (actionType === 'revert' && !payload.remarks) payload.remarks = 'Reverted to creator'
      const res = await api.post(`/workflow/${id}/${actionType}`, payload)
      const sanctionNo = res.data?.sanctionNo
      const tsNo = res.data?.tsNo
      let message = ACTION_SUCCESS[actionType] || 'Action completed'
      if (actionType === 'generate-admin-sanction' && sanctionNo) message = `Administrative Sanction ${sanctionNo} generated. Ready for Technical Sanction assignment.`
      if (actionType === 'approve-ts' && tsNo) message = `Technical Sanction ${tsNo} approved. Forwarded to Tender Officer.`
      toast.success(message)
      setShowConfirm(false)
      setRemarks('')
      setAction('')
      load()
    } catch (err) {
      console.error(`[workflow] ${actionType} failed for estimate ${id}:`, err)
      const message = err.response?.data?.error || err.response?.data?.message || 'Action failed'
      toast.error(message)
    }
    setProcessing(false)
  }

  const confirmAction = (actionType) => {
    setAction(actionType)
    setTsAuthority('')
    setRemarks('')
    setShowConfirm(true)
  }

  const prepareBill = async () => {
    if (billLockRef.current) return
    billLockRef.current = true
    setProcessing(true)
    try {
      const res = await api.post('/billing/prepare', { EstimateID: Number(id) })
      const bill = res.data.bill
      if (res.data.reused) toast.success('Bill already prepared — opening it')
      else toast.success('Bill prepared as Draft')
      setShowConfirm(false)
      setAction('')
      navigate(`/billing/${bill.BillID}`)
    } catch (err) {
      console.error(`[billing] prepare failed for estimate ${id}:`, err)
      toast.error(err.response?.data?.error || 'Could not prepare bill')
    }
    setProcessing(false)
    billLockRef.current = false
  }

  const sendOtp = async () => {
    if (sendingOtp) return
    setSendingOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/sign/request-otp`)
      setOtpSent(true)
      setOtpSentTo(res.data.sentTo || '')
      setResendIn(res.data.resendIn || 30)
      setOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setResendIn(err.response.data.resendIn)
        toast.error(err.response.data.error || 'Please wait before resending')
      } else {
        toast.error(err.response?.data?.error || 'Failed to send OTP')
      }
    }
    setSendingOtp(false)
  }

  const verifyAndSign = async () => {
    if (signLockRef.current) return
    signLockRef.current = true
    setSigning(true)
    try {
      const res = await api.post(`/workflow/${id}/sign`, {
        otpCode: otpDigits.join(''),
        certificateId: certificateId || undefined,
      })
      setVerified(true)
      toast.success(res.data.message || 'OTP verified. Forwarded to Tender Officer.')
      setTimeout(() => {
        setShowSign(false)
        setVerified(false)
        setOtpSent(false); setOtpSentTo('')
        setOtpDigits(Array(6).fill('')); setCertificateId(''); setResendIn(0)
        load()
      }, 1200)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
    setSigning(false)
    signLockRef.current = false
  }

  const openSignOtp = async () => {
    if (signLockRef.current) return
    signLockRef.current = true
    setOtpSent(false); setOtpSentTo('')
    setOtpDigits(Array(6).fill('')); setCertificateId(''); setResendIn(0); setVerified(false)
    setShowSign(true)
    try { await sendOtp() } finally { signLockRef.current = false }
  }

  const openSubmitOtp = async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitOtpSent(false); setSubmitOtpSentTo('')
    setSubmitOtpDigits(Array(6).fill('')); setSubmitResendIn(0); setSubmitVerified(false)
    setShowSubmitOtp(true)
    try { await sendSubmitOtp() } finally { submitLockRef.current = false }
  }

  const sendSubmitOtp = async () => {
    if (sendingSubmitOtp) return
    setSendingSubmitOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/submit/request-otp`)
      setSubmitOtpSent(true)
      setSubmitOtpSentTo(res.data.sentTo || '')
      setSubmitResendIn(res.data.resendIn || 30)
      setSubmitOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setSubmitResendIn(err.response.data.resendIn)
        toast.error(err.response.data.error || 'Please wait before resending')
      } else {
        toast.error(err.response?.data?.error || 'Failed to send OTP')
      }
    }
    setSendingSubmitOtp(false)
  }

  const verifySubmitOtp = async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    try {
      const payload = {
        otpCode: submitOtpDigits.join(''),
        remarks: estimate.Status === 'Reverted' ? (estimate.ActionTakenReport || undefined) : (remarks || undefined),
      }
      const res = await api.post(`/workflow/${id}/submit`, payload)
      setSubmitVerified(true)
      toast.success(res.data.message || 'Estimate forwarded for review')
      setTimeout(() => {
        setShowSubmitOtp(false)
        setSubmitVerified(false)
        setSubmitOtpSent(false); setSubmitOtpSentTo('')
        setSubmitOtpDigits(Array(6).fill('')); setSubmitResendIn(0)
        setRemarks(''); setAction('')
        load()
      }, 1200)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed')
    }
    setSubmitting(false)
    submitLockRef.current = false
  }

  const openDgmApproveOtp = async () => {
    if (dgmLockRef.current) return
    dgmLockRef.current = true
    setDgmOtpSent(false); setDgmOtpSentTo('')
    setDgmOtpDigits(Array(6).fill('')); setDgmResendIn(0); setDgmVerified(false)
    setShowDgmApprove(true)
    try { await sendDgmOtp() } finally { dgmLockRef.current = false }
  }

  const sendDgmOtp = async () => {
    if (sendingDgmOtp) return
    setSendingDgmOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/approve/request-otp`)
      setDgmOtpSent(true)
      setDgmOtpSentTo(res.data.sentTo || '')
      setDgmResendIn(res.data.resendIn || 30)
      setDgmOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setDgmResendIn(err.response.data.resendIn)
        toast.error(err.response.data.error || 'Please wait before resending')
      } else {
        toast.error(err.response?.data?.error || 'Failed to send OTP')
      }
    }
    setSendingDgmOtp(false)
  }

  const verifyDgmApprove = async () => {
    if (dgmLockRef.current) return
    dgmLockRef.current = true
    setApproving(true)
    try {
      const res = await api.post(`/workflow/${id}/approve`, {
        otpCode: dgmOtpDigits.join(''),
        remarks: remarks || undefined,
      })
      setDgmVerified(true)
      toast.success(res.data.message || 'Estimate approved and forwarded to GM')
      setTimeout(() => {
        setShowDgmApprove(false)
        setDgmVerified(false)
        setDgmOtpSent(false); setDgmOtpSentTo('')
        setDgmOtpDigits(Array(6).fill('')); setDgmResendIn(0)
        setRemarks(''); setAction('')
        load()
      }, 1200)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed')
    }
    setApproving(false)
    dgmLockRef.current = false
  }

  const openCgmSubmitOtp = async () => {
    if (cgmLockRef.current) return
    cgmLockRef.current = true
    setCgmOtpSent(false); setCgmOtpSentTo('')
    setCgmOtpDigits(Array(6).fill('')); setCgmResendIn(0); setCgmVerified(false)
    setShowCgmSubmit(true)
    try { await sendCgmOtp() } finally { cgmLockRef.current = false }
  }

  const sendCgmOtp = async () => {
    if (sendingCgmOtp) return
    setSendingCgmOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/cgm-submit/request-otp`)
      setCgmOtpSent(true); setCgmOtpSentTo(res.data.sentTo || '')
      setCgmResendIn(res.data.resendIn || 30); setCgmOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setCgmResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingCgmOtp(false)
  }

  const verifyCgmSubmit = async () => {
    if (cgmLockRef.current) return
    cgmLockRef.current = true
    setSubmittingCgm(true)
    try {
      const res = await api.post(`/workflow/${id}/cgm-submit`, {
        otpCode: cgmOtpDigits.join(''), remarks: remarks || undefined,
      })
      setCgmVerified(true)
      toast.success(res.data.message || 'Estimate forwarded to DOP')
      setTimeout(() => {
        setShowCgmSubmit(false); setCgmVerified(false)
        setCgmOtpSent(false); setCgmOtpSentTo(''); setCgmOtpDigits(Array(6).fill('')); setCgmResendIn(0)
        setRemarks(''); setAction(''); load()
      }, 1200)
    } catch (err) { toast.error(err.response?.data?.error || 'Submission failed') }
    setSubmittingCgm(false)
    cgmLockRef.current = false
  }

  const openDopApproveOtp = async () => {
    if (dopLockRef.current) return
    dopLockRef.current = true
    setDopOtpSent(false); setDopOtpSentTo('')
    setDopOtpDigits(Array(6).fill('')); setDopResendIn(0); setDopVerified(false)
    setShowDopApprove(true)
    try { await sendDopOtp() } finally { dopLockRef.current = false }
  }

  const sendDopOtp = async () => {
    if (sendingDopOtp) return
    setSendingDopOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/dop-approve/request-otp`)
      setDopOtpSent(true); setDopOtpSentTo(res.data.sentTo || '')
      setDopResendIn(res.data.resendIn || 30); setDopOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setDopResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingDopOtp(false)
  }

  const verifyDopApprove = async () => {
    if (dopLockRef.current) return
    dopLockRef.current = true
    setApprovingDop(true)
    try {
      const res = await api.post(`/workflow/${id}/dop-approve`, {
        otpCode: dopOtpDigits.join(''), remarks: remarks || undefined,
      })
      setDopVerified(true)
      toast.success(res.data.message || 'Estimate approved and forwarded to ED')
      setTimeout(() => {
        setShowDopApprove(false); setDopVerified(false)
        setDopOtpSent(false); setDopOtpSentTo(''); setDopOtpDigits(Array(6).fill('')); setDopResendIn(0)
        setRemarks(''); setAction(''); load()
      }, 1200)
    } catch (err) { toast.error(err.response?.data?.error || 'Approval failed') }
    setApprovingDop(false)
    dopLockRef.current = false
  }

  const openEdApproveOtp = async () => {
    if (edLockRef.current) return
    edLockRef.current = true
    setEdOtpSent(false); setEdOtpSentTo('')
    setEdOtpDigits(Array(6).fill('')); setEdResendIn(0); setEdVerified(false)
    setShowEdApprove(true)
    try { await sendEdOtp() } finally { edLockRef.current = false }
  }

  const sendEdOtp = async () => {
    if (sendingEdOtp) return
    setSendingEdOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/ed-approve/request-otp`)
      setEdOtpSent(true); setEdOtpSentTo(res.data.sentTo || '')
      setEdResendIn(res.data.resendIn || 30); setEdOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setEdResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingEdOtp(false)
  }

  const verifyEdApprove = async () => {
    if (edLockRef.current) return
    edLockRef.current = true
    setApprovingEd(true)
    try {
      const res = await api.post(`/workflow/${id}/ed-approve`, {
        otpCode: edOtpDigits.join(''), remarks: remarks || undefined,
      })
      setEdVerified(true)
      toast.success(res.data.message || 'Estimate approved and forwarded to MD')
      setTimeout(() => {
        setShowEdApprove(false); setEdVerified(false)
        setEdOtpSent(false); setEdOtpSentTo(''); setEdOtpDigits(Array(6).fill('')); setEdResendIn(0)
        setRemarks(''); setAction(''); load()
      }, 1200)
    } catch (err) { toast.error(err.response?.data?.error || 'Approval failed') }
    setApprovingEd(false)
    edLockRef.current = false
  }

  const openMdFinalOtp = async () => {
    if (mdLockRef.current) return
    mdLockRef.current = true
    setMdOtpSent(false); setMdOtpSentTo('')
    setMdOtpDigits(Array(6).fill('')); setMdResendIn(0); setMdVerified(false)
    setShowMdFinal(true)
    try { await sendMdOtp() } finally { mdLockRef.current = false }
  }

  const sendMdOtp = async () => {
    if (sendingMdOtp) return
    setSendingMdOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/md-final/request-otp`)
      setMdOtpSent(true); setMdOtpSentTo(res.data.sentTo || '')
      setMdResendIn(res.data.resendIn || 30); setMdOtpDigits(Array(6).fill(''))
      setOtpNonce(n => n + 1)
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setMdResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingMdOtp(false)
  }

  const verifyMdFinal = async () => {
    if (mdLockRef.current) return
    mdLockRef.current = true
    setFinalizingMd(true)
    try {
      const res = await api.post(`/workflow/${id}/md-final`, {
        otpCode: mdOtpDigits.join(''), remarks: remarks || undefined,
      })
      setMdVerified(true)
      toast.success(res.data.message || 'Final approval complete. Tender created.')
      setTimeout(() => {
        setShowMdFinal(false); setMdVerified(false)
        setMdOtpSent(false); setMdOtpSentTo(''); setMdOtpDigits(Array(6).fill('')); setMdResendIn(0)
        setRemarks(''); setAction(''); load()
      }, 1200)
    } catch (err) { toast.error(err.response?.data?.error || 'Final approval failed') }
    setFinalizingMd(false)
    mdLockRef.current = false
  }

  const maskEmail = (email) => {
    if (!email || !String(email).includes('@')) return email || ''
    const [local, domain] = String(email).split('@')
    if (local.includes('*')) return String(email)
    if (local.length <= 2) return `${local[0]}*@${domain}`
    return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  const STEP_ACTION = {
    Submitted: 'Submit',
    DGM_Approved: 'Approve',
    GM_Recommended: 'Recommend',
    CGM_Submitted: 'SubmitForApproval',
    DOP_Approved: 'ApproveAtDOP',
    ED_Approved: 'ApproveAtED',
    MD_Approved: 'FinalApprove',
    TenderPublished: 'PublishTender',
    AgencySelected: 'SelectAgency',
    WorkStarted: 'StartWork',
    WorkCompleted: 'CompleteWork',
    Billing: 'SubmitBill',
    Completed: 'Archive',
  }
  const STEP_LABELS = {
    Draft: 'Draft',
    Submitted: 'DGM Verification',
    DGM_Approved: 'GM Recommendation',
    GM_Recommended: 'CGM Submission',
    CGM_Submitted: 'DOP Approval',
    DOP_Approved: 'ED Approval',
    ED_Approved: 'MD Final Approval',
    MD_Approved: 'MD Final Approved',
    Signed: 'Approved',
    TenderPublished: 'Tender Published',
    AgencySelected: 'Agency Selected',
    WorkStarted: 'Work Started',
    WorkCompleted: 'Work Completed',
    Billing: 'Billing',
    Completed: 'Completed',
  }
  const STATUS_INFO = {
    Draft: { role: 'Manager', waiting: 'Awaiting preparation and submission by the Manager' },
    Submitted: { role: 'DGM', waiting: 'Awaiting DGM verification' },
    DGM_Approved: { role: 'GM', waiting: 'Awaiting GM recommendation' },
    GM_Recommended: { role: 'CGM', waiting: 'Awaiting CGM submission to DOP' },
    CGM_Submitted: { role: 'DOP', waiting: 'Awaiting DOP approval' },
    DOP_Approved: { role: 'ED', waiting: 'Awaiting ED approval' },
    ED_Approved: { role: 'MD', waiting: 'Awaiting MD final approval' },
    MD_Approved: { role: 'Director of Administration', waiting: 'Awaiting FCN generation' },
    Signed: { role: 'Director of Administration', waiting: 'Awaiting FCN generation' },
    FinalApproved: { role: 'Director of Administration', waiting: 'Awaiting FCN generation' },
    FCNGenerated: { role: 'Director of Administration', waiting: 'Awaiting Administrative Sanction' },
    AdminSanctionGenerated: { role: 'Director of Administration / GM / DGM', waiting: 'Awaiting Technical Sanction' },
    GMReviewed: { role: 'Director of Administration / GM / DGM', waiting: 'Awaiting Technical Sanction' },
    DGMReviewed: { role: 'Tender Officer', waiting: 'Ready for tender creation' },
    TSPending: { role: 'Director of Administration / GM / DGM', waiting: 'Awaiting Technical Sanction approval' },
    TSApproved: { role: 'Tender Officer', waiting: 'Ready for tender preparation' },
    TenderPublished: { role: 'Director of Administration', waiting: 'Awaiting bid evaluation' },
    AgencySelected: { role: 'Site Engineer', waiting: 'Awaiting work commencement' },
    WorkStarted: { role: 'Site Engineer', waiting: 'Work is in progress' },
    WorkCompleted: { role: 'Billing Officer', waiting: 'Awaiting bill submission' },
    Billing: { role: 'Billing Officer', waiting: 'Awaiting bill processing' },
    Completed: { role: '—', waiting: 'Estimate completed' },
  }
  const DESIGNATION_FULL = {
    Manager: 'Manager',
    DGM: 'Deputy General Manager',
    GM: 'General Manager',
    CGM: 'Chief General Manager',
    DOP: 'Deputy Operations Officer',
    ED: 'Executive Director',
    MD: 'Managing Director',
    TenderOfficer: 'Tender Officer',
    DirectorOfAdministration: 'Director of Administration',
    SiteEngineer: 'Site Engineer',
    BillingOfficer: 'Billing Officer',
    Administrator: 'Administrator',
    SoRAdmin: 'SoR Admin',
    FinanceHead: 'Finance Head',
    FinanceClerk: 'Finance Clerk',
    FinanceManager: 'Finance Manager',
  }
  const wfFor = (key) => workflow.find(w => w.Action === STEP_ACTION[key]) || null
  const ownerName = workflow.length ? workflow[workflow.length - 1].ToUserName : null
  const isCurrentUserOwner = estimate?.CurrentOwner === user.UserID
  const currentOwnerLabel = isCurrentUserOwner
    ? (user.Name || 'You')
    : (ownerName || estimate?.CurrentOwnerName || (estimate?.CurrentOwner ? `User #${estimate.CurrentOwner}` : '—'))

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>
  if (!estimate) {
    const msg = loadError === 'not_found'
      ? `Estimate EST-${id} was not found.`
      : loadError === 'forbidden'
        ? 'You are not authorized to view this estimate.'
        : loadError === 'network'
          ? 'Network error — check your connection and retry.'
          : 'Unable to load estimate. Please retry.'
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
          <Info className="w-6 h-6 text-[#475569]" />
        </div>
        <p className="text-sm font-medium text-[#0F172A]">{msg}</p>
        <button type="button" onClick={load} className="mt-4 px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors">
          Retry
        </button>
      </div>
    )
  }

  const isOwner = estimate.CurrentOwner === user.UserID
  const role = user.Designation
  const estSla = slaTone(estimate.SlaDueAt)

const canEdit = canPerform(user, 'estimate', 'edit', estimate)
// Where a Draft/Reverted estimate forwards to, resolved from the CURRENT OWNER's
// designation (persisted in the payload), not the viewer's role or a default
// Manager flow. The same resolver drives the status card's
// Current/Next Stage/Role so display and actions always agree.
const frontPipeline = estimate.Status === 'Draft' || estimate.Status === 'Reverted'
const wfPos = resolveWorkflowPosition(estimate.Status, estimate.CurrentOwnerDesignation || estimate.CreatedByDesignation)
const canSubmit = isOwner && frontPipeline && !!wfPos?.nextStage && hasPermission(user, 'estimate.submit')
  && (estimate.Status !== 'Reverted' || !!estimate.ActionTakenReport?.trim())
const canRevert = isOwner && ['Submitted', 'DGM_Approved', 'Approved', 'GM_Recommended', 'CGM_Submitted',
  'DOP_Approved', 'ED_Approved',
  'Signed', 'TenderPublished', 'AgencySelected', 'WorkStarted', 'WorkCompleted', 'Billing'].includes(estimate.Status)
const canApprove = isOwner && estimate.Status === 'Submitted' && hasPermission(user, 'estimate.verify')
const canSign = isOwner && estimate.Status === 'DGM_Approved' && hasPermission(user, 'estimate.recommend')
const canCgmSubmit = isOwner && estimate.Status === 'GM_Recommended' && hasPermission(user, 'estimate.submitApproval')
const canDopApprove = isOwner && estimate.Status === 'CGM_Submitted' && hasPermission(user, 'estimate.approve')
const canEdApprove = isOwner && estimate.Status === 'DOP_Approved' && hasPermission(user, 'estimate.approve')
const canMdFinal = isOwner && estimate.Status === 'ED_Approved' && hasPermission(user, 'estimate.finalApprove')
const canGenerateFcn = isOwner && estimate.Status === 'FinalApproved' && hasPermission(user, 'estimate.generateFCN')
const canGenerateSanction = isOwner && estimate.Status === 'FCNGenerated' && hasPermission(user, 'estimate.generateSanction')
const canAssignTs = isOwner && estimate.Status === 'AdminSanctionGenerated' && role === 'DirectorOfAdministration'
const canApproveTs = isOwner && estimate.Status === 'TSPending' && (role === 'DirectorOfAdministration' || role === 'GM' || role === 'DGM')
const canReturnTs = isOwner && estimate.Status === 'TSPending' && (role === 'DirectorOfAdministration' || role === 'GM' || role === 'DGM')
const canPublishTender = isOwner && estimate.Status === 'TSApproved' && hasPermission(user, 'tender.publish')
const canSelectAgency = isOwner && estimate.Status === 'TenderPublished' && role === 'DirectorOfAdministration'
const canStartWork = isOwner && estimate.Status === 'AgencySelected' && hasPermission(user, 'work.start')
const canCompleteWork = isOwner && estimate.Status === 'WorkStarted' && hasPermission(user, 'work.complete')
const canSubmitBill = isOwner && estimate.Status === 'WorkCompleted' && hasPermission(user, 'bill.create')
  const canArchive = isOwner && estimate.Status === 'Billing' && role === 'Administrator'

  const a = estimate.Abstract || {}

  const slaDetail = estimate.SlaDueAt
    ? (() => {
        const diff = new Date(estimate.SlaDueAt).getTime() - Date.now()
        const days = Math.ceil(diff / 86400000)
        if (diff < 0) return { tone: 'danger', text: `Overdue by ${Math.max(1, Math.abs(days))} day${Math.max(1, Math.abs(days)) === 1 ? '' : 's'}` }
        if (days <= 0) return { tone: 'danger', text: 'Due today' }
        if (days <= 1) return { tone: 'warn', text: 'Due soon' }
        return { tone: 'ok', text: `${days} day${days === 1 ? '' : 's'} remaining` }
      })()
    : null

  // Single source of truth for every action — reused by header, More Actions and ActionPanel.
  const allActions = [
    { key: 'edit', label: 'Edit Estimate', icon: Edit3, tone: 'secondary', show: canEdit, onClick: () => navigate(`/estimates/${id}/edit`) },
{ key: 'submit', label: estimate.Status === 'Reverted' ? 'Resubmit to DGM' : (wfPos?.nextStage?.owner === 'DGM' ? 'Submit to DGM' : `Forward to ${DESIGNATION_FULL[wfPos?.nextStage?.owner] || wfPos?.nextStage?.owner || 'DGM'}`), icon: Send, tone: 'primary', show: canSubmit, onClick: openSubmitOtp },
    { key: 'approve', label: 'Forward to GM', icon: CheckCircle, tone: 'primary', show: canApprove, onClick: openDgmApproveOtp },
    { key: 'sign', label: 'Recommend to CGM', icon: PenSquare, tone: 'primary', show: canSign, onClick: openSignOtp },
    { key: 'cgm', label: 'Forward to DOP', icon: Send, tone: 'primary', show: canCgmSubmit, onClick: openCgmSubmitOtp },
    { key: 'dop', label: 'Approve & Forward to ED', icon: CheckCircle, tone: 'primary', show: canDopApprove, onClick: openDopApproveOtp },
    { key: 'ed', label: 'Approve & Forward to MD', icon: CheckCircle, tone: 'primary', show: canEdApprove, onClick: openEdApproveOtp },
    { key: 'md', label: 'Final Approve', icon: PenSquare, tone: 'primary', show: canMdFinal, onClick: openMdFinalOtp },
    { key: 'fcn', label: 'Generate FCN', icon: FileCheck, tone: 'primary', show: canGenerateFcn, onClick: () => confirmAction('generate-fcn') },
    { key: 'sanction', label: 'Generate Admin Sanction', icon: Landmark, tone: 'primary', show: canGenerateSanction, onClick: () => confirmAction('generate-admin-sanction') },
    { key: 'assign-ts', label: 'Assign TS Authority', icon: ClipboardList, tone: 'primary', show: canAssignTs, onClick: () => confirmAction('assign-ts-authority') },
    { key: 'approve-ts', label: 'Forward for TS', icon: Stamp, tone: 'primary', show: canApproveTs, onClick: () => confirmAction('approve-ts') },
    { key: 'return-ts', label: 'Return TS', icon: RotateCcw, tone: 'danger', show: canReturnTs, onClick: () => confirmAction('return-ts') },
    { key: 'publish', label: 'Create Tender', icon: Megaphone, tone: 'primary', show: canPublishTender, onClick: () => confirmAction('publish-tender') },
    { key: 'agency', label: 'Finalize Agency', icon: Building2, tone: 'primary', show: canSelectAgency, onClick: () => confirmAction('select-agency') },
    { key: 'start-work', label: 'Start Work', icon: Hammer, tone: 'primary', show: canStartWork, onClick: () => confirmAction('start-work') },
    { key: 'complete-work', label: 'Complete Work', icon: CheckCircle, tone: 'primary', show: canCompleteWork, onClick: () => confirmAction('complete-work') },
    { key: 'submit-bill', label: 'Prepare Bill', icon: Wallet, tone: 'primary', show: canSubmitBill, onClick: prepareBill },
    { key: 'archive', label: 'Archive & Complete', icon: Archive, tone: 'primary', show: canArchive, onClick: () => confirmAction('archive') },
    { key: 'revert', label: 'Revert to Creator', icon: RotateCcw, tone: 'danger', show: canRevert, onClick: () => confirmAction('revert') },
  ].filter(x => x.show)

  const hasCivil = estimate.Items?.filter(i => i.Category === 'Civil').length > 0
  const hasAbstract = !!a.GrandTotal
  const tabs = [
    { key: 'civil', label: 'Civil Items', icon: ClipboardList, show: hasCivil },
    { key: 'material', label: 'Material Items', icon: ClipboardList, show: hasMaterial },
    { key: 'abstract', label: 'Abstract of Estimate', icon: FileSpreadsheet, show: hasAbstract },
    { key: 'documents', label: 'Documents', icon: FileText, show: true },
    { key: 'approvals', label: 'Approvals', icon: ShieldCheck, show: true },
    { key: 'history', label: 'History', icon: History, show: true },
    { key: 'audit', label: 'Audit Trail', icon: History, show: true },
    { key: 'related', label: 'Related Works', icon: Briefcase, show: true },
  ]
  const visibleTabs = tabs.filter(t => t.show)
  const activeShown = visibleTabs.find(t => t.key === activeTab) || visibleTabs[0]

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5 flex-wrap">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#475569] hover:bg-[#F1F5F9] mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="ec-page-title">{estimate.EstimateNo}</h1>
            <StatusBadge status={estimate.Status} />
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#475569] bg-[#F1F5F9]">v{estimate.Version}</span>
          </div>
          <p className="ec-page-subtitle">{estimate.NameOfWork}</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            {estimate.FinancialYear && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[#475569] bg-[#F1F5F9]">FY {estimate.FinancialYear}</span>
            )}
            {estimate.WorkCategory && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[#475569] bg-[#F1F5F9]">{estimate.WorkCategory}</span>
            )}
            {hasMaterial && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[#475569] bg-[#F1F5F9]">Material Required</span>
            )}
            {[estimate.ZoneName, estimate.DivisionName, estimate.CircleName].filter(Boolean).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[#475569] bg-[#F1F5F9]">
                {[estimate.ZoneName, estimate.DivisionName, estimate.CircleName].filter(Boolean).join(' → ')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2563EB] bg-[#F1F5F9] rounded-lg hover:bg-[#CBD5E1] transition-colors">
            <History className="w-3.5 h-3.5" />
            Audit Trail
          </button>
        </div>
      </div>

      {/* Workflow History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#CBD5E1] px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-[#0F172A]">Audit Trail</h3>
              <button onClick={() => setShowHistory(false)} className="p-1 rounded hover:bg-[#F1F5F9]">
                <X className="w-4 h-4 text-[#475569]" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
              {[...workflow].sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime) || (b.WorkflowID || 0) - (a.WorkflowID || 0)).map((w, i) => (
                <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#CBD5E1] last:border-l-0 last:pb-0">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#2563EB]" />
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                    {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                  </p>
                  <p className="text-[10px] text-[#475569]">
                    {w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})
                  </p>
                  {w.Remarks && <p className="text-[10px] text-[#475569] mt-0.5">{w.Remarks}</p>}
                  <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
            {estimate.IsDigitallySigned && (estimate.CertificateID || estimate.SignatureHash) && (
              <>
                <div className="border-t border-[#CBD5E1] px-5 py-3">
                  <h4 className="font-semibold text-[#0F172A] text-sm">Digital Signature (Technical)</h4>
                </div>
                <div className="px-5 pb-5 space-y-1.5">
                  {estimate.CertificateID && (
                    <p className="text-xs text-[#475569]">
                      <span className="font-medium text-[#2563EB]">Certificate ID:</span> {estimate.CertificateID}
                    </p>
                  )}
                  {estimate.SignatureHash && (
                    <p className="text-[10px] text-[#475569] break-all font-mono">
                      <span className="font-medium text-[#2563EB]">Signature Hash:</span> {estimate.SignatureHash}
                    </p>
                  )}
                </div>
              </>
            )}
            {versions.length > 0 && (
              <>
                <div className="border-t border-[#CBD5E1] px-5 py-3">
                  <h4 className="font-semibold text-[#0F172A] text-sm">Versions</h4>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {versions.map((v, i) => (
                    <div key={v.VersionID || i} className="text-xs">
                      <div className="text-[#475569]">
                        <span className="font-semibold text-[#0F172A]">v{v.VersionNumber}</span> — {v.CreatedByName} · {new Date(v.CreatedDate).toLocaleString('en-IN')}
                        {v.Remarks && <span className="text-[#94A3B8]">: {v.Remarks}</span>}
                      </div>
                      {Array.isArray(v.Changes) && v.Changes.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-3 border-l-2 border-[#CBD5E1]">
                          {v.Changes.map((c, ci) => (
                            <li key={ci} className="text-[10px] text-[#475569]">
                              <span className="font-medium text-[#2563EB]">{c.field}:</span>{' '}
                              {c.oldValue == null ? '—' : typeof c.oldValue === 'object' ? '(changed)' : String(c.oldValue)}
                              {' → '}
                              {c.newValue == null ? '—' : typeof c.newValue === 'object' ? '(changed)' : String(c.newValue)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Workflow Progress — Current Phase First */}
      <div className="mb-5">
        <WorkflowProgress
          status={estimate.Status}
          workflow={workflow}
          showOwner
          hideInfoStrip
          ownerName={ownerName || estimate.CurrentOwnerName || '—'}
          sla={estimate.SlaDueAt ? { status: estimate.SlaStatus || 'Normal', dueAt: estimate.SlaDueAt } : undefined}
          onStageClick={(stageKey) => setStepKey(getStatusKeyForStage(stageKey) || stageKey)}
        />
      </div>

      {/* ATR Banner */}
      {estimate.Status === 'Reverted' && (() => {
        const lastRevert = workflow.filter(w => w.Action === 'Revert').pop()
        return (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">This estimate has been returned to you</p>
            {lastRevert?.FromDesignation && (
              <p className="text-xs text-red-600 mt-1">Returned by <span className="font-semibold">{lastRevert.FromDesignation}</span></p>
            )}
            {lastRevert?.Remarks && (
              <p className="text-xs text-red-600 mt-1"><span className="font-medium">Reason:</span> {lastRevert.Remarks}</p>
            )}
            {estimate.ActionTakenReport && <p className="text-xs text-red-600 mt-1">ATR: {estimate.ActionTakenReport}</p>}
            {!estimate.ActionTakenReport?.trim() && (
              <p className="text-xs font-medium text-red-700 mt-2">
                Add an Action Taken Report and save the estimate before you can resubmit it to the DGM.
              </p>
            )}
          </div>
        )
      })()}

      {/* Digital Signature Success Alert */}
      {estimate.IsDigitallySigned && (() => {
        const signEntry = workflow.find(w => w.Action === 'DigitallySign') || null
        const signedByName = signEntry?.FromUserName
          || (estimate.DigitallySignedBy ? `User #${estimate.DigitallySignedBy}` : null)
        const signedByDesig = signEntry?.FromDesignation ? (DESIGNATION_FULL[signEntry.FromDesignation] || signEntry.FromDesignation) : ''
        const statusText = STATUS_INFO[estimate.Status]?.waiting || getStatusLabel(estimate.Status)
        return (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-none" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800">Estimate Successfully Approved</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {PROC_PANEL[estimate.Status]
                    ? 'Final approval complete. The record has moved into the procurement workflow and requires the next responsibility below.'
                    : 'This estimate has been digitally signed and forwarded to the Tender Officer for the next stage of the workflow.'}
                </p>
                {PROC_PANEL[estimate.Status] && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-white/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Next Procurement Stage</p>
                    <p className="text-xs font-bold text-[#0F172A] mt-0.5">{PROC_PANEL[estimate.Status].stage}</p>
                    <p className="text-xs text-[#475569] mt-0.5">Responsible: <span className="font-semibold text-[#0F172A]">{PROC_PANEL[estimate.Status].role}</span> — {PROC_PANEL[estimate.Status].task}</p>
                    {estSla && (
                      <p className="text-xs text-[#475569] mt-0.5">SLA due: <span className="font-semibold text-emerald-800">{estSla.label}</span></p>
                    )}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-emerald-800">
                  {signedByName && (
                    <p>
                      <span className="font-semibold text-emerald-900">Signed By:</span>{' '}
                      {signedByName}{signedByDesig ? ` · ${signedByDesig}` : ''}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-emerald-900">Signed On:</span>{' '}
                    {fmtDateTime(estimate.DigitallySignedDate)}
                  </p>
                  {estimate.CertificateID && (
                    <p>
                      <span className="font-semibold text-emerald-900">Certificate No.:</span>{' '}
                      {estimate.CertificateID}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-emerald-900">Current Status:</span> {statusText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline">
                  View Audit Trail <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )
      })()}

{/* Estimate Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <div className="ec-card">
          <div className="ec-card-header">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">Estimate Information</span>
          </div>
          <div className="ec-card-body">
            <div className="space-y-2.5 text-xs">
              {[
                ['Estimate No', estimate.EstimateNo],
                ['Financial Year', estimate.FinancialYear],
                ['Work Category', estimate.WorkCategory],
                ['Work Name', estimate.NameOfWork],
                ['Material Required', hasMaterial ? 'Yes' : 'No'],
                ['GST', `${estimate.GSTPercent}%`],
                ['Version', estimate.Version],
                ['Created By', estimate.CreatedByName || user.Name],
                ['Created Date', fmtDate(estimate.CreatedDate)],
                ['Submitted Date', fmtDate(estimate.SubmissionDate)],
                ['FCN No', estimate.FCNNo || 'Pending'],
                ['AS No', estimate.ASNo || 'Pending'],
                ['AS Date', estimate.ASDate ? fmtDate(estimate.ASDate) : 'Pending'],
                ['TS No', estimate.TSNo || 'Pending'],
                ['TS Date', estimate.TSDate ? fmtDate(estimate.TSDate) : 'Pending'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-2">
                  <span className="text-[#475569]">{k}</span>
                  <span className="font-medium text-[#0F172A] text-right">{v || '—'}</span>
                </div>
              ))}
              {[estimate.RegionName, estimate.ZoneName, estimate.DivisionName, estimate.CircleName, estimate.WardName].some(Boolean) && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#475569]">Location</span>
                  <span className="font-medium text-[#0F172A] text-right">
                    {[estimate.RegionName, estimate.ZoneName, estimate.DivisionName, estimate.CircleName, estimate.WardName].filter(Boolean).join(' → ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ec-card">
          <div className="ec-card-header">
            <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">Financial Summary</span>
          </div>
          <div className="ec-card-body">
            <div className="space-y-2.5 text-xs">
              {hasAbstract ? (
                <>
                  {[
                    ['Civil Work Total', a.CivilTotal],
                    ['Material Total', a.MaterialTotal],
                    ['Cost of Estimate (Part-I)', a.CostOfEstimate],
                    ['GST @ ' + (estimate.GSTPercent || 0) + '% (Part-II)', a.GST],
                    ['Additional Items (Part-II)', a.AdditionalItemsTotal],
                    ['LS Provision (Part-III)', a.LSProvision],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-[#475569]">{k}</span>
                      <span className="font-medium text-[#0F172A]">{fmt(v)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#CBD5E1]">
                    <span className="font-bold text-[#0F172A]">Total Estimate Value</span>
                    <span className="font-bold text-[#2563EB]">{fmt(a.GrandTotal)}</span>
                  </div>
                  {a.GrandTotalInWords && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#475569]">Amount in Words</span>
                      <span className="font-medium text-[#0F172A] text-right">{a.GrandTotalInWords}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[#94A3B8]">Abstract not available</p>
              )}
            </div>
          </div>
        </div>

        <div className="ec-card">
          <div className="ec-card-header">
            <Users className="w-4 h-4 text-[#2563EB]" />
            <span className="ec-card-title">Current Status</span>
          </div>
          <div className="ec-card-body">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Current Stage</span>
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={estimate.Status} />
                  <span className="font-medium text-[#0F172A]">{wfPos?.currentStage?.label || getStatusLabel(estimate.Status)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Current Owner</span>
                <span className="font-medium text-[#0F172A] text-right">
                  {currentOwnerLabel}
                  {isCurrentUserOwner && <span className="text-[#94A3B8]"> (You)</span>}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Next Stage</span>
                <span className="font-medium text-[#0EA5E9] text-right">{wfPos?.nextStage?.label || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Next Role</span>
                <span className="font-medium text-[#0F172A] text-right">{wfPos?.nextStage?.owner || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">SLA</span>
                <span className={`font-medium text-right ${estSla.tone === 'danger' ? 'text-red-600' : estSla.tone === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>
                  {estSla.label !== '—' ? estSla.label : '—'}
                </span>
              </div>
              {slaDetail && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#475569]">Time Remaining</span>
                  <span className={`font-medium text-right ${slaDetail.tone === 'danger' ? 'text-red-600' : slaDetail.tone === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>
                    {slaDetail.text}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Last Updated</span>
                <span className="font-medium text-[#0F172A] text-right">{fmtDateTime(estimate.LastModifiedDate)}</span>
              </div>
              {(estimate.ActionTakenReport || estimate.ReturnRemarks) && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#475569]">Remarks</span>
                  <span className="font-medium text-[#0F172A] text-right">{estimate.ActionTakenReport || estimate.ReturnRemarks}</span>
                </div>
              )}
              {estimate.Agency && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#475569]">Agency</span>
                  <span className="font-medium text-[#0F172A] text-right">{estimate.Agency.AgencyName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Right-side Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="flex gap-0.5 border-b border-[#CBD5E1] mb-5 overflow-x-auto" role="tablist">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeShown.key === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${activeShown.key === t.key ? 'text-[#2563EB] border-[#2563EB]' : 'text-[#475569] border-transparent hover:text-[#334155]'}`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {activeShown.key === 'civil' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <ClipboardList className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Civil Items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="ec-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Code</th><th>Description</th>
                      <th className="text-right">Qty</th><th>Unit</th>
                      <th className="text-right">Rate</th><th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.Items.filter(i => i.Category === 'Civil').map((item, idx) => (
                      <tr key={item.DetailID || idx}>
                        <td className="text-[#94A3B8]">{idx + 1}</td>
                        <td className="font-mono text-xs">{item.ItemCode}</td>
                        <td className="max-w-[200px] truncate text-xs">{item.Description}</td>
                        <td className="text-right text-xs">{parseFloat(item.Qty).toFixed(3)}</td>
                        <td className="text-xs">{item.Unit}</td>
                        <td className="text-right text-xs">{fmt(item.Rate)}</td>
                        <td className="text-right font-semibold text-xs">{fmt(item.Amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeShown.key === 'material' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <ClipboardList className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Material Items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="ec-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Code</th><th>Description</th>
                      <th className="text-right">Qty</th><th>Unit</th>
                      <th className="text-right">Rate</th><th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.Items.filter(i => i.Category === 'Material').map((item, idx) => (
                      <tr key={item.DetailID || idx}>
                        <td className="text-[#94A3B8]">{idx + 1}</td>
                        <td className="font-mono text-xs">{item.ItemCode}</td>
                        <td className="max-w-[200px] truncate text-xs">{item.Description}</td>
                        <td className="text-right text-xs">{parseFloat(item.Qty).toFixed(3)}</td>
                        <td className="text-xs">{item.Unit}</td>
                        <td className="text-right text-xs">{fmt(item.Rate)}</td>
                        <td className="text-right font-semibold text-xs">{fmt(item.Amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeShown.key === 'abstract' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Abstract of Estimate</span>
              </div>
              <div className="ec-card-body">
                <div className="max-w-md mx-auto space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">Civil Work Total</span>
                    <span className="font-medium">{fmt(a.CivilTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">Material Total</span>
                    <span className="font-medium">{fmt(a.MaterialTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">Cost of Estimate (Part-I)</span>
                    <span className="font-medium">{fmt(a.CostOfEstimate)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">GST @ {estimate.GSTPercent}% (Part-II)</span>
                    <span className="font-medium">{fmt(a.GST)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">Additional Items (Part-II)</span>
                    <span className="font-medium">{fmt(a.AdditionalItemsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]">
                    <span className="text-[#475569]">LS Provision (Part-III)</span>
                    <span className="font-medium">{fmt(a.LSProvision)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-bold text-[#0F172A]">Grand Total</span>
                    <span className="font-bold text-[#2563EB]">{fmt(a.GrandTotal)}</span>
                  </div>
                  {a.GrandTotalInWords && (
                    <div className="flex justify-between py-1.5 border-t border-[#CBD5E1]">
                      <span className="text-[#475569]">Amount in Words</span>
                      <span className="font-medium text-right max-w-[60%]">{a.GrandTotalInWords}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#CBD5E1]">
                  <Link to={`/abstract/${id}`} className="ec-btn-outline ec-btn-sm">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Full Abstract
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeShown.key === 'documents' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <Download className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Documents & Exports</span>
              </div>
              <div className="ec-card-body space-y-2">
                <Link to={`/abstract/${id}`} className="ec-btn-outline w-full justify-center">
                  <FileDown className="w-3.5 h-3.5" /> Full Abstract View
                </Link>
                <button onClick={() => exportFile('pdf')} disabled={!!exporting}
                  className="ec-btn ec-btn-primary w-full justify-center">
                  {exporting === 'pdf' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Download Complete PDF
                </button>
                <button onClick={() => exportFile('excel')} disabled={!!exporting}
                  className="ec-btn ec-btn-success w-full justify-center">
                  {exporting === 'excel' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  Download Complete Excel
                </button>
                {docsLoading ? (
                  <div className="pt-1 flex items-center justify-center py-1 text-xs text-[#94A3B8]">
                    <Loader className="w-3.5 h-3.5 animate-spin mr-2" /> Loading documents...
                  </div>
                ) : docs.length === 0 ? (
                  <p className="pt-1 text-xs text-[#94A3B8]">No documents uploaded for this estimate yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-[#475569] flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Uploaded documents ({docs.length})
                    </p>
                    {docs.map(d => (
                      <div key={d.DocumentID} className="flex items-center justify-between gap-2 rounded-md border border-[#CBD5E1] px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0F172A] truncate">{d.OriginalName}</p>
                          <p className="text-[10px] text-[#94A3B8]">{d.MimeType || 'document'} · {fmtSize(d.SizeBytes)} · {new Date(d.CreatedAt).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => viewDoc(d)} disabled={openingDoc === d.DocumentID}
                            className="px-1.5 py-1 text-[10px] font-medium text-[#2563EB] hover:bg-[#E8EEF7] rounded flex items-center gap-1">
                            {openingDoc === d.DocumentID ? <Loader className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} View
                          </button>
                          <button type="button" onClick={() => downloadDoc(d)} className="px-1.5 py-1 text-[10px] font-medium text-[#2563EB] hover:bg-[#E8EEF7] rounded flex items-center gap-1">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {estimate.IsDigitallySigned && (estimate.CertificateID || estimate.SignatureHash) && (
                  <div className="pt-3 border-t border-[#CBD5E1] space-y-1.5">
                    {estimate.CertificateID && (
                      <p className="text-xs text-[#475569]">
                        <span className="font-medium text-[#2563EB]">Certificate ID:</span> {estimate.CertificateID}
                      </p>
                    )}
                    {estimate.SignatureHash && (
                      <p className="text-[10px] text-[#475569] break-all font-mono">
                        <span className="font-medium text-[#2563EB]">Signature Hash:</span> {estimate.SignatureHash}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeShown.key === 'approvals' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Approval Information</span>
              </div>
              <div className="ec-card-body">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  {[
                    ['Created By', estimate.CreatedByName || user.Name],
                    ['Created Date', fmtDate(estimate.CreatedDate)],
                    ['Current Status', getStatusLabel(estimate.Status)],
                    ['Submitted Date', fmtDate(estimate.SubmissionDate)],
                    ['FCN No', estimate.FCNNo || 'Pending'],
                    ['AS No / Date', estimate.ASNo ? `${estimate.ASNo}${estimate.ASDate ? ` · ${fmtDate(estimate.ASDate)}` : ''}` : 'Pending'],
                    ['TS No / Date', estimate.TSNo ? `${estimate.TSNo}${estimate.TSDate ? ` · ${fmtDate(estimate.TSDate)}` : ''}` : 'Pending'],
                    ['Signed Date', estimate.IsDigitallySigned ? fmtDateTime(estimate.DigitallySignedDate) : 'Not signed'],
                    ['Certificate ID', estimate.CertificateID || '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] font-medium text-[#475569]">{k}</p>
                      <p className="text-sm font-medium text-[#0F172A]">{v || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeShown.key === 'history' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <History className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Workflow History</span>
              </div>
              <div className="ec-card-body max-h-[480px] overflow-y-auto">
                {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
                {[...workflow].sort((x, y) => new Date(y.DateTime) - new Date(x.DateTime)).map((w, i) => (
                  <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#CBD5E1] last:border-l-0 last:pb-0">
                    <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#2563EB]" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                      {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                    </p>
                    <p className="text-[10px] text-[#475569]">{w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})</p>
                    {w.Remarks && <p className="text-[10px] text-[#475569] mt-0.5">{w.Remarks}</p>}
                    <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeShown.key === 'audit' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <History className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Audit Trail</span>
              </div>
              <div className="ec-card-body max-h-[480px] overflow-y-auto">
                {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
                {[...workflow].sort((x, y) => new Date(y.DateTime) - new Date(x.DateTime)).map((w, i) => (
                  <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#CBD5E1] last:border-l-0 last:pb-0">
                    <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#2563EB]" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                      {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                    </p>
                    <p className="text-[10px] text-[#475569]">{w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})</p>
                    {w.Remarks && <p className="text-[10px] text-[#475569] mt-0.5">{w.Remarks}</p>}
                    <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                  </div>
                ))}
                {versions.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#CBD5E1] space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">Versions</p>
                    {versions.map((v, i) => (
                      <div key={v.VersionID || i} className="text-xs">
                        <div className="text-[#475569]">
                          <span className="font-semibold text-[#0F172A]">v{v.VersionNumber}</span> — {v.CreatedByName} · {new Date(v.CreatedDate).toLocaleString('en-IN')}
                          {v.Remarks && <span className="text-[#94A3B8]">: {v.Remarks}</span>}
                        </div>
                        {Array.isArray(v.Changes) && v.Changes.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 pl-3 border-l-2 border-[#CBD5E1]">
                            {v.Changes.map((c, ci) => (
                              <li key={ci} className="text-[10px] text-[#475569]">
                                <span className="font-medium text-[#2563EB]">{c.field}:</span>{' '}
                                {c.oldValue == null ? '—' : typeof c.oldValue === 'object' ? '(changed)' : String(c.oldValue)}
                                {' → '}
                                {c.newValue == null ? '—' : typeof c.newValue === 'object' ? '(changed)' : String(c.newValue)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeShown.key === 'related' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <Briefcase className="w-4 h-4 text-[#2563EB]" />
                <span className="ec-card-title">Related Works</span>
              </div>
              <div className="ec-card-body space-y-2">
                {estimate.Status === 'MD_Approved' && role === 'TenderOfficer' && (
                  <Link to={`/tenders?estimateId=${id}`} className="ec-btn-outline w-full justify-center">
                    <Plus className="w-3.5 h-3.5" /> View Auto-Created Tender
                  </Link>
                )}
                <Link to={`/tenders?estimateId=${id}`} className="ec-btn-outline w-full justify-center text-xs">
                  <Briefcase className="w-3.5 h-3.5" /> View Tenders
                </Link>
                <Link to={`/agencies?estimateId=${id}`} className="ec-btn-outline w-full justify-center text-xs">
                  <Building2 className="w-3.5 h-3.5" /> View Agencies
                </Link>
                <Link to={`/progress?estimateId=${id}`} className="ec-btn-outline w-full justify-center text-xs">
                  <Hammer className="w-3.5 h-3.5" /> View Progress
                </Link>
                <Link to={`/billing?estimateId=${id}`} className="ec-btn-outline w-full justify-center text-xs">
                  <DollarSign className="w-3.5 h-3.5" /> View Bills
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <ActionPanel actions={allActions} />
        </div>
      </div>

      {/* Step Details Drawer */}
      {stepKey && (() => {
        const entry = wfFor(stepKey)
        const isActive = estimate.Status === stepKey
        return (
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setStepKey(null)}>
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-[#2563EB] px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#BFDBFE]">Workflow Stage</p>
                  <h3 className="font-semibold text-white">{STEP_LABELS[stepKey] || getStatusLabel(stepKey)}</h3>
                </div>
                <button onClick={() => setStepKey(null)} className="p-1 rounded hover:bg-white/10">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {isActive && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-semibold text-[#2563EB]">
                    <Info className="w-3.5 h-3.5" /> Current Stage — {STATUS_INFO[stepKey]?.waiting}
                  </div>
                )}

                {stepKey === 'Draft' && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Estimate Creation</p>
                    <div className="p-3 space-y-1.5 text-xs">
                      <p><span className="text-[#475569]">Created by:</span> <span className="font-medium text-[#0F172A]">{estimate.CreatedByName || user.Name}</span></p>
                      <p><span className="text-[#475569]">Created on:</span> <span className="font-medium text-[#0F172A]">{fmtDateTime(estimate.CreatedDate)}</span></p>
                      <p><span className="text-[#475569]">Estimate no:</span> <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span></p>
                    </div>
                  </div>
                )}

                {entry && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Approval Details</p>
                    <div className="p-3 space-y-1.5 text-xs">
                      <p><span className="text-[#475569]">Performed by:</span> <span className="font-medium text-[#0F172A]">{entry.FromUserName} ({entry.FromDesignation})</span></p>
                      <p><span className="text-[#475569]">Forwarded to:</span> <span className="font-medium text-[#0F172A]">{entry.ToUserName} ({entry.ToDesignation})</span></p>
                      <p><span className="text-[#475569]">Date & time:</span> <span className="font-medium text-[#0F172A]">{fmtDateTime(entry.DateTime)}</span></p>
                      {entry.Version != null && <p><span className="text-[#475569]">Version:</span> <span className="font-medium text-[#0F172A]">v{entry.Version}</span></p>}
                      {entry.OTPVerified && <p><span className="text-[#475569]">OTP verification:</span> <span className="font-medium text-emerald-700">Verified</span></p>}
                      {entry.Remarks && <p><span className="text-[#475569]">Remarks:</span> <span className="font-medium text-[#0F172A]">{entry.Remarks}</span></p>}
                    </div>
                  </div>
                )}

                {stepKey === 'Signed' && estimate.IsDigitallySigned && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50">
                    <p className="px-3 py-2 text-xs font-semibold text-emerald-800 border-b border-emerald-200">Digital Signature</p>
                    <div className="p-3 space-y-1.5 text-xs text-emerald-800">
                      <p><span className="text-emerald-700">Certificate No.:</span> <span className="font-medium">{estimate.CertificateID || '—'}</span></p>
                      <p><span className="text-emerald-700">Signed on:</span> <span className="font-medium">{fmtDateTime(estimate.DigitallySignedDate)}</span></p>
                    </div>
                  </div>
                )}

                {stepKey === 'TenderPublished' && tenders.length > 0 && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Tender</p>
                    <div className="p-3 space-y-2">
                      {tenders.map(t => (
                        <div key={t.TenderID} className="rounded border border-[#CBD5E1] p-2.5 space-y-1 text-xs">
                          <p className="font-semibold text-[#0F172A]">{t.TenderNo || `Tender #${t.TenderID}`}</p>
                          <p><span className="text-[#475569]">Tender date:</span> {fmtDate(t.TenderDate)}</p>
                          {t.EstimatedCost != null && <p><span className="text-[#475569]">Estimated cost:</span> {fmt(t.EstimatedCost)}</p>}
                          <p><span className="text-[#475569]">Status:</span> <span className="font-medium">{t.Status}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stepKey === 'AgencySelected' && agencies.length > 0 && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Agency</p>
                    <div className="p-3 space-y-2">
                      {agencies.map(a => (
                        <div key={a.AgencyID} className="rounded border border-[#CBD5E1] p-2.5 space-y-1 text-xs">
                          <p className="font-semibold text-[#0F172A]">{a.AgencyName}</p>
                          {a.AgencyCode && <p><span className="text-[#475569]">Code:</span> {a.AgencyCode}</p>}
                          {tenders[0]?.WorkOrderNo && <p><span className="text-[#475569]">Work order:</span> {tenders[0].WorkOrderNo}</p>}
                          {tenders[0]?.AgreementNo && <p><span className="text-[#475569]">Agreement:</span> {tenders[0].AgreementNo}</p>}
                          {a.ContractorName && <p><span className="text-[#475569]">Contractor:</span> {a.ContractorName}</p>}
                          {a.TenderValue != null && <p><span className="text-[#475569]">Tender value:</span> {fmt(a.TenderValue)}</p>}
                          {a.AgreementDate && <p><span className="text-[#475569]">Award date:</span> {fmtDate(a.AgreementDate)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['WorkStarted', 'WorkCompleted'].includes(stepKey) && (estimate.StartedDate || progressList.length > 0) && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Work Progress</p>
                    <div className="p-3 space-y-2">
                      {estimate.StartedDate && (
                        <div className="rounded border border-[#CBD5E1] p-2.5 text-xs">
                          <p><span className="text-[#475569]">Work started on:</span> <span className="font-medium">{fmtDateTime(estimate.StartedDate)}</span></p>
                          {estimate.StartedByName && <p><span className="text-[#475569]">Started by:</span> <span className="font-medium">{estimate.StartedByName}</span></p>}
                        </div>
                      )}
                      {progressList.map(p => (
                        <div key={p.ProgressID} className="rounded border border-[#CBD5E1] p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-[#0F172A]">{p.Stage || `Progress ${p.ProgressID}`}</p>
                            {p.Percentage != null && (
                              <span className="px-1.5 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] font-semibold text-[10px]">{p.Percentage}%</span>
                            )}
                          </div>
                          {p.Date && <p><span className="text-[#475569]">Date:</span> {fmtDate(p.Date)}</p>}
                          {p.Remarks && <p className="text-[#475569]">{p.Remarks}</p>}
                          {p.InspectionNotes && <p><span className="text-[#475569]">Inspection:</span> {p.InspectionNotes}</p>}
                          {p.DelayReason && <p><span className="text-[#475569]">Delay reason:</span> {p.DelayReason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['WorkStarted', 'WorkCompleted'].includes(stepKey) && (estimate.StartedDate || progressList.length > 0) && (
                  <WorkProgressPhotos estimateId={id} />
                )}

                {stepKey === 'Billing' && bills.length > 0 && (
                  <div className="rounded-lg border border-[#CBD5E1]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC]">Bills</p>
                    <div className="p-3 space-y-2">
                      {bills.map(b => (
                        <div key={b.BillID} className="rounded border border-[#CBD5E1] p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-[#0F172A]">{b.BillNo || `Bill #${b.BillID}`}</p>
                            <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[10px] font-medium">{b.Status}</span>
                          </div>
                          {b.BillDate && <p><span className="text-[#475569]">Bill date:</span> {fmtDate(b.BillDate)}</p>}
                          {b.NetAmount != null && <p><span className="text-[#475569]">Net amount:</span> {fmt(b.NetAmount)}</p>}
                          {b.ApprovedAmount != null && b.ApprovedAmount != 0 && <p><span className="text-[#475569]">Approved amount:</span> {fmt(b.ApprovedAmount)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stepKey === 'Completed' && estimate.IsCompleted && (
                  <div className="rounded-lg border border-green-200 bg-green-50">
                    <p className="px-3 py-2 text-xs font-semibold text-green-800 border-b border-green-200">Closure</p>
                    <div className="p-3 space-y-1.5 text-xs text-green-800">
                      <p><span className="text-green-700">Completed on:</span> <span className="font-medium">{fmtDateTime(estimate.CompletedDate)}</span></p>
                      <p><span className="text-green-700">Completed by:</span> <span className="font-medium">{estimate.CompletedByName || '—'}</span></p>
                      <p className="font-medium">This estimate has been archived and closed.</p>
                    </div>
                  </div>
                )}

                {!entry && stepKey !== 'Draft' && (
                  <p className="text-xs text-[#94A3B8] text-center py-2">No records recorded for this stage yet.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confirm Action Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => { setShowConfirm(false); setAction('') }}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#0F172A] mb-2">{action === 'revert' ? 'Confirm Revert to Creator' : `Confirm ${action.replace('-', ' ')}`}</h3>
            <p className="text-xs text-[#475569] mb-4">
              {action === 'revert' ? 'This returns the estimate to its creator. The creator must add an Action Taken Report before it can be resubmitted to the DGM.'
                : action === 'generate-fcn' ? 'The FCN number will be generated automatically from the system sequence. The estimate stays with the Director of Administration for Administrative Sanction.'
                : action === 'generate-admin-sanction' ? 'The Administrative Sanction number will be generated automatically from the system sequence and shown here after approval. The estimate is then ready for Technical Sanction assignment.'
                : action === 'assign-ts-authority' ? 'Choose ONE competent technical authority for this estimate. They alone will approve the Technical Sanction.'
                : action === 'return-ts' ? 'Returning will send the estimate back to the Director for re-assignment. Add remarks.'
                : 'Proceed with this action?'}
            </p>
            {action === 'assign-ts-authority' && (
              <>
                <label htmlFor="tsAuthority" className="block mb-1 text-xs font-medium text-[#0F172A]">Technical Sanction Authority *</label>
                <select id="tsAuthority" name="tsAuthority" value={tsAuthority}
                  onChange={e => setTsAuthority(e.target.value)} autoFocus
                  className="ec-input w-full text-sm mb-3">
                  <option value="">Select authority...</option>
                  <option value="DirectorOfAdministration">Director of Administration</option>
                  <option value="GM">GM</option>
                  <option value="DGM">DGM</option>
                </select>
              </>
            )}
            <label htmlFor="remarks" className="sr-only">Remarks</label>
            <textarea id="remarks" name="remarks" value={remarks} onChange={e => setRemarks(e.target.value)}
              className="ec-input w-full text-sm mb-3" rows={2} autoFocus={action !== 'assign-ts-authority'}
              placeholder={`Remarks for ${action} (optional)`} />
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowConfirm(false); setAction(''); setTsAuthority('') }}
                className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleAction(action)} disabled={processing ||
                  (action === 'assign-ts-authority' && !tsAuthority)}
                className="ec-btn-primary flex-1">
                {processing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OTPVerifyModal
        open={showSign}
        icon={ShieldCheck}
        iconClass="text-indigo-600"
        title="Digital Signature"
        submitted={otpSent}
        verified={verified}
        sentTo={otpSentTo ? maskEmail(otpSentTo) : ''}
        digits={otpDigits}
        setDigits={setOtpDigits}
        resendIn={resendIn}
        nonce={otpNonce}
        sending={sendingOtp}
        verifying={signing}
        verifyLabel="Verify OTP"
        verifyingLabel="Forwarding..."
        onResend={sendOtp}
        onClose={() => setShowSign(false)}
        onVerify={verifyAndSign}
        showCertificate
        certificateId={certificateId}
        setCertificateId={setCertificateId}
        successTitle="OTP Verified Successfully"
        successText="Forwarding estimate to the Tender Officer..."
      />

      {/* Submit Estimate: OTP opens automatically */}
      <OTPVerifyModal
        open={showSubmitOtp}
        icon={ShieldCheck}
        iconClass="text-indigo-600"
        title="Verify OTP"
        submitted={submitOtpSent}
        verified={submitVerified}
        sentTo={submitOtpSentTo ? maskEmail(submitOtpSentTo) : ''}
        digits={submitOtpDigits}
        setDigits={setSubmitOtpDigits}
        resendIn={submitResendIn}
        nonce={otpNonce}
        sending={sendingSubmitOtp}
        verifying={submitting}
        verifyLabel="Verify & Submit"
        verifyingLabel="Submitting..."
        onResend={sendSubmitOtp}
        onClose={() => setShowSubmitOtp(false)}
        onVerify={verifySubmitOtp}
        remarkValue={remarks || (estimate.Status === 'Reverted' ? estimate.ActionTakenReport : '')}
        successTitle="OTP Verified Successfully"
        successText={`Submitting estimate to ${DESIGNATION_FULL[wfPos?.nextStage?.owner] || 'next authority'}...`}
      />

      <OTPVerifyModal
        open={showDgmApprove}
        icon={ShieldCheck}
        iconClass="text-purple-600"
        title="Confirm DGM Approval"
        submitted={dgmOtpSent}
        verified={dgmVerified}
        sentTo={dgmOtpSentTo ? maskEmail(dgmOtpSentTo) : ''}
        digits={dgmOtpDigits}
        setDigits={setDgmOtpDigits}
        resendIn={dgmResendIn}
        nonce={otpNonce}
        sending={sendingDgmOtp}
        verifying={approving}
        verifyLabel="Verify & Approve"
        verifyingLabel="Approving..."
        onResend={sendDgmOtp}
        onClose={() => setShowDgmApprove(false)}
        onVerify={verifyDgmApprove}
        buttonClass="bg-purple-600 hover:bg-purple-700"
        remarkValue={remarks}
        successTitle="OTP Verified Successfully"
        successText="Approving estimate and forwarding to GM..."
      />
      <OTPVerifyModal
        open={showCgmSubmit}
        icon={ShieldCheck}
        iconClass="text-violet-600"
        title="Submit to DOP"
        submitted={cgmOtpSent}
        verified={cgmVerified}
        sentTo={cgmOtpSentTo ? maskEmail(cgmOtpSentTo) : ''}
        digits={cgmOtpDigits}
        setDigits={setCgmOtpDigits}
        resendIn={cgmResendIn}
        nonce={otpNonce}
        sending={sendingCgmOtp}
        verifying={submittingCgm}
        verifyLabel="Verify & Submit"
        verifyingLabel="Submitting..."
        onResend={sendCgmOtp}
        onClose={() => setShowCgmSubmit(false)}
        onVerify={verifyCgmSubmit}
        buttonClass="bg-violet-600 hover:bg-violet-700"
        remarkValue={remarks}
        successTitle="OTP Verified Successfully"
        successText="Forwarding estimate to DOP..."
      />

      <OTPVerifyModal
        open={showDopApprove}
        icon={ShieldCheck}
        iconClass="text-purple-600"
        title="Approve & Forward to ED"
        submitted={dopOtpSent}
        verified={dopVerified}
        sentTo={dopOtpSentTo ? maskEmail(dopOtpSentTo) : ''}
        digits={dopOtpDigits}
        setDigits={setDopOtpDigits}
        resendIn={dopResendIn}
        nonce={otpNonce}
        sending={sendingDopOtp}
        verifying={approvingDop}
        verifyLabel="Verify & Approve"
        verifyingLabel="Approving..."
        onResend={sendDopOtp}
        onClose={() => setShowDopApprove(false)}
        onVerify={verifyDopApprove}
        buttonClass="bg-purple-600 hover:bg-purple-700"
        remarkValue={remarks}
        successTitle="OTP Verified Successfully"
        successText="Approving estimate and forwarding to ED..."
      />
      <OTPVerifyModal
        open={showEdApprove}
        icon={ShieldCheck}
        iconClass="text-fuchsia-600"
        title="Approve & Forward to MD"
        submitted={edOtpSent}
        verified={edVerified}
        sentTo={edOtpSentTo ? maskEmail(edOtpSentTo) : ''}
        digits={edOtpDigits}
        setDigits={setEdOtpDigits}
        resendIn={edResendIn}
        nonce={otpNonce}
        sending={sendingEdOtp}
        verifying={approvingEd}
        verifyLabel="Verify & Approve"
        verifyingLabel="Approving..."
        onResend={sendEdOtp}
        onClose={() => setShowEdApprove(false)}
        onVerify={verifyEdApprove}
        buttonClass="bg-fuchsia-600 hover:bg-fuchsia-700"
        remarkValue={remarks}
        successTitle="OTP Verified Successfully"
        successText="Approving estimate and forwarding to MD..."
      />

      <OTPVerifyModal
        open={showMdFinal}
        icon={ShieldCheck}
        iconClass="text-pink-600"
        title="MD Final Approval"
        submitted={mdOtpSent}
        verified={mdVerified}
        sentTo={mdOtpSentTo ? maskEmail(mdOtpSentTo) : ''}
        digits={mdOtpDigits}
        setDigits={setMdOtpDigits}
        resendIn={mdResendIn}
        nonce={otpNonce}
        sending={sendingMdOtp}
        verifying={finalizingMd}
        verifyLabel="Verify & Final Approve"
        verifyingLabel="Finalizing..."
        onResend={sendMdOtp}
        onClose={() => setShowMdFinal(false)}
        onVerify={verifyMdFinal}
        buttonClass="bg-pink-600 hover:bg-pink-700"
        remarkValue={remarks}
        successTitle="Final Approval Complete"
        successText="Tender has been automatically created and the Tender Officer has been notified."
      />
    </div>
  )
}
