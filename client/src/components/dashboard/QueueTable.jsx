import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import EmptyState from './EmptyState'

export default function QueueTable({ title, viewLink, viewLabel = 'View all', emptyMessage, columns, rows, onRowClick, rowKey = 'EstimateID', accentColor }) {
  const navigate = useNavigate()
  return (
    <div data-testid="dashboard-queue">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{title}</h2>
        {viewLink && (
          <Link to={viewLink} className="text-xs text-[#1E3A5F] hover:underline inline-flex items-center gap-1">
            {viewLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="bg-white rounded-lg border border-[#E2E8F0]">
        {rows.length === 0 ? (
          <EmptyState message={emptyMessage || 'No items in queue'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                  {columns.map(col => (
                    <th key={col.key} className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} px-4 py-2.5 ${col.hideOn || ''}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {rows.map(row => (
                  <tr key={row[rowKey]}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    onClick={() => onRowClick ? onRowClick(row) : navigate(row.href || `/estimates/${row.EstimateID}`)}>
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-2.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.hideOn || ''}`}>
                        {col.render ? col.render(row) : <span className="text-sm text-[#0F172A]">{row[col.key]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
