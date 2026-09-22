import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

const OtpInput = forwardRef(function OtpInput({ value, onChange, length = 6, onSubmit }, ref) {
  const inputRefs = useRef([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  useImperativeHandle(ref, () => ({
    focus: (idx = 0) => inputRefs.current[idx]?.focus(),
    clear: () => { onChange(Array(length).fill('')); inputRefs.current[0]?.focus() },
  }))

  const focusNext = (idx) => { if (idx < length - 1) inputRefs.current[idx + 1]?.focus() }
  const focusPrev = (idx) => { if (idx > 0) inputRefs.current[idx - 1]?.focus() }

  const handleChange = (idx, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...value]
    next[idx] = digit
    onChange(next)
    if (digit) focusNext(idx)
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Enter') {
      // Enter works like the primary OTP action but only fires when the OTP
      // is complete, and never triggers scroll/form navigation.
      e.preventDefault()
      e.stopPropagation()
      if (onSubmit && value.every(d => d !== '') && value.join('').length === length) onSubmit(e)
      return
    }
    if (e.key === 'Backspace') {
      if (!value[idx] && idx > 0) focusPrev(idx)
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusPrev(idx) }
    if (e.key === 'ArrowRight') { e.preventDefault(); focusNext(idx) }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(Array.from({ length }, (_, i) => pasted[i] || ''))
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex items-center justify-between gap-1.5" onPaste={handlePaste}>
      {value.map((d, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el }}
          value={d}
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`OTP digit ${i + 1}`}
          className="w-10 h-12 text-center text-lg font-bold border border-[#CBD5E1] rounded-lg focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 outline-none transition-colors"
        />
      ))}
    </div>
  )
})

export default OtpInput
