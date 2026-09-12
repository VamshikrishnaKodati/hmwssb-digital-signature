const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { numberToWords } = require('./numberToWords');
const { inr, collect } = require('./format');

const TEMPLATE_DIR = path.join(__dirname, '../templates');
// ~8mm margins — the same @page margins the browser Print document uses, so
// the downloaded PDF and the printed page share one canonical A4 layout.
const MARGIN = 23;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const FOOTER_LINE_Y = PAGE_HEIGHT - 46;
const CONTENT_BOTTOM = FOOTER_LINE_Y - 10;

const NAVY = '#1a237e';
const LIGHT_GRAY = '#f2f2f2';

// Compact type scale in pt. ppi = 72, browser px * 0.75 => same physical size.
const T_GOVT = 9;
const T_BOARD = 6.7;
const T_WMS = 5.3;
const T_DOC_TITLE = 10.5;
const T_LABEL = 5.3;
const T_INFO = 6.5;
const T_SECTION_TITLE = 7.5;
const T_SEC_INFO = 6.4;
const T_TABLE_HDR = 6.3;
const T_TABLE = 6;
const T_TOTAL = 6.8;
const T_WORDS = 6.5;

function fmt(n, dec = 2) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toFixed(dec);
}

function statusNormalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

function watermarkFor(status) {
  const s = statusNormalize(status);
  if (s === 'draft' || s === 'reverted') return 'DRAFT';
  if (s === 'submitted') return 'UNDER REVIEW';
  if (['approved', 'dgmapproved', 'signed', 'signedaudited'].includes(s)) return 'APPROVED';
  return null;
}

function locationLine(locNames) {
  const parts = [];
  if (locNames.region) parts.push(`Region: ${locNames.region}`);
  if (locNames.zone) parts.push(`Zone: ${locNames.zone}`);
  if (locNames.division) parts.push(`Division: ${locNames.division}`);
  if (locNames.circle) parts.push(`Circle: ${locNames.circle}`);
  if (locNames.ward) parts.push(`Ward: ${locNames.ward}`);
  return parts.join(',  ');
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN') : '';
}

function ensureSpace(doc, y, needed) {
  if (y + needed > CONTENT_BOTTOM) { doc.addPage(); return MARGIN; }
  return y;
}

async function generateCompletePDF(data) {
  const { header, items, abstract, locNames, createdBy, generatedAt } = data;
  const civil = items.filter((i) => (i.Category || '').toLowerCase() === 'civil');
  const material = items.filter((i) => (i.Category || '').toLowerCase() === 'material');
  const now = generatedAt ? new Date(generatedAt) : new Date();
  const genStamp = now.toLocaleString('en-IN');

  const qrPayload = [
    'HMWSSB Estimate',
    `EstimateID: ${header.EstimateID}`,
    `EstimateNo: ${header.EstimateNo || header.WorkID}`,
    `NameOfWork: ${(header.NameOfWork || '').substring(0, 60)}`,
    `GrandTotal: ${abstract ? Number(abstract.GrandTotal) : 0}`,
    `Status: ${header.Status}`,
    `Version: ${header.Version}`,
    `Generated: ${genStamp}`,
  ].join('\n');
  const qrBuffer = await QRCode.toBuffer(qrPayload, { width: 130, margin: 1 });

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });

  let y = renderHeaderBlock(doc, { header, locNames, createdBy });
  if (civil.length) {
    y = renderItemsSection(doc, { header, locNames, title: 'ESTIMATE FOR CIVIL WORK', items: civil, y, totalLabel: 'Part-I : Working Items Total' });
  }
  if (material.length) {
    y = renderItemsSection(doc, { header, locNames, title: 'ESTIMATE FOR MATERIAL', items: material, y, totalLabel: 'Part-I : Cost of Materials Total' });
  }
  renderAbstractSection(doc, { header, locNames, abstract, genStamp, qrBuffer, y });

  renderPageChrome(doc, { genStamp, status: header.Status });

  return collect(doc);
}

