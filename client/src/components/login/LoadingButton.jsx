import { Loader2 } from 'lucide-react'

export default function LoadingButton({ loading, loadingText, children, disabled, className, type }) {
  return (
    <button type={type || 'submit'} disabled={disabled || loading} className={className}>
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText || 'Loading...'}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
