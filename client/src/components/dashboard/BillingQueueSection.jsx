import { Link } from 'react-router-dom'
import { ArrowRight, Eye, History, FileText, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import EmptyState from './EmptyState'
import { BillStatusBadge } from '../../utils/billStatus'
import { fmtCurrency } from './utils'
import BillingWorkflowPipeline from '../billing/BillingWorkflowPipeline'
import SlaProgress from '../billing/SlaProgress'
import BillingResponsibilityHero from '../billing/BillingResponsibilityHero'

// Primary billing work queue. Pure display — statuses/role logic all come from
// the existing bill payload and billStatus helpers; nothing here mutates state.
export default function BillingQueueSection({ title, subtitle, rows, viewLink, ownerMe, bill, sla, me }) {
  const [menuOpen, setMenuOpen] = useState(null)
  const focusBill = bill || rows[0] || null

  return (
    <div data-testid="dashboard-billing-queue" className="space-y-3">
      {focusBill && (
        <>
          <BillingResponsibilityHero bill={focusBill} sla={sla} me={me} />
          <BillingWorkflowPipeline status={focusBill.Status} />
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="bi-title">{title}</h2>
            {subtitle && <p className="bi-title-sub">{subtitle}</p>}
          </div>
          {viewLink && (
            <Link to={viewLink} className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline shrink-0">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="bi-panel overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState message="No bills in your billing queue" />
          ) : (
            <div className="overflow-x-auto">
              <table className="bi-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Estimate No.</th>
                    <th className="hidden sm:table-cell">Work Name</th>
                    <th className="text-center">Type</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">SLA</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {rows.map(row => {
                    const open = menuOpen === row.BillID
                    return (
                      <tr key={row.BillID} className="hover:bg-[#F6F9FF]">
                        <td>
                          <p className="font-semibold text-[#0F172A] whitespace-nowrap">{row.BillNo || `#${row.BillID}`}</p>
                          {row.BillType === 'RA'
                            ? <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">RA</span>
                            : <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Final</span>}
                        </td>
                        <td className="font-mono text-[11px] text-[#2563EB] whitespace-nowrap">{row.EstimateNo || row.WorkID}</td>
                        <td className="hidden sm:table-cell">
                          <span className="block max-w-[220px] truncate text-[12px] text-[#475569]">{row.NameOfWork}</span>
                        </td>
                        <td className="text-center text-[12px] text-[#475569]">{row.BillType === 'RA' ? 'RA' : 'Final'}</td>
                        <td className="text-right">
                          <p className="font-semibold text-[#2563EB] whitespace-nowrap">{fmtCurrency(row.NetAmount || 0)}</p>
                          {row.ApprovedAmount != null && <p className="text-[10px] text-[#475569]">appr. {fmtCurrency(row.ApprovedAmount)}</p>}
                        </td>
                        <td className="text-right text-[12px] text-[#475569] whitespace-nowrap">
                          {row.ReceivedAt ? new Date(row.ReceivedAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="text-right"><SlaProgress sla={row.SlaDueAt ? { dueAt: row.SlaDueAt, status: row.SlaStatus, escalationLevel: row.EscalationLevel } : null} compact /></td>
                        <td className="text-center"><BillStatusBadge status={row.Status} /></td>
                        <td className="text-right">
                          <div className="relative inline-flex items-center gap-1">
                            <Link to={`/billing/${row.BillID}`} data-testid="bill-review"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors">
                              <Eye className="w-3.5 h-3.5" /> Review
                            </Link>
                            <button
                              onClick={() => setMenuOpen(open ? null : row.BillID)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {open && (
                              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-[#CBD5E1] bg-white shadow-lg py-1 animate-fadeIn">
                                <Link to={`/billing/${row.BillID}`} className="flex items-center gap-2 px-3 py-2 text-xs text-[#334155] hover:bg-[#F1F5F9]"><Eye className="w-3.5 h-3.5 text-[#475569]" /> View</Link>
                                <Link to={`/billing/${row.BillID}#history`} className="flex items-center gap-2 px-3 py-2 text-xs text-[#334155] hover:bg-[#F1F5F9]"><History className="w-3.5 h-3.5 text-[#475569]" /> History</Link>
                                <Link to={`/billing/${row.BillID}#documents`} className="flex items-center gap-2 px-3 py-2 text-xs text-[#334155] hover:bg-[#F1F5F9]"><FileText className="w-3.5 h-3.5 text-[#475569]" /> Documents</Link>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