/* ------------------------------------------------------------------ */
/* Canonical document header (Government of Telangana / HMWSSB /       */
/* ABSTRACT OF ESTIMATE / estimate information)                        */
/* ------------------------------------------------------------------ */
function renderHeaderBlock(doc, { header, locNames, createdBy }) {
  let y = MARGIN;

  try {
    const logoPath = path.join(TEMPLATE_DIR, 'hmwssb-logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (PAGE_WIDTH - 56) / 2, y, { width: 56 });
      y += 48;
    }
  } catch (_) { /* logo optional */ }

  doc.fillColor('#0f2a52').font('Helvetica-Bold').fontSize(T_GOVT)
    .text('Government of Telangana', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 11;

  doc.fillColor(NAVY).fontSize(T_BOARD)
    .text('HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 8.5;

  doc.fillColor('#5a6a7f').font('Helvetica').fontSize(T_WMS)
    .text('Works Management System', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 6;

  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(1).strokeColor(NAVY).stroke();
  y += 9;

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(T_DOC_TITLE)
    .text('ABSTRACT OF ESTIMATE', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 13;

  doc.fillColor('#0f172a').font('Helvetica').fontSize(T_INFO)
    .text(`${header.EstimateNo || header.WorkID || ''}   |   Financial Year ${header.FinancialYear || ''}`, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 9;

  y = drawInfoGrid(doc, { header, locNames, createdBy, y });
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.6).strokeColor('#cbd5e1').stroke();
  return y + 9;
}

function drawInfoGrid(doc, { header, locNames, createdBy, y }) {
  const pairs = [
    {
      l: 'Estimate ID', v: header.EstimateNo || header.WorkID || '-',
      l2: 'Name of Work', v2: header.NameOfWork || '-',
    },
    {
      l: 'Work Category', v: header.WorkCategory || '-',
      l2: 'Location', v2: locationLine(locNames) || '-',
    },
    {
      l: 'Status', v: header.Status || '-',
      l2: 'Version', v2: String(header.Version || 1),
    },
    {
      l: 'Prepared By', v: createdBy ? `${createdBy.Name} (${createdBy.Designation})` : '-',
      l2: 'Prepared Date', v2: fmtDate(header.CreatedDate) || '-',
    },
  ];
  const colW = CONTENT_WIDTH / 2;
  const rowH = 15;

  function cell(cy, offset, label, value) {
    const x = MARGIN + offset;
    doc.rect(x, cy, colW, rowH).stroke('#cbd5e1');
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(T_LABEL)
      .text(String(label).toUpperCase(), x + 4, cy + 1.5, { width: colW - 8, lineBreak: false });
    doc.fillColor('#0f172a').font('Helvetica').fontSize(T_INFO)
      .text(String(value), x + 4, cy + 6.5, { width: colW - 8, lineBreak: false });
  }

  for (const p of pairs) {
    cell(y, 0, p.l, p.v);
    cell(y, colW, p.l2, p.v2);
    y += rowH;
  }
  return y;
}

/* ------------------------------------------------------------------ */
/* Section header lines common to Civil / Material / Abstract         */
/* ------------------------------------------------------------------ */
function renderSectionInfo(doc, { header, locNames, y }) {
  doc.font('Helvetica').fontSize(T_SEC_INFO).fillColor('#334155');
  doc.text(`Name of Work : ${header.NameOfWork || ''}`, MARGIN, y, { width: CONTENT_WIDTH });
  y += 8.5;
  const locLine = locationLine(locNames);
  if (locLine) {
    doc.text(locLine, MARGIN, y, { width: CONTENT_WIDTH });
    y += 8.5;
  }
  const date = fmtDate(header.CreatedDate);
  doc.text(`Estimate No : ${header.EstimateNo || header.WorkID || ''}    Financial Year : ${header.FinancialYear || ''}    Date : ${date}`, MARGIN, y, { width: CONTENT_WIDTH });
  y += 11;
  return y;
}

/* ------------------------------------------------------------------ */
/* Items section (Civil / Material)                                    */
/* ------------------------------------------------------------------ */
// Canonical item table columns shared with the browser Print document.
const ITEM_HEADERS = ['S.No', 'Item Code', 'Description of Work', 'No', 'L', 'B', 'D', 'Qty', 'Unit', 'Rate', 'Amount'];
const ITEM_WIDTHS = [16, 47, 214, 24, 24, 24, 24, 46, 27, 50, 53];
const ITEM_TOTAL_W = ITEM_WIDTHS.reduce((a, b) => a + b, 0);

function renderItemsSection(doc, { header, locNames, title, items, y, totalLabel }) {
  y = ensureSpace(doc, y, 92);
  doc.font('Helvetica-Bold').fontSize(T_SECTION_TITLE).fillColor(NAVY)
    .text(title, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 10;
  y = renderSectionInfo(doc, { header, locNames, y });
  y = drawItemTable(doc, { title, items, startY: y });

  y = ensureSpace(doc, y, 22);
  const total = items.reduce((s, d) => s + Number(d.Amount || 0), 0);
  doc.font('Helvetica-Bold').fontSize(T_TOTAL).fillColor('#0f172a')
    .text(`${totalLabel} : ${inr(total)}`, MARGIN, y, { align: 'right', width: CONTENT_WIDTH });
  y += 8;
  doc.font('Helvetica').fontSize(T_WORDS).fillColor('#334155')
    .text(`(Rupees ${numberToWords(total)})`, MARGIN, y, { width: CONTENT_WIDTH });
  return y + 10;
}

function drawItemTable(doc, { title, items, startY }) {
  const headerHeight = 11;
  const lineHeight = 6.6;

  function drawHeader(y) {
    doc.rect(MARGIN, y, ITEM_TOTAL_W, headerHeight).fill(NAVY);
    let x = MARGIN;
    ITEM_HEADERS.forEach((h, i) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(T_TABLE_HDR);
      const align = i === 2 ? 'left' : 'center';
      doc.text(h, x + 2, y + 2, { width: ITEM_WIDTHS[i] - 4, align, lineHeight });
      x += ITEM_WIDTHS[i];
    });
    doc.rect(MARGIN, y, ITEM_TOTAL_W, headerHeight).stroke(NAVY);
    return y + headerHeight;
  }

  function rowHeightFor(values) {
    let lines = 1;
    values.forEach((v, i) => {
      const n = Math.max(1, Math.ceil(
        doc.heightOfString(String(v), { width: ITEM_WIDTHS[i] - 4, lineHeight }) / lineHeight
      ));
      lines = Math.max(lines, n);
    });
    return lines * lineHeight + 4;
  }

  let y = drawHeader(startY);

  items.forEach((d, i) => {
    const values = [
      String(i + 1),
      d.ItemCode || '',
      d.Description || '',
      d.N ?? '',
      d.L ?? '',
      d.B ?? '',
      d.D ?? '',
      fmt(d.Qty, 3),
      d.Unit || '',
      fmt(d.Rate),
      fmt(d.Amount),
    ];
    const rh = rowHeightFor(values);

    if (y + rh > CONTENT_BOTTOM) {
      doc.addPage();
      y = drawHeader(MARGIN);
    }

    doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).stroke('#cbd5e1');
    if (i % 2 === 1) {
      doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).fill('#f8fafc');
      doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).stroke('#cbd5e1');
    }
    let x = MARGIN;
    values.forEach((v, j) => {
      doc.fillColor('#0f172a').font('Helvetica').fontSize(T_TABLE);
      const align = j === 2 ? 'left' : (j === 7 || j === 9 || j === 10 ? 'right' : 'center');
      doc.text(String(v), x + 2, y + 2, { width: ITEM_WIDTHS[j] - 4, align, lineHeight });
      x += ITEM_WIDTHS[j];
    });
    y += rh;
  });

  return y;
}

/* ------------------------------------------------------------------ */
/* Abstract section                                                    */
/* ------------------------------------------------------------------ */
function renderAbstractSection(doc, { header, locNames, abstract, genStamp, qrBuffer, y }) {
  const civilTotal = abstract ? Number(abstract.CivilTotal) : 0;
  const materialTotal = abstract ? Number(abstract.MaterialTotal) : 0;
  const costOfEstimate = abstract ? Number(abstract.CostOfEstimate) : civilTotal + materialTotal;
  const lsProvision = abstract ? Number(abstract.LSProvision) : 0;
  const additionalItemsTotal = abstract ? Number(abstract.AdditionalItemsTotal || 0) : 0;
  const gstPercent = abstract && abstract.GSTPercent != null ? Number(abstract.GSTPercent) : Number(header.GSTPercent || 18);
  const gst = abstract ? Number(abstract.GST) : costOfEstimate * gstPercent / 100;
  const subtotal = abstract && abstract.Subtotal != null ? Number(abstract.Subtotal) : costOfEstimate + gst;
  const grandTotal = abstract ? Number(abstract.GrandTotal) : subtotal + additionalItemsTotal + lsProvision;

  y = ensureSpace(doc, y, 92);
  doc.font('Helvetica-Bold').fontSize(T_SECTION_TITLE).fillColor(NAVY)
    .text('GENERAL ABSTRACT', MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 10;
  y = renderSectionInfo(doc, { header, locNames, y });

  const absWidths = [40, 360, 149];
  const absTotal = absWidths.reduce((a, b) => a + b, 0);
  const headerH = 15;

  doc.rect(MARGIN, y, absTotal, headerH).fill(NAVY);
  ['Sl.No', 'Description', 'Amount (Rs.)'].forEach((h, i) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.8);
    const x0 = MARGIN + absWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, x0 + 2, y + 4, { width: absWidths[i] - 4, align: i === 2 ? 'right' : 'center' });
  });
  doc.rect(MARGIN, y, absTotal, headerH).stroke(NAVY);
  y += headerH;

  const rows = [
    { cells: ['', 'Part-I : Working Items', ''], bold: true, section: true },
    { cells: ['1', 'Cost of Material', inr(materialTotal)], bold: false },
    { cells: ['2', 'Cost of Civil Work', inr(civilTotal)], bold: false },
    { cells: ['', 'Cost of Estimate : Part-I', inr(costOfEstimate)], bold: true },
    { cells: ['', 'Part-II : Additional Items', ''], bold: true, section: true },
    { cells: ['3', `GST @ ${gstPercent}%`, inr(gst)], bold: false },
    { cells: ['4', 'Additional Items', inr(additionalItemsTotal)], bold: false },
    { cells: ['', 'Part-III : LS Provisions', ''], bold: true, section: true },
    { cells: ['5', 'LS unforeseen items and rounding off', inr(lsProvision)], bold: false },
    { cells: ['', '', ''], bold: false, spacer: true },
    { cells: ['', 'Grand Total (Part-I + Part-II + Part-III)', inr(grandTotal)], bold: true, grand: true },
  ];

  for (const rd of rows) {
    if (y > CONTENT_BOTTOM - 34) {
      doc.addPage();
      y = MARGIN;
    }
    if (rd.spacer) { y += 8; continue; }
    if (rd.section) doc.rect(MARGIN, y, absTotal, headerH).fill(LIGHT_GRAY);
    if (rd.grand) doc.rect(MARGIN, y, absTotal, headerH).fill(NAVY);
    doc.rect(MARGIN, y, absTotal, headerH).stroke('#cbd5e1');

    let x = MARGIN;
    rd.cells.forEach((v, i) => {
      const color = rd.grand ? '#ffffff' : (rd.section ? NAVY : '#0f172a');
      doc.fillColor(color).font(rd.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
      const align = i === 2 ? 'right' : (i === 0 ? 'center' : 'left');
      doc.text(String(v), x + 3, y + 4, { width: absWidths[i] - 6, align });
      x += absWidths[i];
    });
    y += headerH;
  }

  y += 8;
  y = ensureSpace(doc, y, 16);
  doc.font('Helvetica').fontSize(7).fillColor('#0f172a')
    .text(`(Rupees ${numberToWords(grandTotal)})`, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y += 12;

  y = ensureSpace(doc, y, 96);
  const sigW = 150;
  const gap = (CONTENT_WIDTH - 3 * sigW) / 2;
  const labels = ['Prepared by', 'Checked by', 'Approved by'];
  const roles = ['Manager / Engineer', 'DGM (Works)', 'GM (Works)'];
  let sx = MARGIN;
  labels.forEach((l, i) => {
    doc.moveTo(sx, y).lineTo(sx + sigW, y).lineWidth(0.8).strokeColor('#475569').stroke();
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(6.5)
      .text(l, sx, y + 5, { width: sigW, align: 'center' });
    doc.font('Helvetica').fontSize(5.8).fillColor('#64748b')
      .text(roles[i], sx, y + 14, { width: sigW, align: 'center' });
    sx += sigW + gap;
  });

  const qrSize = 70;
  doc.image(qrBuffer, PAGE_WIDTH - MARGIN - qrSize, y + 3, { width: qrSize });
  doc.font('Helvetica').fontSize(5.8).fillColor('#64748b')
    .text('Scan to verify', PAGE_WIDTH - MARGIN - qrSize, y + qrSize + 6, { width: qrSize, align: 'center' });
}

/* ------------------------------------------------------------------ */
/* Page chrome: watermark + footer (derived page numbers, never hard-  */
/* coded totals)                                                       */
/* ------------------------------------------------------------------ */
function renderPageChrome(doc, { genStamp, status }) {
  const watermark = watermarkFor(status);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    if (watermark) {
      doc.save();
      doc.rotate(-38, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] });
      doc.fillOpacity(0.045).fillColor('#0f172a').font('Helvetica-Bold').fontSize(64)
        .text(watermark, PAGE_WIDTH / 2 - 160, PAGE_HEIGHT / 2 - 30, { width: 320, align: 'center' });
      doc.restore();
      doc.fillOpacity(1);
    }

    doc.lineWidth(0.6).strokeColor('#cbd5e1')
      .moveTo(MARGIN, FOOTER_LINE_Y).lineTo(PAGE_WIDTH - MARGIN, FOOTER_LINE_Y).stroke();

    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text(
      `HMWSSB Works Management System  |  Generated on ${genStamp}`,
      MARGIN, FOOTER_LINE_Y + 5, { width: CONTENT_WIDTH * 0.6, lineBreak: false }
    );
    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`,
      PAGE_WIDTH - MARGIN - 90, FOOTER_LINE_Y + 5, { width: 90, align: 'right', lineBreak: false }
    );
  }
}

module.exports = { generateCompletePDF };