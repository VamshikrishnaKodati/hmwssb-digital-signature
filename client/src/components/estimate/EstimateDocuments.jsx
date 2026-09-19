import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../../utils/api'
import { downloadExport } from '../../utils/download'
import toast from 'react-hot-toast'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx'
const MAX_BYTES = 15 * 1024 * 1024

/**
 * Undocumented upload trigger for the Create Estimate page.
 *
 * Renders nothing visible. It owns the pending-before-save flow:
 * - Uploads go to the server immediately with a `pendingKey`.
 * - Once the estimate is saved (estimateId becomes truthy) `toasts` assign
 *   those pending rows to it, so work documents persist server-side and stay
 *   linked to the estimate after Save.
 *
 * The action bar's "Upload" button calls `openPicker()` (exposed via ref) to
 * open the file picker so the manager can select a work-related document.
 */
const EstimateDocuments = forwardRef(function EstimateDocuments({ estimateId }, ref) {
  const pending = useRef([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const pendingKey = useMemo(() => `pk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, [])

  useEffect(() => {
    if (!estimateId) return
    let cancelled = false
    ;(async () => {
      const keys = [...pending.current]
      if (keys.length) {
        setUploading(true)
        try {
          await Promise.all(keys.map(k => api.post('/estimate-documents/assign', { pendingKey: k, estimateId })))
          pending.current = []
        } catch (err) {
          if (!cancelled) toast.error(err.response?.data?.error || 'Could not attach documents to the estimate')
        } finally {
          if (!cancelled) setUploading(false)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId])

  useImperativeHandle(ref, () => ({
    openPicker: () => fileRef.current?.click(),
  }))

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!['pdf', 'jpg', 'jpeg', 'png', 'docx'].includes(ext)) {
      toast.error('Only PDF, JPG, PNG and DOCX files are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('File exceeds the 15 MB limit.')
      return
    }
    setUploading(true)
    try {
      const data = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result).split(',')[1])
        fr.onerror = reject
        fr.readAsDataURL(file)
      })
      const res = await api.post('/estimate-documents/upload', {
        estimateId: estimateId || undefined,
        pendingKey: estimateId ? undefined : pendingKey,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        data,
      })
      if (!estimateId) pending.current.push(res.data.PendingKey)
      toast.success(`${file.name} attached to this estimate`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <input
      ref={fileRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={onPick}
      aria-label="Upload document"
    />
  )
})

export default EstimateDocuments