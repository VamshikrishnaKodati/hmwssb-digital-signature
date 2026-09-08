import { forwardRef, useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import ValidationMessage from './ValidationMessage'

const PasswordField = forwardRef(function PasswordField(
  { label, name, value, onChange, placeholder, error, autoComplete, autoFocus, onKeyDown, disabled, required, className },
  ref
) {
  const [visible, setVisible] = useState(false)
  const inputClasses = `ec-input pl-9 pr-12 ${error ? 'ec-input-error' : ''} ${className || ''}`

  return (
    <div className="ec-form-group">
      <label className="ec-label" htmlFor={name}>
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
        <input
          ref={ref}
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete || 'current-password'}
          autoFocus={autoFocus}
          spellCheck={false}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors p-1"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <ValidationMessage message={error} />
    </div>
  )
})

export default PasswordField
