import { useEffect, useRef, useState } from 'react'
import { X, ShieldCheck, KeyRound, RotateCcw, FileText, Banknote } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { fmtCurrency } from '../dashboard/utils'

// Premium OTP verify modal. Six split digit fields with autofocus, auto
// advance, backspace handling, paste support and an expiry/resend timer.
// Keeps the exact same backend contract (requestUrl / verifyUrl / verifyBody)
// and data-testids as before — only the presentation is upgraded.
export default function OtpModal({ open, title, subtitle, requestUrl, verifyUrl, verifyBody, onClose, onDone, amount, recipient }) {
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [busy, setBusy] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [expiry, setExpiry] = useState(0)
  const inputs = useRef([])

  useEffect(() => {
    if (!open) return
    setDigits(Array(6).fill('')); setBusy(false); setSuccess(false); setCooldown(0); setExpiry(0)
    requestOtp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [open, cooldown])

  useEffect(() => {
    if (!open || expiry <= 0) return
    const t = setTimeout(() => setExpiry(e => e - 1), 1000)
    return () => clearTimeout(t)
  }, [open, expiry])

  const requestOtp = async () => {
    setRequesting(true)
    try {
      const res = await api.post(requestUrl)
      const secs = res.data?.cooldown
      if (secs) setCooldown(secs)
      else { setExpiry(300); toast.success('OTP sent — check console / logs') }
    } catch (err) {
      const msg = err.response?.data?.error?.includes('cooldown')
        ? 'Wait a moment before requesting again'
        : err.response?.data?.error || 'Could not send OTP'
      toast.error(msg)
    }
    setRequesting(false)
  }

  const setDigit = (i, val) => {
    const v = val.replace(/\D/g, '').slice(0, 6)
    const next = [...digits]
    if (v.length > 1) {
      // Paste of multiple digits
      for (let k = 0; k < v.length && i + k < 6; k++) next[i + k] = v[k]
      setDigits(next)
      const focusTo = Math.min(i + v.length, 5)
      inputs.current[focusTo]?.focus()
      return
    }
    next[i] = v
    setDigits(next)
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) { next[i] = ''; setDigits(next) }
      else if (i > 0) inputs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length !== 6) return
    setBusy(true)
    try {
      const body = { ...(verifyBody || {}), otpCode: otp }
      await api.post(verifyUrl, body)
      setSuccess(true)
      toast.success('Verified')
      setTimeout(() => { onDone && onDone() }, 900)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
      setDigits(Array(6).fill('')); inputs.current[0]?.focus()
    }
    setBusy(false)
  }

  if (!open) return null
  const resendTimer = cooldown > 0 ? ` (${cooldown}s)` : ''
  const expLabel = expiry > 0 ? `${Math.floor(expiry / 60)}:${String(expiry % 60).padStart(2, '0')}` : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn" onClick={onClose}>
      <div className="w-full max-w-sm bi-panel p-5 animate-scaleIn" onClick={e => e.stopPropagation()} data-testid="otp-modal">
        {success ? (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-[#0F172A]">OTP Verified</p>
            <p className="text-xs text-[#475569] mt-1">Completing action…</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/5 border border-[#2563EB]/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
                  {subtitle && <p className="text-[11px] text-[#475569]">{subtitle}</p>}
                </div>
              </div>
              <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X className="w-4 h-4" /></button>
            </div>

            {(amount != null || recipient) && (
              <div className="flex items-center gap-3 mb-4 rounded-xl border border-[#E7ECF3] bg-[#F8FAFC]/60 px-3 py-2">
                {amount != null && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB]">
                    <Banknote className="w-3.5 h-3.5" /> {fmtCurrency(amount)}
                  </span>
                )}
                {recipient && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569] ml-auto">
                    <FileText className="w-3.5 h-3.5" /> {recipient}
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleVerify}>
              <div className="flex justify-between gap-1.5 mb-4">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => (inputs.current[i] = el)}
                    data-testid="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={d}
                    autoFocus={i === 0}
                    onFocus={e => e.target.select()}
                    onChange={e => setDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-mono font-bold text-[#0F172A] rounded-lg border border-[#CBD5E1] bg-white outline-none transition-all duration-150 focus:border-[#2563EB] focus:ring-[3px] focus:ring-[rgba(37,99,235,0.12)] disabled:bg-[#F8FAFC]"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={requestOtp} disabled={requesting || cooldown > 0}
                  className="text-xs text-[#2563EB] hover:underline inline-flex items-center gap-1 disabled:text-[#94A3B8] disabled:no-underline">
                  <RotateCcw className="w-3 h-3" /> Resend{requesting ? '…' : resendTimer}
                </button>
                <span className="text-[10px] text-[#94A3B8] tabular-nums">{expLabel ? `${expLabel} left` : 'Valid 5 min'}</span>
              </div>
              <button type="submit" disabled={busy || digits.join('').length !== 6}
                className="ec-btn-primary ec-btn-sm w-full justify-center disabled:opacity-50" data-testid="otp-verify">
                {busy ? 'Verifying…' : 'Confirm with OTP'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
