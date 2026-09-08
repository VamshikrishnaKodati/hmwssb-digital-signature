import { AlertCircle } from 'lucide-react'

export default function ValidationMessage({ message }) {
  if (!message) return null
  return (
    <p className="ec-error-text flex items-center gap-1 animate-fadeIn" role="alert">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{message}</span>
    </p>
  )
}
