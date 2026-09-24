import Logo from '../Logo'
import '../../styles/print.css'

const noDash = (v) => (v === null || v === undefined || v === '' ? '—' : v)
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fmtAmount = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }))

// The single canonical Letter of Award document. Both the detail page preview
// and the Print/Download-PDF route render THIS component, so the on-screen
// document and the printer output are guaranteed identical. Every value is
// data-driven from the persisted award chain; no legal wording is invented.
export default function LOADocument({ loa }) {
  const conditions = (loa?.Conditions || '').split('\n').filter(Boolean)
  const generatedDate = loa?.GeneratedAt ? new Date(loa.GeneratedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const grid = [
    ['LOA No', noDash(loa?.LOANumber), 'Tender No', noDash(loa?.TenderNo)],
    ['Name of Work', noDash(loa?.NameOfWork), 'Work Category', noDash(loa?.WorkCategory)],
    ['Estimate No', noDash(loa?.EstimateNo), 'Financial Year', noDash(loa?.FinancialYear)],
    ['Awarded Agency', noDash(loa?.ContractorName), 'Registration No', noDash(loa?.RegistrationNo)],
    ['Location', noDash(loa?.locationLine), 'Award Date', noDash(loa?.AwardedAt ? new Date(loa.AwardedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')],
    ['Awarded Amount', `Rs. ${fmtAmount(loa?.AwardAmount)}`, 'Amount in Words', noDash(loa?.AwardAmountInWords)],
  ]

  return (
    <div className="print-page">
      <div className="print-cover">
        <div className="flex justify-center mb-2"><Logo size={36} /></div>
        <h1>Government of Telangana</h1>
        <p className="pc-board">HMWSSB — Hyderabad Metropolitan Water Supply &amp; Sewerage Board</p>
        <p className="pc-wms">Works Management System</p>
        <div className="pc-rule" />
        <h2 className="pc-abstract">LETTER OF AWARD</h2>
        <p className="pc-sub">
          {loa?.LOANumber}
          <span className="mx-1">|</span>
          Date : {generatedDate}
        </p>
        <div className="print-cover-grid">
          {grid.map(([l1, v1, l2, v2]) => ([
            <div className="pc-cell" key={l1}>
              <p className="pc-label">{l1}</p>
              <p className="pc-value">{v1}</p>
            </div>,
            <div className="pc-cell" key={l2}>
              <p className="pc-label">{l2}</p>
              <p className="pc-value">{v2}</p>
            </div>,
          ]))}
        </div>
      </div>

      <p className="print-info" style={{ marginTop: '5mm' }}>
        Ref : {noDash(loa?.LOANumber)}{loa?.AwardedAt ? `　|　Dated : ${new Date(loa.AwardedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
      </p>

      <p className="print-info" style={{ marginTop: '4mm' }}>To,</p>
      <p className="print-info-normal" style={{ marginTop: '1mm' }}>{noDash(loa?.ContractorName)}</p>
      {loa?.RegistrationNo && <p className="print-info-normal">Regd. No : {loa.RegistrationNo}</p>}
      {loa?.Address && <p className="print-info-normal">{loa.Address}</p>}

      <p className="print-info" style={{ marginTop: '4mm' }}>Sub : Award of Work — {noDash(loa?.NameOfWork)}</p>

      <p className="print-info-normal" style={{ marginTop: '3mm' }}>
        Your bid for the above work, as evaluated and ranked L1 by this office, is hereby accepted. The work is awarded
        to you for a total sum of <b>Rs. {fmtAmount(loa?.AwardAmount)}</b> ({noDash(loa?.AwardAmountInWords)}), being in
        accordance with your offer.
      </p>

      {(loa?.ContractorName || loa?.TenderNo) && (
        <p className="print-info-normal" style={{ marginTop: '2mm' }}>
          Please proceed with the execution of the work in accordance with the tender conditions
          {loa?.TenderNo ? ` (Tender No : ${loa.TenderNo})` : ''} and the following:-
        </p>
      )}

      <div className="print-info-normal" style={{ marginTop: '2mm' }}>
        <ol style={{ margin: 0, padding: '0 0 0 14px' }}>
          {conditions.map((c, i) => <li key={i} style={{ marginBottom: '1px' }}>{c}</li>)}
        </ol>
      </div>

      <p className="print-info-normal" style={{ marginTop: '3mm' }}>
        The Work Order setting out the detailed execution schedule will be issued separately.
      </p>

      <div className="print-signatures">
        <div className="print-sig">
          <div className="print-sig-line" />
          <div className="print-sig-label">{noDash(loa?.GeneratedByName)}</div>
          <div className="print-sig-role">Director of Administration, HMWSSB</div>
        </div>
      </div>
    </div>
  )
}