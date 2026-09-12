import Logo from '../Logo'
import '../../styles/print.css'

function fmt(n) {
  if (n === null || n === undefined || n === '') return ''
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GeneralAbstractPrint({ estimate, items, abstract }) {
  const civilTotal = items.filter(d => (d.Category || '').toLowerCase() === 'civil')
    .reduce((s, d) => s + Number(d.Amount || 0), 0)
  const materialTotal = items.filter(d => (d.Category || '').toLowerCase() === 'material')
    .reduce((s, d) => s + Number(d.Amount || 0), 0)
  const gst = abstract ? Number(abstract.GST) : 0
  const lsProvision = abstract ? Number(abstract.LSProvision) : 0
  const additionalItemsTotal = abstract ? Number(abstract.AdditionalItemsTotal || 0) : 0
  const costOfEstimate = civilTotal + materialTotal
  const subtotal = abstract && abstract.Subtotal != null
    ? Number(abstract.Subtotal)
    : costOfEstimate + gst
  const grandTotal = abstract ? Number(abstract.GrandTotal) : subtotal + additionalItemsTotal + lsProvision

  const locParts = []
  if (estimate.RegionName) locParts.push('Region: ' + estimate.RegionName)
  if (estimate.ZoneName) locParts.push('Zone: ' + estimate.ZoneName)
  if (estimate.DivisionName) locParts.push('Division: ' + estimate.DivisionName)
  if (estimate.CircleName) locParts.push('Circle: ' + estimate.CircleName)
  if (estimate.WardName) locParts.push('Ward: ' + estimate.WardName)
  const locLine = locParts.length > 0 ? locParts.join(',  ') : ''
  const date = estimate.CreatedDate ? new Date(estimate.CreatedDate).toLocaleDateString('en-IN') : ''

  return (
    <div className="print-page">
      <div className="print-header">
        <div className="flex justify-center mb-2"><Logo size={40} /></div>
        <h1>HMWSSB - Hyderabad Metropolitan Water Supply &amp; Sewerage Board</h1>
        <h2>GENERAL ABSTRACT</h2>
      </div>

      <p className="print-info">Name of Work : {estimate.NameOfWork || ''}</p>
      {locLine && <p className="print-info-normal">{locLine}</p>}
      <p className="print-info-normal">
        Estimate No : {estimate.EstimateNo || estimate.WorkID || ''} &nbsp;&nbsp;&nbsp; Financial Year : {estimate.FinancialYear || ''} &nbsp;&nbsp;&nbsp; Date : {date}
      </p>

      <table className="print-table">
        <thead>
          <tr>
            <th className="col-abs-sl">Sl.No</th>
            <th className="col-abs-desc">Description</th>
            <th className="col-abs-amount">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="section-row">
            <td colSpan="3">Part-I : Working Items</td>
          </tr>
          <tr>
            <td className="center">1</td>
            <td>Cost of Material</td>
            <td className="right">{fmt(materialTotal)}</td>
          </tr>
          <tr>
            <td className="center">2</td>
            <td>Cost of Civil Work</td>
            <td className="right">{fmt(civilTotal)}</td>
          </tr>
          <tr className="total-row">
            <td colSpan="2" className="total-label">Cost of Estimate : Part-I</td>
            <td className="total-amount">{fmt(civilTotal + materialTotal)}</td>
          </tr>

          <tr className="spacer-row"><td colSpan="3">&nbsp;</td></tr>

          <tr className="section-row">
            <td colSpan="3">Part-II : Additional Items</td>
          </tr>
          <tr>
            <td className="center">3</td>
            <td>GST @ {estimate.GSTPercent || 18}%</td>
            <td className="right">{fmt(gst)}</td>
          </tr>
          <tr>
            <td className="center">4</td>
            <td>Additional Items</td>
            <td className="right">{fmt(additionalItemsTotal)}</td>
          </tr>

          <tr className="spacer-row"><td colSpan="3">&nbsp;</td></tr>

          <tr className="section-row">
            <td colSpan="3">Part-III : LS Provisions</td>
          </tr>
          <tr>
            <td className="center">5</td>
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

      <p className="words-row" style={{ textAlign: 'center' }}>(Rupees {abstract?.GrandTotalInWords || ''})</p>
    </div>
  )
}
