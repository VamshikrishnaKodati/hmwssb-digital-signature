const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { numberToWords } = require('./numberToWords');
const { inr, fmtDate, collect } = require('./format');

const TEMPLATE_DIR = path.join(__dirname, '../templates');
const MARGIN = 45;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const NAVY = '#1a237e';

function drawRow(doc, y, cells, widths) {
  let x = MARGIN;
  cells.forEach((cell, i) => {
    doc.text(String(cell), x, y, { width: widths[i], height: 18, align: 'left' });
    x += widths[i];
  });
}

async function generateNITPDF(data) {
  const { tender, estimate, abstract, locNames, officer } = data;

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  let y = 50;

  try {
    const logoPath = path.join(TEMPLATE_DIR, 'hmwssb-logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (PAGE_WIDTH - 80) / 2, y, { width: 80 });
      y += 80 + 8;
    }
  } catch (_) {}

  doc.fillColor('#0f2a52').font('Helvetica-Bold').fontSize(11).text('GOVERNMENT OF TELANGANA', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 2;
  doc.fillColor(NAVY).fontSize(13).text('HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 2;
  doc.fillColor('#5a6a7f').font('Helvetica').fontSize(9).text('Works Management System', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 8;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(1.2).strokeColor(NAVY).stroke();
  y += 18;

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text('NOTICE INVITING TENDER (NIT)', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 2;
  doc.fillColor('#0f172a').fontSize(10.5).text(`Tender No : ${tender.TenderNo || '-'}`, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 16;

  const rows = [
    ['Department', 'HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD'],
    ['Name of Work', estimate.NameOfWork || '-'],
    ['Work Category', estimate.WorkCategory || '-'],
    ['Location', locNames || '-'],
    ['Estimated Cost', inr(abstract ? abstract.GrandTotal : tender.EstimatedCost)],
    ['Completion Period', tender.CompletionPeriod || '-'],
    ['EMD', inr(tender.EMD)],
    ['Tender Fee', inr(tender.TenderFee)],
    ['Bid Start Date', fmtDate(tender.BidStartDate)],
    ['Bid End Date', fmtDate(tender.BidEndDate)],
    ['Technical Bid Opening Date', fmtDate(tender.TechnicalBidOpeningDate)],
    ['Financial Bid Opening Date', fmtDate(tender.FinancialBidOpeningDate)],
    ['Bid Validity', tender.BidValidity ? `${tender.BidValidity} days` : '-'],
    ['Eligibility Criteria', tender.EligibilityCriteria || '-'],
    ['Required Documents', tender.RequiredDocuments || '-'],
    ['Performance Security', tender.PerformanceSecurity || '-'],
    ['Special Conditions', tender.SpecialConditions || '-'],
    ['Tender Officer', officer ? `${officer.Name} (${officer.Designation})` : '-'],
  ];

  const labelW = 130;
  const valueW = CONTENT_WIDTH - labelW;
  for (const [label, value] of rows) {
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(label, MARGIN, y, { width: labelW });
    doc.fillColor('#334155').font('Helvetica').fontSize(9).text(String(value), MARGIN + labelW, y, { width: valueW });
    y = Math.max(doc.y, y + 16) + 2;
    if (y > 760) { doc.addPage(); y = 50; }
  }

  y += 10;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  y += 14;

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('IMPORTANT CONDITIONS', MARGIN, y);
  y = doc.y + 6;
  const conditions = [
    '1. Bids must be submitted before the Bid End Date along with the required documents and EMD.',
    `2. The estimated cost is ${inr(abstract ? abstract.GrandTotal : tender.EstimatedCost)} (Rupees ${numberToWords(abstract ? abstract.GrandTotal : tender.EstimatedCost)} only).`,
    '3. HMWSSB reserves the right to accept or reject any or all bids without assigning any reason.',
    '4. The successful bidder shall furnish performance security as specified in the tender conditions.',
    '5. Technical eligibility will be evaluated first; only technically eligible bidders proceed to financial evaluation.',
  ];
  for (const c of conditions) {
    doc.fillColor('#334155').font('Helvetica').fontSize(9).text(c, MARGIN, y, { width: CONTENT_WIDTH });
    y = doc.y + 5;
    if (y > 780) { doc.addPage(); y = 50; }
  }

  y += 10;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(
    `Issued by : ${officer ? `${officer.Name} (${officer.Designation}), HMWSSB` : 'HMWSSB'}`,
    MARGIN, y, { width: CONTENT_WIDTH, align: 'left' }
  );

  return collect(doc);
}

module.exports = { generateNITPDF };
