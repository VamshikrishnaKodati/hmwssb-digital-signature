const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { numberToWords } = require('./numberToWords');
const { inr, collect } = require('./format');

const TEMPLATE_DIR = path.join(__dirname, '../templates');
const MARGIN = 45;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const CONTENT_BOTTOM = PAGE_HEIGHT - 67;

const NAVY = '#1a237e';
const LIGHT_GRAY = '#f2f2f2';

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

  renderCover(doc, { header, abstract, locNames, createdBy, genStamp });
  doc.addPage();
  renderItemsSection(doc, { header, title: 'ESTIMATE FOR CIVIL WORK', items: civil });
  doc.addPage();
  renderItemsSection(doc, { header, title: 'ESTIMATE FOR MATERIAL', items: material });
  doc.addPage();
  renderAbstractSection(doc, { header, abstract, genStamp, qrBuffer });

  renderPageChrome(doc, { genStamp, status: header.Status });

  return collect(doc);
}

/* ------------------------------------------------------------------ */
/* Cover page                                                          */
/* ------------------------------------------------------------------ */
function renderCover(doc, { header, abstract, locNames, createdBy, genStamp }) {
  let y = 55;

  try {
    const logoPath = path.join(TEMPLATE_DIR, 'hmwssb-logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (PAGE_WIDTH - 95) / 2, y, { width: 95 });
      y += 95 + 8;
    }
  } catch (_) { /* logo optional */ }

  doc.fillColor('#0f2a52').font('Helvetica-Bold').fontSize(17).text('Government of Telangana', MARGIN, y, {
    align: 'center', width: CONTENT_WIDTH,
  });
  y = doc.y + 4;
  doc.fillColor(NAVY).fontSize(11.5).text(
    'HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD',
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
  y = doc.y + 2;
  doc.fillColor('#5a6a7f').fontSize(9).font('Helvetica').text(
    'Works Management System',
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
  y = doc.y + 10;

  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(1.2).strokeColor(NAVY).stroke();
  y += 22;

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text('ABSTRACT OF ESTIMATE', MARGIN, y, {
    align: 'center', width: CONTENT_WIDTH,
  });
  y = doc.y + 4;
  doc.fillColor('#0f172a').fontSize(12).text(
    `${header.EstimateNo || header.WorkID || ''}   |   Financial Year ${header.FinancialYear || ''}`,
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
  y = doc.y + 18;

  const rows = [
    ['Estimate ID', header.EstimateNo || header.WorkID || '-'],
    ['Name of Work', header.NameOfWork || '-'],
    ['Work Category', header.WorkCategory || '-'],
    ['Location', locationLine(locNames) || '-'],
    ['Status', header.Status || '-'],
    ['Version', String(header.Version || 1)],
    ['Prepared By', createdBy ? `${createdBy.Name} (${createdBy.Designation})` : '-'],
    ['Prepared Date', header.CreatedDate ? new Date(header.CreatedDate).toLocaleDateString('en-IN') : '-'],
  ];

  y = drawKeyValueTable(doc, rows, y, 24);

  y += 14;
  const grandTotal = abstract ? Number(abstract.GrandTotal) : 0;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(
    `Grand Total : ${inr(grandTotal)}`,
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
  y = doc.y + 16;
  doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(
    `(Rupees ${numberToWords(grandTotal)})`,
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
  y = doc.y + 26;

  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  y += 12;
  doc.fillColor('#64748b').fontSize(8).text(
    `This document is generated by the HMWSSB Works Management System on ${genStamp}.`,
    MARGIN, y, { align: 'center', width: CONTENT_WIDTH }
  );
}

/* ------------------------------------------------------------------ */
/* Items section (Civil / Material)                                    */
/* ------------------------------------------------------------------ */
const ITEM_HEADERS = ['S.No', 'Item Code', 'Description of Work', 'Formula', 'N', 'L', 'B', 'D', 'Qty', 'Unit', 'Rate', 'Amount'];
const ITEM_WIDTHS = [20, 52, 140, 26, 20, 20, 20, 20, 34, 26, 42, 46];
const ITEM_TOTAL_W = ITEM_WIDTHS.reduce((a, b) => a + b, 0);
const ROW_PAD = 5;

function renderItemsSection(doc, { header, title, items }) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
    .text(title, MARGIN, 40, { align: 'center', width: CONTENT_WIDTH });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
    .text(`Name of Work : ${header.NameOfWork || ''}`, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
  let y = doc.y + 10;

  if (items.length === 0) {
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text('No items in this category.', MARGIN, y, { width: CONTENT_WIDTH });
    return;
  }

  const total = items.reduce((s, d) => s + Number(d.Amount || 0), 0);
  y = drawItemTable(doc, { title, items, startY: y });

  y += 10;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
    .text('Total : ' + inr(total), MARGIN, y, { align: 'right', width: CONTENT_WIDTH });
  y = doc.y + 4;
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
    .text(`(Rupees ${numberToWords(total)})`, MARGIN, y, { width: CONTENT_WIDTH });
}

function drawItemTable(doc, { title, items, startY }) {
  const headerHeight = 16;
  const lineHeight = 9;

  function drawHeader(y) {
    doc.rect(MARGIN, y, ITEM_TOTAL_W, headerHeight).fill(NAVY);
    let x = MARGIN;
    ITEM_HEADERS.forEach((h, i) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5);
      const align = i === 2 ? 'left' : 'center';
      doc.text(h, x + 2, y + 4, { width: ITEM_WIDTHS[i] - 4, align, lineHeight });
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
    return lines * lineHeight + ROW_PAD;
  }

  let y = drawHeader(startY);

  items.forEach((d, i) => {
    const values = [
      String(i + 1),
      d.ItemCode || '',
      d.Description || '',
      d.FormulaType || '',
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
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
        .text(title, MARGIN, 40, { align: 'center', width: CONTENT_WIDTH });
      y = drawHeader(doc.y + 10);
    }

    doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).stroke('#cbd5e1');
    if (i % 2 === 1) {
      doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).fill('#f8fafc');
      doc.rect(MARGIN, y, ITEM_TOTAL_W, rh).stroke('#cbd5e1');
    }
    let x = MARGIN;
    values.forEach((v, j) => {
      doc.fillColor('#0f172a').font('Helvetica').fontSize(7);
      const align = j === 1 || j === 2 ? 'left' : (j === 0 || j === 9 ? 'center' : 'right');
      doc.text(String(v), x + 2, y + ROW_PAD / 2, {
        width: ITEM_WIDTHS[j] - 4, align, lineHeight,
      });
      x += ITEM_WIDTHS[j];
    });
    y += rh;
  });

  return y;
}

/* ------------------------------------------------------------------ */
/* Abstract section                                                    */
/* ------------------------------------------------------------------ */
function renderAbstractSection(doc, { header, abstract, genStamp, qrBuffer }) {
  const civilTotal = abstract ? Number(abstract.CivilTotal) : 0;
  const materialTotal = abstract ? Number(abstract.MaterialTotal) : 0;
  const costOfEstimate = abstract ? Number(abstract.CostOfEstimate) : civilTotal + materialTotal;
  const lsProvision = abstract ? Number(abstract.LSProvision) : 0;
  const additionalItemsTotal = abstract ? Number(abstract.AdditionalItemsTotal || 0) : 0;
  const gstPercent = abstract && abstract.GSTPercent != null ? Number(abstract.GSTPercent) : Number(header.GSTPercent || 18);
  const gst = abstract ? Number(abstract.GST) : costOfEstimate * gstPercent / 100;
  const subtotal = abstract && abstract.Subtotal != null ? Number(abstract.Subtotal) : costOfEstimate + gst;
  const grandTotal = abstract ? Number(abstract.GrandTotal) : subtotal + additionalItemsTotal + lsProvision;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
    .text('GENERAL ABSTRACT', MARGIN, 40, { align: 'center', width: CONTENT_WIDTH });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
    .text(`Name of Work : ${header.NameOfWork || ''}`, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
  let y = doc.y + 10;

  const absWidths = [46, 330, 129];
  const absTotal = absWidths.reduce((a, b) => a + b, 0);
  const headerH = 18;

  doc.rect(MARGIN, y, absTotal, headerH).fill(NAVY);
  ['Sl.No', 'Description', 'Amount (Rs.)'].forEach((h, i) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    const x0 = MARGIN + absWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, x0 + 2, y + 5, { width: absWidths[i] - 4, align: i === 2 ? 'right' : 'center' });
  });
  doc.rect(MARGIN, y, absTotal, headerH).stroke(NAVY);
  y += headerH;

  const rows = [
    { cells: ['', 'PART-I : WORKING ITEMS', ''], bold: true, section: true },
    { cells: ['1', 'Cost of Material', inr(materialTotal)], bold: false },
    { cells: ['2', 'Cost of Civil Work', inr(civilTotal)], bold: false },
    { cells: ['', 'Cost of Estimate (Civil + Material)', inr(costOfEstimate)], bold: true },
    { cells: ['', 'PART-II : ADDITIONAL ITEMS', ''], bold: true, section: true },
    { cells: ['3', `GST @ ${gstPercent}%`, inr(gst)], bold: false },
    { cells: ['4', 'Additional Items', inr(additionalItemsTotal)], bold: false },
    { cells: ['', 'PART-III : LS PROVISIONS', ''], bold: true, section: true },
    { cells: ['5', 'LS unforeseen items and rounding off', inr(lsProvision)], bold: false },
    { cells: ['', '', ''], bold: false, spacer: true },
    { cells: ['', 'GRAND TOTAL (Part-I + Part-II + Part-III)', inr(grandTotal)], bold: true, grand: true },
  ];

  for (const rd of rows) {
    if (y > CONTENT_BOTTOM - 40) {
      doc.addPage();
      y = 55;
    }
    if (rd.spacer) { y += 8; continue; }
    if (rd.section) doc.rect(MARGIN, y, absTotal, headerH).fill(LIGHT_GRAY);
    if (rd.grand) doc.rect(MARGIN, y, absTotal, headerH).fill(NAVY);
    doc.rect(MARGIN, y, absTotal, headerH).stroke('#cbd5e1');

    let x = MARGIN;
    rd.cells.forEach((v, i) => {
      const color = rd.grand ? '#ffffff' : (rd.section ? NAVY : '#0f172a');
      doc.fillColor(color).font(rd.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      const align = i === 2 ? 'right' : (i === 0 ? 'center' : 'left');
      doc.text(String(v), x + 3, y + 5, { width: absWidths[i] - 6, align });
      x += absWidths[i];
    });
    y += headerH;
  }

  y += 8;
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
    .text(`(Rupees ${numberToWords(grandTotal)})`, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
  y = doc.y + 24;

  const sigW = 150;
  const gap = (CONTENT_WIDTH - 3 * sigW) / 2;
  const labels = ['Prepared by', 'Checked by', 'Approved by'];
  let sx = MARGIN;
  labels.forEach((l) => {
    doc.moveTo(sx, y).lineTo(sx + sigW, y).lineWidth(0.8).strokeColor('#475569').stroke();
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8.5)
      .text(l, sx, y + 6, { width: sigW, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
      .text(l === 'Prepared by' ? 'Manager / Engineer' : l === 'Checked by' ? 'DGM (Works)' : 'GM (Works)', sx, y + 18, { width: sigW, align: 'center' });
    sx += sigW + gap;
  });

  const qrSize = 78;
  doc.image(qrBuffer, PAGE_WIDTH - MARGIN - qrSize, y + 6, { width: qrSize });
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
    .text('Scan to verify', PAGE_WIDTH - MARGIN - qrSize, y + qrSize + 8, { width: qrSize, align: 'center' });
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */
function locationLine(locNames) {
  const parts = [];
  if (locNames.region) parts.push(`Region: ${locNames.region}`);
  if (locNames.zone) parts.push(`Zone: ${locNames.zone}`);
  if (locNames.division) parts.push(`Division: ${locNames.division}`);
  if (locNames.circle) parts.push(`Circle: ${locNames.circle}`);
  if (locNames.ward) parts.push(`Ward: ${locNames.ward}`);
  return parts.join(',  ');
}

function drawKeyValueTable(doc, rows, startY, rowHeight) {
  const labelW = 150;
  const valueW = CONTENT_WIDTH - labelW;
  let y = startY;

  rows.forEach(([label, value], i) => {
    doc.rect(MARGIN, y, labelW, rowHeight).fill(LIGHT_GRAY);
    doc.rect(MARGIN, y, labelW, rowHeight).stroke('#cbd5e1');
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5)
      .text(label, MARGIN + 6, y + (rowHeight - 10) / 2, { width: labelW - 12, lineBreak: false });

    doc.rect(MARGIN + labelW, y, valueW, rowHeight).stroke('#cbd5e1');
    if (i % 2 === 1) doc.rect(MARGIN + labelW, y, valueW, rowHeight).fill('#fafbfc');
    doc.fillColor('#0f172a').font('Helvetica').fontSize(8.5)
      .text(String(value), MARGIN + labelW + 6, y + (rowHeight - 10) / 2, { width: valueW - 12, lineBreak: false });

    y += rowHeight;
  });
  return y;
}

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
      .moveTo(MARGIN, PAGE_HEIGHT - 59).lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 59).stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
    doc.text(
      `HMWSSB Works Management System  |  Generated on ${genStamp}`,
      MARGIN, PAGE_HEIGHT - 55, { width: CONTENT_WIDTH * 0.6, lineBreak: false }
    );
    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`,
      PAGE_WIDTH - MARGIN - 90, PAGE_HEIGHT - 55, { width: 90, align: 'right', lineBreak: false }
    );
  }
}

module.exports = { generateCompletePDF };
