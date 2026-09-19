import { forwardRef } from 'react'
import ValidationMessage from './ValidationMessage'

const InputField = forwardRef(function InputField(
  { label, name, type = 'text', value, onChange, placeholder, icon: Icon, error, autoComplete, autoFocus, spellCheck, onKeyDown, disabled, required, className },
  ref
) {
  const inputClasses = `ec-input pl-9 ${error ? 'ec-input-error' : ''} ${className || ''}`

  return (
    <div className="ec-form-group">
      <label className="ec-label" htmlFor={name}>
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />}
        <input
          ref={ref}
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete || 'off'}
          autoFocus={autoFocus}
          spellCheck={spellCheck === false ? false : undefined}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      </div>
      <ValidationMessage message={error} />
    </div>
  )
})

export default InputField
