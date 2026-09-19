import Logo from '../Logo'
import '../../styles/print.css'

function fmt(n) {
  if (n === null || n === undefined || n === '') return ''
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n) {
  if (n === null || n === undefined) return ''
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

/**
 * Live A4 print preview for the Create Estimate page. Renders the current
 * (possibly unsaved) form data: document identity block, Name of Work /
 * Work Category / Location, the full itemized estimate table, then the
 * Part-I / Part-II (Reimbursements) / Part-III (LS Provisions) abstract
 * with GST and Grand Total. Pure presentation — no backend calls, no
 * calculation changes beyond the same arithmetic shown on screen.
 */
export default function EstimateDraftPrint({
  nameOfWork,
  workCategory,
  locationLine,
  items = [],
  additionalItems = [],
  lsProvisions = [],
  gstPercent,
}) {
  const gstPct = parseFloat(gstPercent) || 0
  const civil = items.filter(i => (i.Category || '').toLowerCase() === 'civil')
    .reduce((s, d) => s + Number(d.Amount || 0), 0)
  const material = items.filter(i => (i.Category || '').toLowerCase() === 'material')
    .reduce((s, d) => s + Number(d.Amount || 0), 0)
  const costOfEstimate = civil + material
  const gst = costOfEstimate * gstPct / 100
  const reimbursements = additionalItems.reduce((s, r) => s + Number(r.Amount || 0), 0)
  const lsProvision = lsProvisions.reduce((s, r) => s + Number(r.Amount || 0), 0)
  const grandTotal = costOfEstimate + gst + reimbursements + lsProvision

  return (
    <div className="print-wrapper estimate-print-document" id="estimate-preview-doc">
      <div className="print-cover">
        <div className="flex justify-center mb-2"><Logo size={36} /></div>
        <h1>Government of Telangana</h1>
        <p className="pc-board">HMWSSB - Hyderabad Metropolitan Water Supply &amp; Sewerage Board</p>
        <p className="pc-wms">Works Management System</p>
        <div className="pc-rule" />
        <h2 className="pc-abstract">ABSTRACT OF ESTIMATE</h2>
        <p className="pc-sub">Draft Estimate &mdash; for preview only</p>
        <div className="print-cover-grid">
          <div className="pc-cell">
            <p className="pc-label">Name of Work</p>
            <p className="pc-value">{nameOfWork || '-'}</p>
          </div>
          <div className="pc-cell">
            <p className="pc-label">Work Category</p>
            <p className="pc-value">{workCategory || '-'}</p>
          </div>
          <div className="pc-cell">
            <p className="pc-label">Location</p>
            <p className="pc-value">{locationLine || '-'}</p>
          </div>
          <div className="pc-cell">
            <p className="pc-label">GST (%)</p>
            <p className="pc-value">{gstPct}%</p>
          </div>
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th className="col-sl">Sl.No</th>
            <th className="col-code">Item Code</th>
            <th className="col-desc">Description of Work</th>
            <th className="col-type">Type</th>
            <th className="col-num">No</th>
            <th className="col-l">L</th>
            <th className="col-b">B</th>
            <th className="col-d">D</th>
            <th className="col-qty">Qty</th>
            <th className="col-unit">Unit</th>
            <th className="col-rate">Rate</th>
            <th className="col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="section-row">
            <td colSpan="12">Part-I : Working Items</td>
          </tr>
          {items.length === 0 && (
            <tr><td colSpan="12">No items added.</td></tr>
          )}
          {items.map((d, i) => (
            <tr key={d._tempId || d.ItemID || i}>
              <td className="center">{i + 1}</td>
              <td className="center">{d.ItemCode || ''}</td>
              <td className="desc-cell">{d.Description || ''}</td>
              <td className="center">{d.Category === 'Material' ? 'Material' : 'Civil Work'}</td>
              <td className="center">{d.N || ''}</td>
              <td className="center">{d.L || ''}</td>
              <td className="center">{d.B || ''}</td>
              <td className="center">{d.D || ''}</td>
              <td className="right">{fmtQty(d.Qty)}</td>
              <td className="center">{d.Unit || ''}</td>
              <td className="right">{fmt(d.Rate)}</td>
              <td className="right">{fmt(d.Amount)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan="11" className="total-label">Part-I : Working Items Total</td>
            <td className="total-amount">{fmt(costOfEstimate)}</td>
          </tr>
        </tbody>
      </table>

      <table className="print-table">
        <tbody>
          <tr className="section-row">
            <td colSpan="3">Part-I : Working Items</td>
          </tr>
          <tr>
            <td className="center">1</td>
            <td>Cost of Material</td>
            <td className="right">{fmt(material)}</td>
          </tr>
          <tr>
            <td className="center">2</td>
            <td>Cost of Civil Work</td>
            <td className="right">{fmt(civil)}</td>
          </tr>
          <tr className="total-row">
            <td colSpan="2" className="total-label">Cost of Estimate : Part-I</td>
            <td className="total-amount">{fmt(costOfEstimate)}</td>
          </tr>

          <tr className="spacer-row"><td colSpan="3">&nbsp;</td></tr>

          <tr className="section-row">
            <td colSpan="3">Part-II : Reimbursements</td>
          </tr>
          <tr>
            <td className="center">1</td>
            <td>GST @ {gstPct}%</td>
            <td className="right">{fmt(gst)}</td>
          </tr>
          <tr>
            <td className="center">2</td>
            <td>Reimbursement Items ({additionalItems.length})</td>
            <td className="right">{fmt(reimbursements)}</td>
          </tr>
          <tr className="total-row">
            <td colSpan="2" className="total-label">Part-II Total</td>
            <td className="total-amount">{fmt(gst + reimbursements)}</td>
          </tr>

          <tr className="spacer-row"><td colSpan="3">&nbsp;</td></tr>

          <tr className="section-row">
            <td colSpan="3">Part-III : LS Provisions</td>
          </tr>
          <tr>
            <td className="center">1</td>
            <td>LS unforeseen items and rounding off</td>
            <td className="right">{fmt(lsProvision)}</td>
          </tr>

          <tr className="spacer-row"><td colSpan="3">&nbsp;</td></tr>

          <tr className="grand-total-row">
            <td colSpan="2" className="total-label">Grand Total (Part-I + Part-II + Part-III)</td>
            <td className="total-amount">{fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}