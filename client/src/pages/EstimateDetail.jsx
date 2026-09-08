import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Send, RotateCcw, CheckCircle, FileSpreadsheet,
  X, Download, History, FileDown, PenSquare, ClipboardList, FileText,
  Briefcase, Building2, Hammer, DollarSign, Archive, Plus, Users, Loader, ShieldCheck,
  ArrowRight, Info, FileCheck, Landmark, Stamp, Megaphone, Wallet
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import StatusBadge from '../components/shared/StatusBadge'
import OtpInput from '../components/shared/OtpInput'
import ActionPanel from '../components/estimate/ActionPanel'

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
import { getStatusInfo, getNextStage, getStatusLabel, getStatusKeyForStage } from '../utils/workflowMapping'
import { downloadExport } from '../utils/download'

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
  const [procurementNo, setProcurementNo] = useState('')
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
  const [stepKey, setStepKey] = useState(null)
  const [tenders, setTenders] = useState([])
  const [agencies, setAgencies] = useState([])
  const [progressList, setProgressList] = useState([])
  const [bills, setBills] = useState([])
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const hasMaterial = (estimate?.Items || []).some(i => i.Category === 'Material')

  useEffect(() => { load() }, [id])

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
      if (actionType === 'generate-admin-sanction') payload.sanctionNo = procurementNo
      if (actionType === 'assign-ts-authority') {
        payload.AuthorityRole = tsAuthority
        delete payload.remarks
      }
      await api.post(`/workflow/${id}/${actionType}`, payload)
      toast.success(ACTION_SUCCESS[actionType] || 'Action completed')
      setShowConfirm(false)
      setRemarks('')
      setProcurementNo('')
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
    setProcurementNo('')
    setTsAuthority('')
    setShowConfirm(true)
  }

  const sendOtp = async () => {
    setSendingOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/sign/request-otp`)
      setOtpSent(true)
      setOtpSentTo(res.data.sentTo || '')
      setResendIn(res.data.resendIn || 30)
      setOtpDigits(Array(6).fill(''))
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
  }

  const openSignModal = () => {
    setOtpSent(false); setOtpSentTo('')
    setOtpDigits(Array(6).fill('')); setCertificateId(''); setResendIn(0); setVerified(false)
    setShowSign(true)
  }

  const openSubmitOtpModal = () => {
    setSubmitOtpSent(false); setSubmitOtpSentTo('')
    setSubmitOtpDigits(Array(6).fill('')); setSubmitResendIn(0); setSubmitVerified(false)
    setShowSubmitOtp(true)
  }

  const sendSubmitOtp = async () => {
    setSendingSubmitOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/submit/request-otp`)
      setSubmitOtpSent(true)
      setSubmitOtpSentTo(res.data.sentTo || '')
      setSubmitResendIn(res.data.resendIn || 30)
      setSubmitOtpDigits(Array(6).fill(''))
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
    setSubmitting(true)
    try {
      const payload = {
        otpCode: submitOtpDigits.join(''),
        remarks: remarks || undefined,
      }
      const res = await api.post(`/workflow/${id}/submit`, payload)
      setSubmitVerified(true)
      toast.success(res.data.message || 'Estimate forwarded to DGM')
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
  }

  const openDgmApproveModal = () => {
    setDgmOtpSent(false); setDgmOtpSentTo('')
    setDgmOtpDigits(Array(6).fill('')); setDgmResendIn(0); setDgmVerified(false)
    setShowDgmApprove(true)
  }

  const sendDgmOtp = async () => {
    setSendingDgmOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/approve/request-otp`)
      setDgmOtpSent(true)
      setDgmOtpSentTo(res.data.sentTo || '')
      setDgmResendIn(res.data.resendIn || 30)
      setDgmOtpDigits(Array(6).fill(''))
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
  }

  const openCgmSubmitModal = () => {
    setCgmOtpSent(false); setCgmOtpSentTo('')
    setCgmOtpDigits(Array(6).fill('')); setCgmResendIn(0); setCgmVerified(false)
    setShowCgmSubmit(true)
  }

  const sendCgmOtp = async () => {
    setSendingCgmOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/cgm-submit/request-otp`)
      setCgmOtpSent(true); setCgmOtpSentTo(res.data.sentTo || '')
      setCgmResendIn(res.data.resendIn || 30); setCgmOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setCgmResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingCgmOtp(false)
  }

  const verifyCgmSubmit = async () => {
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
  }

  const openDopApproveModal = () => {
    setDopOtpSent(false); setDopOtpSentTo('')
    setDopOtpDigits(Array(6).fill('')); setDopResendIn(0); setDopVerified(false)
    setShowDopApprove(true)
  }

  const sendDopOtp = async () => {
    setSendingDopOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/dop-approve/request-otp`)
      setDopOtpSent(true); setDopOtpSentTo(res.data.sentTo || '')
      setDopResendIn(res.data.resendIn || 30); setDopOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setDopResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingDopOtp(false)
  }

  const verifyDopApprove = async () => {
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
  }

  const openEdApproveModal = () => {
    setEdOtpSent(false); setEdOtpSentTo('')
    setEdOtpDigits(Array(6).fill('')); setEdResendIn(0); setEdVerified(false)
    setShowEdApprove(true)
  }

  const sendEdOtp = async () => {
    setSendingEdOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/ed-approve/request-otp`)
      setEdOtpSent(true); setEdOtpSentTo(res.data.sentTo || '')
      setEdResendIn(res.data.resendIn || 30); setEdOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setEdResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingEdOtp(false)
  }

  const verifyEdApprove = async () => {
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
  }

  const openMdFinalModal = () => {
    setMdOtpSent(false); setMdOtpSentTo('')
    setMdOtpDigits(Array(6).fill('')); setMdResendIn(0); setMdVerified(false)
    setShowMdFinal(true)
  }

  const sendMdOtp = async () => {
    setSendingMdOtp(true)
    try {
      const res = await api.post(`/workflow/${id}/md-final/request-otp`)
      setMdOtpSent(true); setMdOtpSentTo(res.data.sentTo || '')
      setMdResendIn(res.data.resendIn || 30); setMdOtpDigits(Array(6).fill(''))
      toast.success(res.data.message || 'OTP sent')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.resendIn) {
        setMdResendIn(err.response.data.resendIn); toast.error(err.response.data.error || 'Please wait')
      } else { toast.error(err.response?.data?.error || 'Failed to send OTP') }
    }
    setSendingMdOtp(false)
  }

  const verifyMdFinal = async () => {
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
    DOP: 'Deputy operations Officer',
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
          <Info className="w-6 h-6 text-[#64748B]" />
        </div>
        <p className="text-sm font-medium text-[#0F172A]">{msg}</p>
        <button type="button" onClick={load} className="mt-4 px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#1E3A5F] text-white hover:bg-[#16304F] transition-colors">
          Retry
        </button>
      </div>
    )
  }

  const isOwner = estimate.CurrentOwner === user.UserID
  const role = user.Designation
  const estSla = slaTone(estimate.SlaDueAt)

  const canEdit = isOwner && ['Draft', 'Reverted'].includes(estimate.Status) && role === 'Manager'
  const canSubmit = isOwner && ['Draft', 'Reverted'].includes(estimate.Status) && role === 'Manager'
  const canRevert = isOwner && ['Submitted', 'DGM_Approved', 'GM_Recommended', 'CGM_Submitted',
    'DOP_Approved', 'ED_Approved',
    'Signed', 'TenderPublished', 'AgencySelected', 'WorkStarted', 'WorkCompleted', 'Billing'].includes(estimate.Status)
  const canApprove = isOwner && role === 'DGM' && estimate.Status === 'Submitted'
  const canSign = isOwner && role === 'GM' && estimate.Status === 'DGM_Approved'
  const canCgmSubmit = isOwner && role === 'CGM' && estimate.Status === 'GM_Recommended'
  const canDopApprove = isOwner && role === 'DOP' && estimate.Status === 'CGM_Submitted'
  const canEdApprove = isOwner && role === 'ED' && estimate.Status === 'DOP_Approved'
  const canMdFinal = isOwner && role === 'MD' && estimate.Status === 'ED_Approved'
  const canGenerateFcn = isOwner && estimate.Status === 'FinalApproved' && role === 'DirectorOfAdministration'
  const canGenerateSanction = isOwner && estimate.Status === 'FCNGenerated' && role === 'DirectorOfAdministration'
  const canAssignTs = isOwner && estimate.Status === 'AdminSanctionGenerated' && role === 'DirectorOfAdministration'
  const canApproveTs = isOwner && estimate.Status === 'TSPending' && (role === 'DirectorOfAdministration' || role === 'GM' || role === 'DGM')
  const canReturnTs = isOwner && estimate.Status === 'TSPending' && (role === 'DirectorOfAdministration' || role === 'GM' || role === 'DGM')
  const canPublishTender = isOwner && estimate.Status === 'TSApproved' && role === 'TenderOfficer'
  const canSelectAgency = isOwner && estimate.Status === 'TenderPublished' && role === 'DirectorOfAdministration'
  const canStartWork = isOwner && estimate.Status === 'AgencySelected' && role === 'SiteEngineer'
  const canCompleteWork = isOwner && estimate.Status === 'WorkStarted' && role === 'SiteEngineer'
  const canSubmitBill = isOwner && estimate.Status === 'WorkCompleted' && role === 'BillingOfficer'
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
    { key: 'submit', label: 'Submit to DGM', icon: Send, tone: 'primary', show: canSubmit, onClick: openSubmitOtpModal },
    { key: 'approve', label: 'Forward to GM', icon: CheckCircle, tone: 'primary', show: canApprove, onClick: openDgmApproveModal },
    { key: 'sign', label: 'Recommend to CGM', icon: PenSquare, tone: 'primary', show: canSign, onClick: openSignModal },
    { key: 'cgm', label: 'Forward to DOP', icon: Send, tone: 'primary', show: canCgmSubmit, onClick: openCgmSubmitModal },
    { key: 'dop', label: 'Approve & Forward to ED', icon: CheckCircle, tone: 'primary', show: canDopApprove, onClick: openDopApproveModal },
    { key: 'ed', label: 'Approve & Forward to MD', icon: CheckCircle, tone: 'primary', show: canEdApprove, onClick: openEdApproveModal },
    { key: 'md', label: 'Final Approve', icon: PenSquare, tone: 'primary', show: canMdFinal, onClick: openMdFinalModal },
    { key: 'fcn', label: 'Generate FCN', icon: FileCheck, tone: 'primary', show: canGenerateFcn, onClick: () => confirmAction('generate-fcn') },
    { key: 'sanction', label: 'Generate Admin Sanction', icon: Landmark, tone: 'primary', show: canGenerateSanction, onClick: () => confirmAction('generate-admin-sanction') },
    { key: 'assign-ts', label: 'Assign TS Authority', icon: ClipboardList, tone: 'primary', show: canAssignTs, onClick: () => confirmAction('assign-ts-authority') },
    { key: 'approve-ts', label: 'Forward for TS', icon: Stamp, tone: 'primary', show: canApproveTs, onClick: () => confirmAction('approve-ts') },
    { key: 'return-ts', label: 'Return TS', icon: RotateCcw, tone: 'danger', show: canReturnTs, onClick: () => confirmAction('return-ts') },
    { key: 'publish', label: 'Create Tender', icon: Megaphone, tone: 'primary', show: canPublishTender, onClick: () => confirmAction('publish-tender') },
    { key: 'agency', label: 'Finalize Agency', icon: Building2, tone: 'primary', show: canSelectAgency, onClick: () => confirmAction('select-agency') },
    { key: 'start-work', label: 'Start Work', icon: Hammer, tone: 'primary', show: canStartWork, onClick: () => confirmAction('start-work') },
    { key: 'complete-work', label: 'Complete Work', icon: CheckCircle, tone: 'primary', show: canCompleteWork, onClick: () => confirmAction('complete-work') },
    { key: 'submit-bill', label: 'Prepare Bill', icon: Wallet, tone: 'primary', show: canSubmitBill, onClick: () => confirmAction('submit-bill') },
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
        <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#64748B] hover:bg-[#F1F5F9] mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="ec-page-title">{estimate.EstimateNo}</h1>
            <StatusBadge status={estimate.Status} />
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#64748B] bg-[#F1F5F9]">v{estimate.Version}</span>
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-[#F1F5F9] rounded-lg hover:bg-[#E2E8F0] transition-colors">
            <History className="w-3.5 h-3.5" />
            Audit Trail
          </button>
        </div>
      </div>

      {/* Workflow History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-[#0F172A]">Audit Trail</h3>
              <button onClick={() => setShowHistory(false)} className="p-1 rounded hover:bg-[#F1F5F9]">
                <X className="w-4 h-4 text-[#64748B]" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
              {[...workflow].sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime) || (b.WorkflowID || 0) - (a.WorkflowID || 0)).map((w, i) => (
                <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#E2E8F0] last:border-l-0 last:pb-0">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#1E3A5F]" />
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                    {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})
                  </p>
                  {w.Remarks && <p className="text-[10px] text-[#64748B] mt-0.5">{w.Remarks}</p>}
                  <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
            {estimate.IsDigitallySigned && (estimate.CertificateID || estimate.SignatureHash) && (
              <>
                <div className="border-t border-[#E2E8F0] px-5 py-3">
                  <h4 className="font-semibold text-[#0F172A] text-sm">Digital Signature (Technical)</h4>
                </div>
                <div className="px-5 pb-5 space-y-1.5">
                  {estimate.CertificateID && (
                    <p className="text-xs text-[#475569]">
                      <span className="font-medium text-[#1E3A5F]">Certificate ID:</span> {estimate.CertificateID}
                    </p>
                  )}
                  {estimate.SignatureHash && (
                    <p className="text-[10px] text-[#475569] break-all font-mono">
                      <span className="font-medium text-[#1E3A5F]">Signature Hash:</span> {estimate.SignatureHash}
                    </p>
                  )}
                </div>
              </>
            )}
            {versions.length > 0 && (
              <>
                <div className="border-t border-[#E2E8F0] px-5 py-3">
                  <h4 className="font-semibold text-[#0F172A] text-sm">Versions</h4>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {versions.map((v, i) => (
                    <div key={v.VersionID || i} className="text-xs">
                      <div className="text-[#64748B]">
                        <span className="font-semibold text-[#0F172A]">v{v.VersionNumber}</span> — {v.CreatedByName} · {new Date(v.CreatedDate).toLocaleString('en-IN')}
                        {v.Remarks && <span className="text-[#94A3B8]">: {v.Remarks}</span>}
                      </div>
                      {Array.isArray(v.Changes) && v.Changes.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-3 border-l-2 border-[#E2E8F0]">
                          {v.Changes.map((c, ci) => (
                            <li key={ci} className="text-[10px] text-[#475569]">
                              <span className="font-medium text-[#1E3A5F]">{c.field}:</span>{' '}
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
            <FileText className="w-4 h-4 text-[#1E3A5F]" />
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
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-2">
                  <span className="text-[#64748B]">{k}</span>
                  <span className="font-medium text-[#0F172A] text-right">{v || '—'}</span>
                </div>
              ))}
              {[estimate.RegionName, estimate.ZoneName, estimate.DivisionName, estimate.CircleName, estimate.WardName].some(Boolean) && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#64748B]">Location</span>
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
            <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" />
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
                      <span className="text-[#64748B]">{k}</span>
                      <span className="font-medium text-[#0F172A]">{fmt(v)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="font-bold text-[#0F172A]">Total Estimate Value</span>
                    <span className="font-bold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                  {a.GrandTotalInWords && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#64748B]">Amount in Words</span>
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
            <Users className="w-4 h-4 text-[#1E3A5F]" />
            <span className="ec-card-title">Current Status</span>
          </div>
          <div className="ec-card-body">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Current Status</span>
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={estimate.Status} />
                  <span className="font-medium text-[#0F172A]">{getStatusLabel(estimate.Status)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Current Owner</span>
                <span className="font-medium text-[#0F172A] text-right">
                  {currentOwnerLabel}
                  {isCurrentUserOwner && <span className="text-[#94A3B8]"> (You)</span>}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Next Stage</span>
                <span className="font-medium text-[#0EA5E9] text-right">{getNextStage(estimate.Status)?.stageLabel || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Next Role</span>
                <span className="font-medium text-[#0F172A] text-right">{STATUS_INFO[estimate.Status]?.role || getNextStage(estimate.Status)?.owner || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">SLA</span>
                <span className={`font-medium text-right ${estSla.tone === 'danger' ? 'text-red-600' : estSla.tone === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>
                  {estSla.label !== '—' ? estSla.label : '—'}
                </span>
              </div>
              {slaDetail && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">Time Remaining</span>
                  <span className={`font-medium text-right ${slaDetail.tone === 'danger' ? 'text-red-600' : slaDetail.tone === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>
                    {slaDetail.text}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Last Updated</span>
                <span className="font-medium text-[#0F172A] text-right">{fmtDateTime(estimate.LastModifiedDate)}</span>
              </div>
              {(estimate.ActionTakenReport || estimate.ReturnRemarks) && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#64748B]">Remarks</span>
                  <span className="font-medium text-[#0F172A] text-right">{estimate.ActionTakenReport || estimate.ReturnRemarks}</span>
                </div>
              )}
              {estimate.Agency && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#64748B]">Agency</span>
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
          <div className="flex gap-0.5 border-b border-[#E2E8F0] mb-5 overflow-x-auto" role="tablist">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeShown.key === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${activeShown.key === t.key ? 'text-[#1E3A5F] border-[#1E3A5F]' : 'text-[#64748B] border-transparent hover:text-[#334155]'}`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {activeShown.key === 'civil' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <ClipboardList className="w-4 h-4 text-[#1E3A5F]" />
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
                <ClipboardList className="w-4 h-4 text-[#1E3A5F]" />
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
                <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" />
                <span className="ec-card-title">Abstract of Estimate</span>
              </div>
              <div className="ec-card-body">
                <div className="max-w-md mx-auto space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Civil Work Total</span>
                    <span className="font-medium">{fmt(a.CivilTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Material Total</span>
                    <span className="font-medium">{fmt(a.MaterialTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Cost of Estimate (Part-I)</span>
                    <span className="font-medium">{fmt(a.CostOfEstimate)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">GST @ {estimate.GSTPercent}% (Part-II)</span>
                    <span className="font-medium">{fmt(a.GST)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Additional Items (Part-II)</span>
                    <span className="font-medium">{fmt(a.AdditionalItemsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">LS Provision (Part-III)</span>
                    <span className="font-medium">{fmt(a.LSProvision)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-bold text-[#0F172A]">Grand Total</span>
                    <span className="font-bold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                  {a.GrandTotalInWords && (
                    <div className="flex justify-between py-1.5 border-t border-[#E2E8F0]">
                      <span className="text-[#64748B]">Amount in Words</span>
                      <span className="font-medium text-right max-w-[60%]">{a.GrandTotalInWords}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#E2E8F0]">
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
                <Download className="w-4 h-4 text-[#1E3A5F]" />
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
                {estimate.IsDigitallySigned && (estimate.CertificateID || estimate.SignatureHash) && (
                  <div className="pt-3 border-t border-[#E2E8F0] space-y-1.5">
                    {estimate.CertificateID && (
                      <p className="text-xs text-[#475569]">
                        <span className="font-medium text-[#1E3A5F]">Certificate ID:</span> {estimate.CertificateID}
                      </p>
                    )}
                    {estimate.SignatureHash && (
                      <p className="text-[10px] text-[#475569] break-all font-mono">
                        <span className="font-medium text-[#1E3A5F]">Signature Hash:</span> {estimate.SignatureHash}
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
                <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
                <span className="ec-card-title">Approval Information</span>
              </div>
              <div className="ec-card-body">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  {[
                    ['Created By', estimate.CreatedByName || user.Name],
                    ['Created Date', fmtDate(estimate.CreatedDate)],
                    ['Current Status', getStatusLabel(estimate.Status)],
                    ['Submitted Date', fmtDate(estimate.SubmissionDate)],
                    ['Signed Date', estimate.IsDigitallySigned ? fmtDateTime(estimate.DigitallySignedDate) : 'Not signed'],
                    ['Certificate ID', estimate.CertificateID || '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] font-medium text-[#64748B]">{k}</p>
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
                <History className="w-4 h-4 text-[#1E3A5F]" />
                <span className="ec-card-title">Workflow History</span>
              </div>
              <div className="ec-card-body max-h-[480px] overflow-y-auto">
                {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
                {[...workflow].sort((x, y) => new Date(y.DateTime) - new Date(x.DateTime)).map((w, i) => (
                  <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#E2E8F0] last:border-l-0 last:pb-0">
                    <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#1E3A5F]" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                      {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                    </p>
                    <p className="text-[10px] text-[#64748B]">{w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})</p>
                    {w.Remarks && <p className="text-[10px] text-[#64748B] mt-0.5">{w.Remarks}</p>}
                    <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeShown.key === 'audit' && (
            <div className="ec-card">
              <div className="ec-card-header">
                <History className="w-4 h-4 text-[#1E3A5F]" />
                <span className="ec-card-title">Audit Trail</span>
              </div>
              <div className="ec-card-body max-h-[480px] overflow-y-auto">
                {workflow.length === 0 && <p className="text-sm text-[#94A3B8]">No workflow history</p>}
                {[...workflow].sort((x, y) => new Date(y.DateTime) - new Date(x.DateTime)).map((w, i) => (
                  <div key={w.WorkflowID || i} className="relative pl-6 pb-3 border-l-2 border-[#E2E8F0] last:border-l-0 last:pb-0">
                    <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#1E3A5F]" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {({ Submit: 'Forwarded to DGM', Approve: 'Verified by DGM', DigitallySign: 'Recommended by GM', SubmitForApproval: 'Forwarded to DOP', ApproveAtDOP: 'Approved by DOP', ApproveAtED: 'Approved by ED', FinalApprove: 'Final Approved by MD', PublishTender: 'Tender Published', SelectAgency: 'Agency Selected', StartWork: 'Work Started', CompleteWork: 'Work Completed', SubmitBill: 'Bill Submitted', Archive: 'Archived & Closed', Revert: 'Reverted to Creator' })[w.Action] || w.Action}
                      {w.OTPVerified && <span className="ml-1.5 text-[9px] font-medium text-emerald-600">· OTP ✓</span>}
                    </p>
                    <p className="text-[10px] text-[#64748B]">{w.FromUserName} ({w.FromDesignation}) → {w.ToUserName} ({w.ToDesignation})</p>
                    {w.Remarks && <p className="text-[10px] text-[#64748B] mt-0.5">{w.Remarks}</p>}
                    <p className="text-[9px] text-[#94A3B8] mt-0.5">{new Date(w.DateTime).toLocaleString('en-IN')}</p>
                  </div>
                ))}
                {versions.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E2E8F0] space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A5F]">Versions</p>
                    {versions.map((v, i) => (
                      <div key={v.VersionID || i} className="text-xs">
                        <div className="text-[#64748B]">
                          <span className="font-semibold text-[#0F172A]">v{v.VersionNumber}</span> — {v.CreatedByName} · {new Date(v.CreatedDate).toLocaleString('en-IN')}
                          {v.Remarks && <span className="text-[#94A3B8]">: {v.Remarks}</span>}
                        </div>
                        {Array.isArray(v.Changes) && v.Changes.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 pl-3 border-l-2 border-[#E2E8F0]">
                            {v.Changes.map((c, ci) => (
                              <li key={ci} className="text-[10px] text-[#475569]">
                                <span className="font-medium text-[#1E3A5F]">{c.field}:</span>{' '}
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
                <Briefcase className="w-4 h-4 text-[#1E3A5F]" />
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
              <div className="sticky top-0 bg-[#1E3A5F] px-5 py-4 flex items-center justify-between">
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
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-semibold text-[#1E3A5F]">
                    <Info className="w-3.5 h-3.5" /> Current Stage — {STATUS_INFO[stepKey]?.waiting}
                  </div>
                )}

                {stepKey === 'Draft' && (
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Estimate Creation</p>
                    <div className="p-3 space-y-1.5 text-xs">
                      <p><span className="text-[#64748B]">Created by:</span> <span className="font-medium text-[#0F172A]">{estimate.CreatedByName || user.Name}</span></p>
                      <p><span className="text-[#64748B]">Created on:</span> <span className="font-medium text-[#0F172A]">{fmtDateTime(estimate.CreatedDate)}</span></p>
                      <p><span className="text-[#64748B]">Estimate no:</span> <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span></p>
                    </div>
                  </div>
                )}

                {entry && (
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Approval Details</p>
                    <div className="p-3 space-y-1.5 text-xs">
                      <p><span className="text-[#64748B]">Performed by:</span> <span className="font-medium text-[#0F172A]">{entry.FromUserName} ({entry.FromDesignation})</span></p>
                      <p><span className="text-[#64748B]">Forwarded to:</span> <span className="font-medium text-[#0F172A]">{entry.ToUserName} ({entry.ToDesignation})</span></p>
                      <p><span className="text-[#64748B]">Date & time:</span> <span className="font-medium text-[#0F172A]">{fmtDateTime(entry.DateTime)}</span></p>
                      {entry.Version != null && <p><span className="text-[#64748B]">Version:</span> <span className="font-medium text-[#0F172A]">v{entry.Version}</span></p>}
                      {entry.OTPVerified && <p><span className="text-[#64748B]">OTP verification:</span> <span className="font-medium text-emerald-700">Verified</span></p>}
                      {entry.Remarks && <p><span className="text-[#64748B]">Remarks:</span> <span className="font-medium text-[#0F172A]">{entry.Remarks}</span></p>}
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
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Tender</p>
                    <div className="p-3 space-y-2">
                      {tenders.map(t => (
                        <div key={t.TenderID} className="rounded border border-[#E2E8F0] p-2.5 space-y-1 text-xs">
                          <p className="font-semibold text-[#0F172A]">{t.TenderNo || `Tender #${t.TenderID}`}</p>
                          <p><span className="text-[#64748B]">Tender date:</span> {fmtDate(t.TenderDate)}</p>
                          {t.EstimatedCost != null && <p><span className="text-[#64748B]">Estimated cost:</span> {fmt(t.EstimatedCost)}</p>}
                          <p><span className="text-[#64748B]">Status:</span> <span className="font-medium">{t.Status}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stepKey === 'AgencySelected' && agencies.length > 0 && (
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Agency</p>
                    <div className="p-3 space-y-2">
                      {agencies.map(a => (
                        <div key={a.AgencyID} className="rounded border border-[#E2E8F0] p-2.5 space-y-1 text-xs">
                          <p className="font-semibold text-[#0F172A]">{a.AgencyName}</p>
                          {a.AgencyCode && <p><span className="text-[#64748B]">Code:</span> {a.AgencyCode}</p>}
                          {tenders[0]?.WorkOrderNo && <p><span className="text-[#64748B]">Work order:</span> {tenders[0].WorkOrderNo}</p>}
                          {tenders[0]?.AgreementNo && <p><span className="text-[#64748B]">Agreement:</span> {tenders[0].AgreementNo}</p>}
                          {a.ContractorName && <p><span className="text-[#64748B]">Contractor:</span> {a.ContractorName}</p>}
                          {a.TenderValue != null && <p><span className="text-[#64748B]">Tender value:</span> {fmt(a.TenderValue)}</p>}
                          {a.AgreementDate && <p><span className="text-[#64748B]">Award date:</span> {fmtDate(a.AgreementDate)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['WorkStarted', 'WorkCompleted'].includes(stepKey) && (estimate.StartedDate || progressList.length > 0) && (
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Work Progress</p>
                    <div className="p-3 space-y-2">
                      {estimate.StartedDate && (
                        <div className="rounded border border-[#E2E8F0] p-2.5 text-xs">
                          <p><span className="text-[#64748B]">Work started on:</span> <span className="font-medium">{fmtDateTime(estimate.StartedDate)}</span></p>
                          {estimate.StartedByName && <p><span className="text-[#64748B]">Started by:</span> <span className="font-medium">{estimate.StartedByName}</span></p>}
                        </div>
                      )}
                      {progressList.map(p => (
                        <div key={p.ProgressID} className="rounded border border-[#E2E8F0] p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-[#0F172A]">{p.Stage || `Progress ${p.ProgressID}`}</p>
                            {p.Percentage != null && (
                              <span className="px-1.5 py-0.5 rounded bg-[#1E3A5F]/10 text-[#1E3A5F] font-semibold text-[10px]">{p.Percentage}%</span>
                            )}
                          </div>
                          {p.Date && <p><span className="text-[#64748B]">Date:</span> {fmtDate(p.Date)}</p>}
                          {p.Remarks && <p className="text-[#475569]">{p.Remarks}</p>}
                          {p.InspectionNotes && <p><span className="text-[#64748B]">Inspection:</span> {p.InspectionNotes}</p>}
                          {p.DelayReason && <p><span className="text-[#64748B]">Delay reason:</span> {p.DelayReason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stepKey === 'Billing' && bills.length > 0 && (
                  <div className="rounded-lg border border-[#E2E8F0]">
                    <p className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] border-b border-[#E2E8F0] bg-[#F8FAFC]">Bills</p>
                    <div className="p-3 space-y-2">
                      {bills.map(b => (
                        <div key={b.BillID} className="rounded border border-[#E2E8F0] p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-[#0F172A]">{b.BillNo || `Bill #${b.BillID}`}</p>
                            <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] font-medium">{b.Status}</span>
                          </div>
                          {b.BillDate && <p><span className="text-[#64748B]">Bill date:</span> {fmtDate(b.BillDate)}</p>}
                          {b.NetAmount != null && <p><span className="text-[#64748B]">Net amount:</span> {fmt(b.NetAmount)}</p>}
                          {b.ApprovedAmount != null && b.ApprovedAmount != 0 && <p><span className="text-[#64748B]">Approved amount:</span> {fmt(b.ApprovedAmount)}</p>}
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
            <h3 className="font-semibold text-[#0F172A] mb-2">Confirm {action.replace('-', ' ')}</h3>
            <p className="text-xs text-[#64748B] mb-4">
              {action === 'generate-fcn' ? 'The FCN number will be generated automatically from the system sequence. The estimate stays with the Director of Administration for Administrative Sanction.'
                : action === 'generate-admin-sanction' ? 'Enter the Administrative Sanction number. The estimate is then ready for Technical Sanction assignment.'
                : action === 'assign-ts-authority' ? 'Choose ONE competent technical authority for this estimate. They alone will approve the Technical Sanction.'
                : action === 'return-ts' ? 'Returning will send the estimate back to the Director for re-assignment. Add remarks.'
                : 'Proceed with this action?'}
            </p>
            {action === 'generate-admin-sanction' && (
              <label htmlFor="procurementNo" className="block mb-1 text-xs font-medium text-[#0F172A]">
                Sanction No. *
              </label>
            )}
            {action === 'generate-admin-sanction' && (
              <input id="procurementNo" name="procurementNo" value={procurementNo}
                onChange={e => setProcurementNo(e.target.value)} autoFocus
                placeholder="e.g. AS/2026-27/001"
                className="ec-input w-full text-sm mb-3" />
            )}
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
              className="ec-input w-full text-sm mb-3" rows={2}
              placeholder={`Remarks for ${action} (optional)`} />
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowConfirm(false); setAction(''); setProcurementNo(''); setTsAuthority('') }}
                className="ec-btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleAction(action)} disabled={processing ||
                  (action === 'generate-admin-sanction' && !procurementNo.trim()) ||
                  (action === 'assign-ts-authority' && !tsAuthority)}
                className="ec-btn-primary flex-1">
                {processing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Signature + OTP Modal */}
      {showSign && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowSign(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-[#0F172A]">Digital Signature</h3>
            </div>

            {!otpSent && !verified ? (
              <>
                <p className="text-xs text-[#64748B] mb-4">
                  This is the final authorization step. Apply your digital signature and an OTP will be
                  sent to your registered email to complete verification.
                </p>
                <button type="button" onClick={sendOtp} disabled={sendingOtp}
                  className="ec-btn-primary w-full justify-center">
                  {sendingOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <PenSquare className="w-3.5 h-3.5" />}
                  {sendingOtp ? 'Signing...' : 'Digital Sign'}
                </button>
              </>
            ) : verified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Forwarding estimate to the Tender Officer...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">Digital Signature Completed</p>
                <p className="text-xs text-[#64748B] mb-1">
                  An OTP has been sent to {otpSentTo ? (
                    <span className="font-medium text-[#0F172A]">{maskEmail(otpSentTo)}</span>
                  ) : 'your email'}.
                </p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>

                <label htmlFor="certificateId" className="ec-label">Certificate ID</label>
                <input id="certificateId" type="text" value={certificateId}
                  onChange={e => setCertificateId(e.target.value)}
                  placeholder={`HMWSSB-DSC-${String(id).padStart(6, '0')}`} className="ec-input mb-3" />

                <p className="ec-label">Enter OTP</p>
                <div className="mb-3">
                  <OtpInput value={otpDigits} onChange={setOtpDigits} />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendOtp} disabled={sendingOtp || resendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingOtp ? 'Sending...' : resendIn > 0 ? `Resend OTP (${resendIn}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSign(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyAndSign} disabled={signing || otpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1">
                    {signing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {signing ? 'Forwarding...' : 'Verify OTP'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Submit Estimate OTP Modal */}
      {showSubmitOtp && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowSubmitOtp(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-[#0F172A]">Confirm Submission</h3>
            </div>

            {!submitOtpSent && !submitVerified ? (
              <>
                <p className="text-xs text-[#64748B] mb-4">
                  An OTP will be sent to your registered email to verify this submission.
                  The estimate will be forwarded to the DGM for review.
                </p>
                <label htmlFor="submitRemarks" className="ec-label">Remarks</label>
                <textarea id="submitRemarks" name="remarks" value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2}
                  placeholder="Remarks for submission (optional)" />
                <button type="button" onClick={sendSubmitOtp} disabled={sendingSubmitOtp}
                  className="ec-btn-primary w-full justify-center">
                  {sendingSubmitOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingSubmitOtp ? 'Sending OTP...' : 'Send OTP to Submit'}
                </button>
              </>
            ) : submitVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Submitting estimate to DGM...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">
                  An OTP has been sent to {submitOtpSentTo ? (
                    <span className="font-medium text-[#0F172A]">{maskEmail(submitOtpSentTo)}</span>
                  ) : 'your email'}.
                </p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>

                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}

                <label className="ec-label">Enter OTP</label>
                <div className="mb-3">
                  <OtpInput value={submitOtpDigits} onChange={setSubmitOtpDigits} />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendSubmitOtp} disabled={sendingSubmitOtp || submitResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingSubmitOtp ? 'Sending...' : submitResendIn > 0 ? `Resend OTP (${submitResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSubmitOtp(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifySubmitOtp} disabled={submitting || submitOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1">
                    {submitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {submitting ? 'Submitting...' : 'Verify & Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DGM Approve OTP Modal */}
      {showDgmApprove && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowDgmApprove(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-[#0F172A]">Confirm DGM Approval</h3>
            </div>

            {!dgmOtpSent && !dgmVerified ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Estimate</span>
                    <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Work</span>
                    <span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{estimate.NameOfWork}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Version</span>
                    <span className="font-medium text-[#0F172A]">v{estimate.Version}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Grand Total</span>
                    <span className="font-semibold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">
                  You are approving this estimate and recommending it to the General Manager.
                  An OTP will be sent to your registered email for verification.
                </p>
                <label htmlFor="dgmApproveRemarks" className="ec-label">Remarks (optional)</label>
                <textarea id="dgmApproveRemarks" name="remarks" value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2}
                  placeholder="Remarks for approval (optional)" />
                <button type="button" onClick={sendDgmOtp} disabled={sendingDgmOtp}
                  className="ec-btn-primary w-full justify-center bg-purple-600 hover:bg-purple-700">
                  {sendingDgmOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingDgmOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : dgmVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Approving estimate and forwarding to GM...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">
                  Enter the 6-digit OTP sent to {dgmOtpSentTo ? (
                    <span className="font-medium text-[#0F172A]">{maskEmail(dgmOtpSentTo)}</span>
                  ) : 'your registered email'}.
                </p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>

                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}

                <label className="ec-label">Enter OTP</label>
                <div className="mb-3">
                  <OtpInput value={dgmOtpDigits} onChange={setDgmOtpDigits} />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendDgmOtp} disabled={sendingDgmOtp || dgmResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingDgmOtp ? 'Sending...' : dgmResendIn > 0 ? `Resend OTP (${dgmResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowDgmApprove(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyDgmApprove} disabled={approving || dgmOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-purple-600 hover:bg-purple-700">
                    {approving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {approving ? 'Approving...' : 'Verify & Approve'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* CGM Submit OTP Modal */}
      {showCgmSubmit && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowCgmSubmit(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-[#0F172A]">Submit to DOP</h3>
            </div>
            {!cgmOtpSent && !cgmVerified ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Estimate</span>
                    <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Work</span>
                    <span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{estimate.NameOfWork}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Grand Total</span>
                    <span className="font-semibold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">You are submitting this estimate for DOP approval. An OTP will be sent to your registered email.</p>
                <label htmlFor="cgmRemarks" className="ec-label">Remarks (optional)</label>
                <textarea id="cgmRemarks" name="remarks" value={remarks} onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2} placeholder="Remarks for submission" />
                <button type="button" onClick={sendCgmOtp} disabled={sendingCgmOtp}
                  className="ec-btn-primary w-full justify-center bg-violet-600 hover:bg-violet-700">
                  {sendingCgmOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingCgmOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : cgmVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Forwarding estimate to DOP...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">Enter the 6-digit OTP sent to {cgmOtpSentTo ? <span className="font-medium text-[#0F172A]">{maskEmail(cgmOtpSentTo)}</span> : 'your email'}.</p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>
                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}
                <label className="ec-label">Enter OTP</label>
                <div className="mb-3"><OtpInput value={cgmOtpDigits} onChange={setCgmOtpDigits} /></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendCgmOtp} disabled={sendingCgmOtp || cgmResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingCgmOtp ? 'Sending...' : cgmResendIn > 0 ? `Resend OTP (${cgmResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCgmSubmit(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyCgmSubmit} disabled={submittingCgm || cgmOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-violet-600 hover:bg-violet-700">
                    {submittingCgm ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {submittingCgm ? 'Submitting...' : 'Verify & Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DOP Approve OTP Modal */}
      {showDopApprove && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowDopApprove(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-[#0F172A]">Approve & Forward to ED</h3>
            </div>
            {!dopOtpSent && !dopVerified ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Estimate</span>
                    <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Work</span>
                    <span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{estimate.NameOfWork}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Grand Total</span>
                    <span className="font-semibold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">You are approving this estimate and forwarding it to the ED. An OTP will be sent to your registered email.</p>
                <label htmlFor="dopRemarks" className="ec-label">Remarks (optional)</label>
                <textarea id="dopRemarks" name="remarks" value={remarks} onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2} placeholder="Remarks for approval" />
                <button type="button" onClick={sendDopOtp} disabled={sendingDopOtp}
                  className="ec-btn-primary w-full justify-center bg-purple-600 hover:bg-purple-700">
                  {sendingDopOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingDopOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : dopVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Approving estimate and forwarding to ED...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">Enter the 6-digit OTP sent to {dopOtpSentTo ? <span className="font-medium text-[#0F172A]">{maskEmail(dopOtpSentTo)}</span> : 'your email'}.</p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>
                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}
                <label className="ec-label">Enter OTP</label>
                <div className="mb-3"><OtpInput value={dopOtpDigits} onChange={setDopOtpDigits} /></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendDopOtp} disabled={sendingDopOtp || dopResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingDopOtp ? 'Sending...' : dopResendIn > 0 ? `Resend OTP (${dopResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowDopApprove(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyDopApprove} disabled={approvingDop || dopOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-purple-600 hover:bg-purple-700">
                    {approvingDop ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {approvingDop ? 'Approving...' : 'Verify & Approve'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ED Approve OTP Modal */}
      {showEdApprove && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowEdApprove(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-fuchsia-600" />
              <h3 className="font-semibold text-[#0F172A]">Approve & Forward to MD</h3>
            </div>
            {!edOtpSent && !edVerified ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Estimate</span>
                    <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Work</span>
                    <span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{estimate.NameOfWork}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Grand Total</span>
                    <span className="font-semibold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">You are approving this estimate and forwarding it to the MD for final approval. An OTP will be sent to your registered email.</p>
                <label htmlFor="edRemarks" className="ec-label">Remarks (optional)</label>
                <textarea id="edRemarks" name="remarks" value={remarks} onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2} placeholder="Remarks for approval" />
                <button type="button" onClick={sendEdOtp} disabled={sendingEdOtp}
                  className="ec-btn-primary w-full justify-center bg-fuchsia-600 hover:bg-fuchsia-700">
                  {sendingEdOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingEdOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : edVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">OTP Verified Successfully</p>
                <p className="text-xs text-[#64748B]">Approving estimate and forwarding to MD...</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">Enter the 6-digit OTP sent to {edOtpSentTo ? <span className="font-medium text-[#0F172A]">{maskEmail(edOtpSentTo)}</span> : 'your email'}.</p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>
                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}
                <label className="ec-label">Enter OTP</label>
                <div className="mb-3"><OtpInput value={edOtpDigits} onChange={setEdOtpDigits} /></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendEdOtp} disabled={sendingEdOtp || edResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingEdOtp ? 'Sending...' : edResendIn > 0 ? `Resend OTP (${edResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEdApprove(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyEdApprove} disabled={approvingEd || edOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-fuchsia-600 hover:bg-fuchsia-700">
                    {approvingEd ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {approvingEd ? 'Approving...' : 'Verify & Approve'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MD Final Approve OTP Modal */}
      {showMdFinal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowMdFinal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-pink-600" />
              <h3 className="font-semibold text-[#0F172A]">MD Final Approval</h3>
            </div>
            {!mdOtpSent && !mdVerified ? (
              <>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Estimate</span>
                    <span className="font-medium text-[#0F172A]">{estimate.EstimateNo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Work</span>
                    <span className="font-medium text-[#0F172A] text-right max-w-[200px] truncate">{estimate.NameOfWork}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Grand Total</span>
                    <span className="font-semibold text-[#1E3A5F]">{fmt(a.GrandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">This is the final authorization step. The MD will approve the estimate, apply a digital signature, and a tender will be automatically created. An OTP will be sent to your registered email.</p>
                <label htmlFor="mdRemarks" className="ec-label">Remarks (optional)</label>
                <textarea id="mdRemarks" name="remarks" value={remarks} onChange={e => setRemarks(e.target.value)}
                  className="ec-input w-full text-sm mb-4" rows={2} placeholder="Remarks for final approval" />
                <button type="button" onClick={sendMdOtp} disabled={sendingMdOtp}
                  className="ec-btn-primary w-full justify-center bg-pink-600 hover:bg-pink-700">
                  {sendingMdOtp ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <PenSquare className="w-3.5 h-3.5" />}
                  {sendingMdOtp ? 'Sending OTP...' : 'Send OTP for Final Approval'}
                </button>
              </>
            ) : mdVerified ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#059669]" />
                <p className="text-sm font-semibold text-[#0F172A]">Final Approval Complete</p>
                <p className="text-xs text-[#64748B]">Tender has been automatically created and the Tender Officer has been notified.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[#059669] mb-1">OTP Sent</p>
                <p className="text-xs text-[#64748B] mb-1">Enter the 6-digit OTP sent to {mdOtpSentTo ? <span className="font-medium text-[#0F172A]">{maskEmail(mdOtpSentTo)}</span> : 'your email'}.</p>
                <p className="text-xs text-[#64748B] mb-3">This OTP is valid for 5 minutes.</p>
                {remarks && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <p className="text-[10px] font-medium text-[#64748B]">Remarks</p>
                    <p className="text-xs text-[#0F172A]">{remarks}</p>
                  </div>
                )}
                <label className="ec-label">Enter OTP</label>
                <div className="mb-3"><OtpInput value={mdOtpDigits} onChange={setMdOtpDigits} /></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#94A3B8]">Valid for 5 minutes · 5 attempts</span>
                  <button type="button" onClick={sendMdOtp} disabled={sendingMdOtp || mdResendIn > 0}
                    className="text-xs text-[#1E3A5F] hover:underline disabled:text-[#94A3B8] disabled:cursor-not-allowed">
                    {sendingMdOtp ? 'Sending...' : mdResendIn > 0 ? `Resend OTP (${mdResendIn}s)` : 'Resend OTP'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowMdFinal(false)} className="ec-btn-secondary flex-1">Cancel</button>
                  <button onClick={verifyMdFinal} disabled={finalizingMd || mdOtpDigits.join('').length !== 6}
                    className="ec-btn-primary flex-1 bg-pink-600 hover:bg-pink-700">
                    {finalizingMd ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {finalizingMd ? 'Finalizing...' : 'Verify & Final Approve'}
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
