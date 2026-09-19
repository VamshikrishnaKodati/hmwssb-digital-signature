import { useEffect, useRef, useState } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'

const META = {
  'additional-item': {
    titleAdd: 'Add Reimbursement',
    titleEdit: 'Edit Reimbursement',
    subtitle: 'Part-II · Reimbursements',
    primaryAdd: 'Add Item',
    deleteTitle: 'Delete Additional Item',
  },
  'ls-provision': {
    titleAdd: 'Add LS Provision',
    titleEdit: 'Edit LS Provision',
    subtitle: 'Part-III · LS Provisions',
    primaryAdd: 'Add LS Provision',
    deleteTitle: 'Delete LS Provision',
  },
}

// One shared form for Add/Edit of both Part-II and Part-III. The shell flips
// between a centered dialog (≥640px) and a bottom drawer (<640px); business
// logic stays identical. Only one of these can be mounted at a time.
export function ItemFormDialog({ open, data, gstPercent, onClose, onSave }) {
  const kind = data ? data.kind : 'additional-item'
  const editing = !!data?.edit
  const meta = META[kind]

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const descRef = useRef(null)
  const amountRef = useRef(null)
  const dialogRef = useRef(null)
  const restoreFocusRef = useRef(null)

  useEffect(() => {
    if (!open || !data) return
    const initial = data.edit || { Description: '', Amount: '' }
    setDesc(initial.Description || '')
    setAmount(initial.Amount === 0 || initial.Amount === '' ? '' : String(initial.Amount))
    setErrors({})
    setConfirming(false)
    setSubmitting(false)
    restoreFocusRef.current = document.activeElement
    requestAnimationFrame(() => descRef.current?.focus())
  }, [open, data])

  const pristine = (() => {
    const initial = data?.edit || { Description: '', Amount: '' }
    return desc === (initial.Description || '') && amount === (initial.Amount === 0 || initial.Amount === '' ? '' : String(initial.Amount))
  })()

  const doClose = () => {
    restoreFocusRef.current?.focus?.()
    onClose()
  }

  const requestClose = () => {
    if (submitting) return
    if (pristine) doClose()
    else setConfirming(true)
  }

  // Focus trap: any Tab that lands outside the dialog gets yanked back in.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!dialogRef.current) return
      if (e.target === dialogRef.current) return
      if (!dialogRef.current.contains(document.activeElement)) {
        const f = dialogRef.current.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        f?.focus()
      }
    }
    document.addEventListener('focusin', handler)
    return () => document.removeEventListener('focusin', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (confirming) { setConfirming(false); descRef.current?.focus() }
        else requestClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, confirming, pristine, submitting]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const errs = {}
    if (!desc.trim()) errs.Description = 'Description is required.'
    if (amount === '' || amount == null) errs.Amount = 'Amount is required.'
    else {
      const amt = Number(amount)
      if (Number.isNaN(amt)) errs.Amount = 'Enter a valid amount.'
      else if (amt < 0) errs.Amount = 'Amount must be 0 or more.'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const errs = validate()
    setErrors(errs)
    if (errs.Description) { descRef.current?.focus(); return }
    if (errs.Amount) { amountRef.current?.focus(); return }
    setSubmitting(true)
    try {
      await onSave({ Description: desc.trim(), Amount: Number(amount) })
      doClose()
    } catch (err) {
      setSubmitting(false)
      setErrors(prev => ({ ...prev, _submit: err?.message || 'Failed to save. Please try again.' }))
    }
  }

  if (!open || !data) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[rgba(15,35,55,0.4)] animate-fadeIn"
      onClick={e => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ai-modal-title-${kind}`}
        aria-describedby={`ai-modal-desc-${kind}`}
        className="w-full sm:max-w-[560px] bg-white text-[#0F172A] flex flex-col
          max-sm:max-h-[calc(100dvh-16px)] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:animate-ecDrawerUp
          sm:max-h-[min(88dvh,720px)] sm:rounded-2xl sm:border sm:border-[#CBD5E1] sm:shadow-2xl sm:animate-scaleIn
          overflow-hidden"
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#CBD5E1] bg-white">
          <div className="min-w-0">
            <h2 id={`ai-modal-title-${kind}`} className="text-base font-bold text-[#0F172A] leading-tight">
              {editing ? meta.titleEdit : meta.titleAdd}
            </h2>
            <p id={`ai-modal-desc-${kind}`} className="text-xs text-[#475569] mt-0.5">{meta.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            aria-label="Close dialog"
            className="p-1.5 -m-1.5 rounded-lg text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {confirming ? (
          <div className="px-5 py-5 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-[#D97706] mt-0.5 shrink-0" />
              <p className="text-sm text-[#334155]">Discard changes?</p>
            </div>
            <p className="text-xs text-[#475569] -mt-1.5 pl-7">
              The description and amount you entered will be lost.
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => { setConfirming(false); descRef.current?.focus() }}
                className="ec-btn-outline !py-1.5 !px-3 !text-xs"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={doClose}
                className="ec-btn-danger !py-1.5 !px-3 !text-xs"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label htmlFor={`ai-desc-${kind}`} className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Description <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  id={`ai-desc-${kind}`}
                  ref={descRef}
                  rows={4}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. Providing and fixing manhole cover..."
                  aria-invalid={!!errors.Description}
                  className={`ec-dialog-textarea ${errors.Description ? 'ec-input-error' : ''}`}
                />
                {errors.Description && <p className="ec-error-text">{errors.Description}</p>}
              </div>

              <div>
                <label htmlFor={`ai-amt-${kind}`} className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Amount (₹) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id={`ai-amt-${kind}`}
                  ref={amountRef}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={!!errors.Amount}
                  className={`ec-input font-semibold tabular-nums ${errors.Amount ? 'ec-input-error' : ''}`}
                />
                {errors.Amount && <p className="ec-error-text">{errors.Amount}</p>}
                {kind === 'additional-item' && (
                  <p className="text-[11px] text-[#475569] mt-1.5">
                    GST will be calculated using the selected Part-II GST rate.{' '}
                    <span className="font-semibold text-[#334155]">GST rate: {Number(gstPercent) || 0}%</span>
                  </p>
                )}
              </div>
              {errors._submit && <p className="ec-error-text">{errors._submit}</p>}
            </div>

            <footer className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#CBD5E1] bg-white">
              <button type="button" onClick={requestClose} disabled={submitting} className="ec-btn-outline !py-2 !px-4 !text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="ec-btn-primary !py-2 !px-4 !text-sm min-w-[110px]"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : editing ? (
                  'Save Changes'
                ) : (
                  meta.primaryAdd
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onClose }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => cancelRef.current?.focus())
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!dialogRef.current) return
      if (!dialogRef.current.contains(document.activeElement)) {
        const f = dialogRef.current.querySelector('button, [href], input, select, textarea')
        f?.focus()
      }
    }
    document.addEventListener('focusin', handler)
    return () => document.removeEventListener('focusin', handler)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,35,55,0.4)] animate-fadeIn"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-[420px] bg-white rounded-xl border border-[#CBD5E1] shadow-2xl animate-scaleIn"
      >
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-[#DC2626]" />
          </div>
          <div>
            <h2 id="confirm-dialog-title" className="text-sm font-bold text-[#0F172A]">{title}</h2>
            <p id="confirm-dialog-message" className="text-xs text-[#475569] mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className="ec-btn-outline !py-1.5 !px-3 !text-xs">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="ec-btn-danger !py-1.5 !px-3 !text-xs">
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}