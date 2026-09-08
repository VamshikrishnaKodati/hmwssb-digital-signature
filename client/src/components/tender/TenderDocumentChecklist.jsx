import { useState } from 'react'
import { Plus, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const DOC_TYPES = [
  'NIT', 'Tender Document', 'BOQ', 'Technical Specifications', 'Drawings',
  'Eligibility / Qualification', 'EMD / Bid Security Instructions', 'Other',
]

export default function TenderDocumentChecklist({ tenderId, documents = [], onChange, readonly }) {
  const [busyId, setBusyId] = useState(null)

  const add = async (docType) => {
    if (!tenderId) return
    setBusyId(docType)
    try {
      await api.post(`/tender/${tenderId}/documents`, {
        DocumentName: docType,
        DocumentType: docType,
        Required: true,
      })
      toast.success(`${docType} marked as uploaded`)
      onChange?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add document')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (docId) => {
    if (!tenderId) return
    setBusyId(docId)
    try {
      await api.delete(`/tender/${tenderId}/documents/${docId}`)
      toast.success('Document removed')
      onChange?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove document')
    } finally {
      setBusyId(null)
    }
  }

  const byType = {}
  for (const d of documents) byType[d.DocumentType] = d

  return (
    <div>
      <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Tender Documents Checklist</h3>
      <div className="space-y-2">
        {DOC_TYPES.map(type => {
          const doc = byType[type]
          return (
            <div key={type} className="flex items-center justify-between py-2 px-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] hover:bg-white transition-colors">
              <div className="flex items-center gap-2.5">
                {doc
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <AlertCircle className="w-4 h-4 text-slate-300" />
                }
                <span className={`text-xs font-medium ${doc ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>{type}</span>
                {doc?.Required && <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">Required</span>}
              </div>
              {doc
                ? !readonly && (
                  <button type="button" disabled={busyId === doc.DocumentID} onClick={() => remove(doc.DocumentID)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )
                : !readonly && (
                  <button type="button" disabled={busyId === type || !tenderId} onClick={() => add(type)}
                    className="text-xs text-[#1E3A5F] hover:text-[#0F172A] font-medium flex items-center gap-1 disabled:opacity-50">
                    <Upload className="w-3 h-3" /> Mark Uploaded
                  </button>
                )
              }
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[#94A3B8] mt-2">Upload all mandatory documents before publishing the tender.</p>
    </div>
  )
}