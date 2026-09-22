import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif'
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const MAX_BYTES = 10 * 1024 * 1024
const ERR_FORMAT = 'Please upload a valid JPG, JPEG, PNG or WEBP image.'

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

const formatBytes = (b) => {
  if (b === null || b === undefined || b === 0) return '0 B'
  const units = ['B', 'KB', 'MB']
  let v = b
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`
}

/**
 * Work Progress Photos — per-work image attachments shown with the Work
 * Progress details. Uploads are appended (never replaced), validated to
 * JPG/JPEG/PNG/WEBP/GIF <= 10 MB and stored against the Work ID + estimate,
 * so they persist every time the work is reopened.
 */
function WorkProgressPhotos({ estimateId }) {
  const fileRef = useRef(null)
  const urlMap = useRef({})
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(null)

  const loadPhotoUrl = useCallback(async (photo) => {
    const cached = urlMap.current[photo.PhotoID]
    if (cached) return cached
    const res = await api.get(`/progress-photos/${photo.PhotoID}/file`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    urlMap.current[photo.PhotoID] = url
    return url
  }, [])

  const load = useCallback(async () => {
    if (!estimateId) return
    setLoading(true)
    try {
      const res = await api.get('/progress-photos', { params: { estimateId } })
      const list = res.data || []
      setPhotos(list)
      const next = {}
      await Promise.all(list.map(async (p) => {
        try {
          const url = await loadPhotoUrl(p)
          next[p.PhotoID] = url
        } catch (_) { /* skip thumbnails that cannot load */ }
      }))
      setUrls(next)
    } catch (_) { /* refresh failure is non-fatal */ }
    finally { setLoading(false) }
  }, [estimateId, loadPhotoUrl])

  useEffect(() => {
    load()
    return () => {
      Object.values(urlMap.current).forEach(u => window.URL.revokeObjectURL(u))
      urlMap.current = {}
    }
  }, [load])

  const handleFiles = async (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length) return
    setBusy(true)
    try {
      for (const file of files) {
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (!ALLOWED_EXT.includes(ext) || file.size === 0) {
          toast.error(ERR_FORMAT)
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error('Image exceeds the 10 MB limit.')
          continue
        }
        try {
          const data = await new Promise((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result).split(',')[1])
            fr.onerror = reject
            fr.readAsDataURL(file)
          })
          const res = await api.post('/progress-photos/upload', {
            estimateId,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            data,
          })
          setPhotos(prev => [res.data, ...prev])
          try {
            const url = await loadPhotoUrl(res.data)
            setUrls(prev => ({ ...prev, [res.data.PhotoID]: url }))
          } catch (_) { /* thumbnail fetch failure is non-fatal */ }
          toast.success(`${file.name} attached to this work`)
        } catch (err) {
          toast.error(err.response?.data?.error || 'Upload failed')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = async (photo) => {
    setRemoving(photo.PhotoID)
    try {
      await api.delete(`/progress-photos/${photo.PhotoID}`)
      const url = urlMap.current[photo.PhotoID]
      if (url) window.URL.revokeObjectURL(url)
      delete urlMap.current[photo.PhotoID]
      setPhotos(prev => prev.filter(p => p.PhotoID !== photo.PhotoID))
      setUrls(prev => { const n = { ...prev }; delete n[photo.PhotoID]; return n })
      toast.success('Photo removed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove photo')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="rounded-lg border border-[#CBD5E1]">
      <p className="px-3 py-2 text-xs font-semibold text-[#2563EB] border-b border-[#CBD5E1] bg-[#F8FAFC] flex items-center justify-between">
        <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Work Progress Photos</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded bg-[#2563EB] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />} Upload Photos
        </button>
      </p>
      <div className="p-3 space-y-2">
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`rounded border border-dashed px-3 py-3 text-center cursor-pointer transition-colors ${dragging ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#F8FAFC]'}`}
        >
          <p className="text-xs font-medium text-[#2563EB]">Click to choose or drag &amp; drop photos here</p>
          <p className="mt-1 text-[10px] text-[#94A3B8]">JPG, JPEG, PNG, WEBP or GIF • Maximum 10 MB per image</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#94A3B8]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading photos…
          </div>
        ) : photos.length === 0 ? (
          <p className="py-2 text-center text-xs text-[#94A3B8]">No work progress photos uploaded yet.</p>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {photos.map(photo => (
              <div key={photo.PhotoID} className="flex items-center gap-2 rounded border border-[#CBD5E1] p-1.5">
                <img
                  src={urls[photo.PhotoID]}
                  alt={photo.OriginalName}
                  className="w-16 h-16 rounded object-cover bg-[#F8FAFC] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#0F172A]">{photo.OriginalName}</p>
                  <p className="truncate text-[10px] text-[#475569]">
                    {fmtDateTime(photo.UploadedAt)}{photo.UploadedByName ? ` • ${photo.UploadedByName}` : ''} • {formatBytes(photo.SizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  disabled={removing === photo.PhotoID}
                  title="Remove photo"
                  className="shrink-0 rounded p-1 text-[#94A3B8] hover:text-red-600 hover:bg-red-50"
                >
                  {removing === photo.PhotoID ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkProgressPhotos