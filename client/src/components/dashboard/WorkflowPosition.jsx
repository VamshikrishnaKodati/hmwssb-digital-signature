import { Link } from 'react-router-dom'
import { ArrowRightCircle } from 'lucide-react'
import { fmt } from './utils'

export default function WorkflowPosition({ stages, title, viewLink }) {
  return (
    <div data-testid="workflow-position">
      {title && (
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{title}</h2>
          {viewLink && (
            <Link to={viewLink} className="text-xs text-[#1E3A5F] hover:underline inline-flex items-center gap-1">
              View all <ArrowRightCircle className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-1 flex-1 min-w-0">
              {stage.to ? (
                <Link to={stage.to}
                  className={`flex-1 text-center py-3 px-2 rounded-lg ${stage.bg} border ${stage.border} hover:shadow-sm transition-all min-w-0`}>
                  <p className="text-2xl font-bold" style={{ color: stage.color }}>{fmt(stage.count)}</p>
                  <p className="text-[10px] font-medium text-[#64748B] mt-0.5 truncate">{stage.label}</p>
                </Link>
              ) : (
                <div className={`flex-1 text-center py-3 px-2 rounded-lg ${stage.bg} border ${stage.border} min-w-0`}>
                  <p className="text-2xl font-bold" style={{ color: stage.color }}>{fmt(stage.count)}</p>
                  <p className="text-[10px] font-medium text-[#64748B] mt-0.5 truncate">{stage.label}</p>
                </div>
              )}
              {i < stages.length - 1 && (
                <ArrowRightCircle className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
