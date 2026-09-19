import { CheckCircle } from 'lucide-react'

export default function EmptyState({ icon: Icon = CheckCircle, message, sub }) {
  return (
    <div className="px-4 py-8 text-center">
      <Icon className="w-6 h-6 text-green-400 mx-auto mb-2" />
      <p className="text-sm text-[#475569]">{message}</p>
      {sub && <p className="text-xs text-[#94A3B8] mt-1">{sub}</p>}
    </div>
  )
}
