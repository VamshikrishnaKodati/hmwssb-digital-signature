import { forwardRef } from 'react'

const NumericInput = forwardRef(function NumericInput(
  { name, value, onChange, placeholder, error, className, readOnly, ...props },
  ref
) {
  const handleChange = (e) => {
    const raw = e.target.value
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      onChange(e)
    }
  }

  return (
    <input
      ref={ref}
      name={name}
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`ec-input text-xs ${error ? '!border-[#DC2626]' : ''} ${className || ''}`}
      autoComplete="off"
      spellCheck={false}
      {...props}
    />
  )
})

export default NumericInput
