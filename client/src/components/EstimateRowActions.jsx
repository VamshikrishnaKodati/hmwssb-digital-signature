import { MoreVertical } from 'lucide-react'

export default function EstimateRowActions({ estimate, isOpen, onTrigger }) {
  return (
    <button
      type="button"
      title="More actions"
      aria-label="More actions"
      aria-haspopup="true"
      aria-expanded={isOpen}
      onClick={(e) => { e.stopPropagation(); onTrigger(estimate, e.currentTarget) }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 shrink-0 ${
        isOpen ? 'bg-[#F1F5F9] text-[#1E3A5F]' : 'text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F1F5F9]'
      }`}
    >
      <MoreVertical className="w-4 h-4" />
    </button>
  )
}
