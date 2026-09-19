import { AlertTriangle } from 'lucide-react'
import { fmtCurrency } from '../../components/dashboard/utils'

// Reconciliation table for the bill review workbench. Entirely presentational —
// values come from backend BillItems (EstimateQty / PreviousQty / CurrentQty /
// CumulativeQty / BalanceQty / Rate / Amount). Only highlights genuine
// discrepancies (cumulative exceeding the approved quantity).
export default function BillQuantityReconciliation({ items }) {
  const out = (items || []).map(i => Number(i.CumulativeQty || 0) > Number(i.EstimateQty || 0) + 1e-6)
  if (!items || items.length === 0) return null

  return (
    <section>
      <p className="bi-section-label">Quantity Reconciliation</p>
      <div className="bi-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="bi-table min-w-[880px]">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-center">Unit</th>
                <th className="text-right">Approved Qty</th>
                <th className="text-right">Measured Qty</th>
                <th className="text-right">Previously Billed</th>
                <th className="text-right">Current Bill</th>
                <th className="text-right">Cumulative</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => {
                const warn = out[idx]
                return (
                  <tr key={i.BillItemID || idx} className={warn ? 'bg-amber-50/40' : ''}>
                    <td>
                      <p className="text-[12px] font-medium text-[#0F172A]">{i.ItemName || i.ItemCode}</p>
                      {i.ItemCode && <p className="text-[10px] text-[#94A3B8]">{i.ItemCode}</p>}
                    </td>
                    <td className="text-center text-[#475569]">{i.Unit || '—'}</td>
                    <td className="text-right tabular-nums text-[#0F172A]">{i.EstimateQty ?? 0}</td>
                    <td className="text-right tabular-nums text-[#475569]">{i.CurrentQty ?? 0}</td>
                    <td className="text-right tabular-nums text-[#475569]">{i.PreviousQty ?? 0}</td>
                    <td className="text-right tabular-nums font-semibold text-[#0F172A]">{i.CurrentQty ?? 0}</td>
                    <td className="text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 ${warn ? 'text-amber-600 font-bold' : ''}`}>
                        {warn && <AlertTriangle className="w-3 h-3" />}
                        {i.CumulativeQty}
                      </span>
                    </td>
                    <td className={`text-right tabular-nums ${Number(i.BalanceQty) < 0 ? 'text-red-600 font-semibold' : 'text-[#475569]'}`}>{i.BalanceQty}</td>
                    <td className="text-right tabular-nums text-[#475569]">{fmtCurrency(i.Rate)}</td>
                    <td className="text-right tabular-nums font-bold text-[#2563EB]">{fmtCurrency(i.Amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
