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

export default function CivilEstimatePrint({ estimate, items }) {
  const total = items.reduce((s, d) => s + Number(d.Amount || 0), 0)

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
        <h2>ESTIMATE FOR CIVIL WORK</h2>
      </div>

      <p className="print-info">Name of Work : {estimate.NameOfWork || ''}</p>
      {locLine && <p className="print-info-normal">{locLine}</p>}
      <p className="print-info-normal">
        Estimate No : {estimate.EstimateNo || estimate.WorkID || ''} &nbsp;&nbsp;&nbsp;&nbsp; Date : {date}
      </p>

      <table className="print-table">
        <thead>
          <tr>
            <th className="col-sl">S.No</th>
            <th className="col-desc">Description of Work</th>
            <th className="col-num">No</th>
            <th className="col-l">L</th>
            <th className="col-b">B</th>
            <th className="col-d">D</th>
            <th className="col-qty">Qty</th>
            <th className="col-rate">Rate</th>
            <th className="col-unit">Unit</th>
            <th className="col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={d.DetailID || i}>
              <td className="center">{i + 1}</td>
              <td className="desc-cell">{d.Description || ''}</td>
              <td className="center">{d.N || ''}</td>
              <td className="center">{d.L || ''}</td>
              <td className="center">{d.B || ''}</td>
              <td className="center">{d.D || ''}</td>
              <td className="right">{fmtQty(d.Qty)}</td>
              <td className="right">{fmt(d.Rate)}</td>
              <td className="center">{d.Unit || ''}</td>
              <td className="right">{fmt(d.Amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan="9" className="total-label">Part-I : Working Items Total</td>
            <td className="total-amount">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      {estimate.Abstract?.CivilTotalInWords && (
        <p className="words-row">(Rupees {estimate.Abstract.CivilTotalInWords} Only)</p>
      )}
    </div>
  )
}
