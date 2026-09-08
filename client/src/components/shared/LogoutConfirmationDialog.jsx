import { useEffect, useRef, useState } from 'react'
import { LogOut, Loader2, AlertTriangle } from 'lucide-react'

export default function LogoutConfirmationDialog({ open, onClose, onLogout }) {
  const cancelRef = useRef(null)
  const dialogRef = useRef(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape' && !loggingOut) {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, loggingOut, onClose])

  const handleBackdropClick = (e) => {
    if (!loggingOut && e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center animate-fadeIn"
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 id="logout-dialog-title" className="font-semibold text-[#0F172A]">Confirm Logout</h3>
            <p id="logout-dialog-desc" className="text-xs text-[#64748B] mt-0.5">
              Are you sure you want to logout from your account?
            </p>
          </div>
        </div>

        <div className="px-6 pb-2">
          <p className="text-xs text-[#94A3B8]">You will need to sign in again to access the system.</p>
        </div>

        <div className="flex items-center gap-2 px-6 pb-5 pt-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loggingOut}
            className="ec-btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="ec-btn-danger flex-1"
          >
            {loggingOut ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Logging out...</>
            ) : (
              <><LogOut className="w-4 h-4" /> Logout</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
