const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { inr, fmtDate } = require('./format');
const { numberToWords } = require('./numberToWords');

const TEMPLATE_DIR = path.join(__dirname, '../templates');

/* ------------------------------------------------------------------ */
/* Palette & typography                                                */
/* ------------------------------------------------------------------ */
const C = {
  navy: 'FF1A237E',
  dark: 'FF0F172A',
  slate: 'FF334155',
  muted: 'FF64748B',
  border: 'FFCBD5E1',
  lightGray: 'FFF2F2F2',
  zebra: 'FFF8FAFC',
  totalBlue: 'FFE8F0FE',
  white: 'FFFFFFFF',
};

const F = {
  normal: { name: 'Calibri', size: 10 },
  small: { name: 'Calibri', size: 9 },
  bold: { name: 'Calibri', size: 10, bold: true },
  label: { name: 'Calibri', size: 9, bold: true },
  title: { name: 'Calibri', size: 15, bold: true, color: { argb: C.white } },
  band: { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } },
  header: { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } },
};

const COL_WIDTHS = [10, 16, 45, 12, 10, 10, 10, 10, 12, 12, 16, 18];
const COLS = 12;
const FREEZE_ROWS = 11;

const thin = { style: 'thin', color: { argb: C.border } };
const medium = { style: 'medium', color: { argb: C.navy } };
const doub = { style: 'double', color: { argb: C.navy } };

const BORDER_ALL = { top: thin, left: thin, bottom: thin, right: thin };
const BORDER_HEADER = { top: thin, bottom: medium, left: thin, right: thin };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  let h = dt.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${fmtDate(d)} ${h}:${String(dt.getMinutes()).padStart(2, '0')} ${ampm}`;
}

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyColWidths(ws, widths) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function setupSheet(ws, tab) {
  ws.properties.tabColor = { argb: tab };
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.paperSize = 9; // A4
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.margins = { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55, header: 0.3, footer: 0.3 };
  ws.pageSetup.printTitlesRow = `1:${FREEZE_ROWS}`;
  ws.views = [{ state: 'frozen', ySplit: FREEZE_ROWS, showGridLines: false }];
  ws.headerFooter = {
    oddFooter: '&L&"Calibri"&8HMWSSB Works Management System&R&"Calibri,Bold"&8Page &P of &N',
  };
  applyColWidths(ws, COL_WIDTHS);
}

function mergeRow(ws, row, c1, c2, value, font, align, fill, border) {
  const m = ws.getCell(row, c1);
  m.value = value;
  if (font) m.font = font;
  if (align) m.alignment = align;
  if (fill) m.fill = solid(fill);
  if (border) m.border = border;
  if (c1 < c2) ws.mergeCells(row, c1, row, c2);
  return m;
}

function writeSection(ws, row, title) {
  ws.getRow(row).height = 20;
  mergeRow(ws, row, 1, COLS, title, F.band, { horizontal: 'center', vertical: 'middle' }, C.navy, {
    top: medium, bottom: thin, left: thin, right: thin,
  });
  return row + 1;
}

function writeKVBox(ws, row, pairs) {
  pairs.forEach(([label, value]) => {
    ws.getRow(row).height = 18;
    mergeRow(ws, row, 1, 4, label, F.label, { horizontal: 'center', vertical: 'middle' }, C.lightGray, BORDER_ALL);
    mergeRow(ws, row, 5, COLS, value, F.normal, { horizontal: 'left', vertical: 'middle' }, null, BORDER_ALL);
    row++;
  });
  return row;
}

function writeAmountInWords(ws, row, total) {
  ws.getRow(row).height = 16;
  mergeRow(ws, row, 1, COLS, 'Amount in Words :', F.bold, { horizontal: 'left', vertical: 'middle' }, C.lightGray, BORDER_ALL);
  row++;
  const words = `Rupees ${numberToWords(total)}`;
  const lines = Math.max(1, Math.ceil(words.length / 95));
  ws.getRow(row).height = Math.max(18, lines * 14 + 4);
  mergeRow(ws, row, 1, COLS, words, F.small, { horizontal: 'left', vertical: 'middle', wrapText: true }, null, BORDER_ALL);
  return row + 1;
}

function writeSignatureBand(ws, row) {
  const cols = [[1, 3], [4, 6], [7, 9], [10, 12]];
  const labels = ['Prepared By', 'Checked By', 'Verified By', 'Approved By'];
  const roles = ['Manager / Engineer', 'DGM (Works)', 'GM (Works)', 'Chief Engineer (Works)'];

  ws.getRow(row).height = 20;
  cols.forEach(([c1, c2], i) => {
    const b = { top: medium };
    if (i === 0) b.left = thin;
    if (i === cols.length - 1) b.right = thin;
    mergeRow(ws, row, c1, c2, '', F.normal, { horizontal: 'center', vertical: 'middle' }, null, b);
  });
  row++;

  ws.getRow(row).height = 15;
  cols.forEach(([c1, c2], i) => {
    mergeRow(ws, row, c1, c2, labels[i], F.bold, { horizontal: 'center', vertical: 'middle' });
  });
  row++;

  ws.getRow(row).height = 14;
  cols.forEach(([c1, c2], i) => {
    mergeRow(ws, row, c1, c2, roles[i], { ...F.small, color: { argb: C.muted } }, { horizontal: 'center', vertical: 'middle' });
  });
  return row + 1;
}

/* ------------------------------------------------------------------ */
/* Header block (rows 1-11)                                            */
/* ------------------------------------------------------------------ */
function writeInfoCard(ws, startRow, pairs) {
  const bands = [[[1, 4], [5, 8]], [[9, 10], [11, 12]]];
  for (let i = 0; i < Math.ceil(pairs.length / 2); i++) {
    const row = startRow + i;
    ws.getRow(row).height = 16;
    bands.forEach(([lbl, val], gi) => {
      const p = pairs[i * 2 + gi];
      if (!p) return;
      mergeRow(ws, row, lbl[0], lbl[1], p[0], F.label, { horizontal: 'center', vertical: 'middle' }, C.lightGray, BORDER_ALL);
      mergeRow(ws, row, val[0], val[1], p[1], F.small, { horizontal: 'left', vertical: 'middle' }, null, BORDER_ALL);
    });
  }
}

function writeHeader(ws, { estimate, locNames, createdBy, title }) {
  ws.getRow(1).height = 30;
  mergeRow(ws, 1, 2, COLS, 'HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD',
    { name: 'Calibri', size: 12, bold: true, color: { argb: C.navy } },
    { horizontal: 'left', vertical: 'middle' });
  ws.getRow(2).height = 15;
  mergeRow(ws, 2, 2, COLS, 'Government of Telangana   |   Works Management System',
    { ...F.small, color: { argb: C.muted } },
    { horizontal: 'left', vertical: 'middle' });
  ws.getRow(3).height = 5;

  ws.getRow(4).height = 28;
  mergeRow(ws, 4, 1, COLS, title, F.title,
    { horizontal: 'center', vertical: 'middle' }, C.navy,
    { top: medium, bottom: medium, left: thin, right: thin });

  ws.getRow(5).height = 16;
  mergeRow(ws, 5, 1, COLS, `Name of Work : ${estimate.NameOfWork || ''}`, F.bold,
    { horizontal: 'left', vertical: 'middle' });

  const date = fmtDate(estimate.CreatedDate);
  const pairs = [
    ['Estimate No', estimate.EstimateNo || estimate.WorkID || '-'],
    ['Date', date || '-'],
    ['Financial Year', estimate.FinancialYear || '-'],
    ['Status', estimate.Status || '-'],
    ['Region', locNames.region || '-'],
    ['Zone', locNames.zone || '-'],
    ['Division', locNames.division || '-'],
    ['Circle', locNames.circle || '-'],
    ['Ward', locNames.ward || '-'],
    ['Prepared By', createdBy ? `${createdBy.Name} (${createdBy.Designation})` : '-'],
  ];
  writeInfoCard(ws, 6, pairs);

  ws.getRow(11).height = 4;
}

/* ------------------------------------------------------------------ */
/* Azamabad-style item sheets (Civil / Material)                       */
/* Matches Azamabad.xls reference: Times New Roman 12, thin borders,   */
/* portrait fit-to-1x1, merged title + "Name of Work" rows, meta line. */
/* ------------------------------------------------------------------ */
const AZ_FONT = { name: 'Times New Roman', size: 12 };
const AZ_FONT_B = { name: 'Times New Roman', size: 12, bold: true };
const AZ_HEADERS = {
  civil: ['S.No', 'Description of Work', 'N', 'L', 'B', 'D', 'Qty', 'Rate', 'Unit', 'Amount'],
  material: ['S.No', 'Description of Work', 'No', 'L', 'B', 'D', 'Qty', 'Rate', 'Unit', 'Amount'],
};

function azNum(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function azBorder(top, bottom, left, right) {
  const b = {};
  if (top === 'thin') b.top = { style: 'thin' };
  else if (top === 'hair') b.top = { style: 'hair' };
  if (bottom === 'thin') b.bottom = { style: 'thin' };
  else if (bottom === 'hair') b.bottom = { style: 'hair' };
  if (left === 'thin') b.left = { style: 'thin' };
  if (right === 'thin') b.right = { style: 'thin' };
  return b;
}

function azMetaLine(estimate, locNames) {
  const parts = [];
  if (estimate && estimate.CreatedDate) parts.push(`Date: ${fmtDate(estimate.CreatedDate)}`);
  if (estimate && estimate.FinancialYear) parts.push(`Financial Year: ${estimate.FinancialYear}`);
  const loc = [];
  if (locNames && locNames.region) loc.push(`Region: ${locNames.region}`);
  if (locNames && locNames.zone) loc.push(`Zone: ${locNames.zone}`);
  if (locNames && locNames.division) loc.push(`Division: ${locNames.division}`);
  if (locNames && locNames.circle) loc.push(`Circle: ${locNames.circle}`);
  if (locNames && locNames.ward) loc.push(`Ward: ${locNames.ward}`);
  if (loc.length) parts.push(loc.join(', '));
  return parts.join('   |   ');
}

function writeAzamabadItemsSheet(wb, cfg) {
  const { name, title, headerLabels, items, ctx, totalLabel, widths, scale, margins } = cfg;
  const { estimate, locNames } = ctx;
  const ws = wb.addWorksheet(name, {});
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 1;
  ws.pageSetup.scale = scale;
  ws.pageSetup.margins = margins;
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ showGridLines: false }];

  ws.mergeCells(1, 1, 1, 10);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = AZ_FONT_B;
  t.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(2, 1, 2, 10);
  const n = ws.getCell(2, 1);
  n.value = {
    richText: [
      { text: 'Name of Work: ', font: AZ_FONT },
      { text: (estimate && estimate.NameOfWork) || '', font: AZ_FONT_B },
    ],
  };
  n.font = AZ_FONT;
  n.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(2).height = Math.max(36, Math.ceil(((estimate && estimate.NameOfWork) || '').length / 80) * 18 + 8);

  const meta = azMetaLine(estimate, locNames);
  if (meta) {
    ws.mergeCells(3, 1, 3, 10);
    const m = ws.getCell(3, 1);
    m.value = meta;
    m.font = AZ_FONT;
    m.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = Math.max(18, Math.ceil(meta.length / (widths.reduce((a, b) => a + b, 0) * 0.8)) * 15 + 4);
  }

  ws.getRow(4).height = 18;
  headerLabels.forEach((h, i) => {
    const c = ws.getCell(4, i + 1);
    c.value = h;
    c.font = AZ_FONT_B;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = azBorder('thin', 'thin', 'thin', 'thin');
  });

  let r = 5;
  let total = 0;
  (items || []).forEach((d) => {
    const amt = num(d.Amount);
    total += amt;
    const values = [
      r - 4,
      d.Description || '',
      azNum(d.N), azNum(d.L), azNum(d.B), azNum(d.D),
      num(d.Qty), num(d.Rate), d.Unit || '', amt,
    ];
    const aligns = [
      { horizontal: 'center', vertical: 'middle' },
      { horizontal: 'justify', vertical: 'middle', wrapText: true },
      { vertical: 'middle' }, { vertical: 'middle' }, { vertical: 'middle' }, { vertical: 'middle' },
      { vertical: 'middle' }, { vertical: 'middle' }, { vertical: 'middle' }, { vertical: 'middle' },
    ];
    values.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      c.font = AZ_FONT;
      c.alignment = aligns[ci];
      c.border = azBorder('thin', 'thin', 'thin', 'thin');
    });
    ws.getRow(r).height = Math.max(31, Math.ceil((d.Description || '').length / 37) * 14 + 6);
    r++;
  });

  ws.mergeCells(r, 2, r, 8);
  const lbl = ws.getCell(r, 2);
  lbl.value = totalLabel;
  lbl.font = AZ_FONT;
  lbl.alignment = { horizontal: 'right', vertical: 'middle' };
  const at = ws.getCell(r, 10);
  at.value = total;
  at.font = AZ_FONT;
  at.alignment = { vertical: 'middle' };
  for (let c = 1; c <= 10; c++) {
    const cell = ws.getCell(r, c);
    cell.border = azBorder('thin', 'thin', 'thin', 'thin');
    cell.font = AZ_FONT;
  }
  ws.getRow(r).height = 18;

  return ws;
}

/* ------------------------------------------------------------------ */
/* Azamabad-style General Abstract                                     */
/* Matches the "abs" sheet of Azamabad.xls: Tahoma 12/16, Part I/II/III*/
/* section layout, hair/thin borders, "(Rupees ... Only)" closing row. */
/* ------------------------------------------------------------------ */
function writeAzamabadAbstractSheet(wb, ctx, items) {
  const { estimate, abstract, locNames } = ctx;
  const ws = wb.addWorksheet('General Abstract', {});
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.margins = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
  [6.8, 51.8, 4.7, 23.5].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ showGridLines: false }];

  const civilTotal = abstract && abstract.CivilTotal != null ? num(abstract.CivilTotal)
    : (items || []).filter(i => (i.Category || '').toLowerCase() === 'civil').reduce((s, d) => s + num(d.Amount), 0);
  const materialTotal = abstract && abstract.MaterialTotal != null ? num(abstract.MaterialTotal)
    : (items || []).filter(i => (i.Category || '').toLowerCase() === 'material').reduce((s, d) => s + num(d.Amount), 0);
  const costOfEstimate = abstract && abstract.CostOfEstimate != null ? num(abstract.CostOfEstimate) : civilTotal + materialTotal;
  const gstPercent = abstract && abstract.GSTPercent != null ? num(abstract.GSTPercent)
    : (estimate && estimate.GSTPercent != null ? num(estimate.GSTPercent) : 18);
  const gst = abstract && abstract.GST != null ? num(abstract.GST) : num(costOfEstimate * gstPercent / 100);
  const lsProvision = abstract && abstract.LSProvision != null ? num(abstract.LSProvision)
    : (estimate && estimate.LSProvision != null ? num(estimate.LSProvision) : 0);
  const additionalItemsTotal = abstract && abstract.AdditionalItemsTotal != null ? num(abstract.AdditionalItemsTotal) : 0;
  const grandTotal = abstract && abstract.GrandTotal != null ? num(abstract.GrandTotal) : costOfEstimate + gst + additionalItemsTotal + lsProvision;
  const words = `(Rupees ${numberToWords(grandTotal)})`;

  const ta = (bold) => ({ name: 'Tahoma', size: 12, ...(bold ? { bold: true } : {}) });
  const B = (t, b, l, r) => azBorder(t, b, l, r);

  ws.mergeCells(1, 1, 1, 4);
  const t = ws.getCell(1, 1);
  t.value = 'GENERAL ABSTRACT';
  t.font = { name: 'Tahoma', size: 16, bold: true };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(2, 1, 2, 4);
  const n = ws.getCell(2, 1);
  n.value = {
    richText: [
      { text: 'Name of Work: ', font: { name: 'Tahoma', size: 12 } },
      { text: (estimate && estimate.NameOfWork) || '', font: { name: 'Tahoma', size: 12, bold: true } },
    ],
  };
  n.font = { name: 'Tahoma', size: 12 };
  n.alignment = { horizontal: 'justify', vertical: 'top', wrapText: true };
  ws.getRow(2).height = Math.max(47.3, Math.ceil(((estimate && estimate.NameOfWork) || '').length / 75) * 15 + 4);

  const meta = azMetaLine(estimate, locNames);
  if (meta) {
    ws.mergeCells(3, 1, 3, 4);
    const m = ws.getCell(3, 1);
    m.value = meta;
    m.font = ta(false);
    m.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = Math.max(15, Math.ceil(meta.length / 62) * 15 + 2);
  }

  const rowSpecs = [
    [4, [
      { v: 'Sl.No', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'thin', 'thin', 'thin') },
      { v: 'Description', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'thin', 'thin', 'thin') },
      { v: '', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'thin') },
      { v: 'Amount (₹)', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'thin', null, 'thin') },
    ]],
    [5, [
      { v: '', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'hair', 'thin', 'thin') },
      { v: 'Part-I -  Working Items', bold: true, a: { horizontal: 'left', vertical: 'middle' }, b: B('thin', 'hair', 'thin', 'thin') },
      { v: '', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'hair') },
      { v: '', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B('thin', 'hair', null, 'thin') },
    ]],
    [6, [
      { v: 1, a: { horizontal: 'center', vertical: 'middle' }, b: B(null, 'hair', 'thin', 'thin') },
      { v: 'Cost of Material', a: { horizontal: 'left', vertical: 'middle' }, b: B(null, 'hair', 'thin', 'thin') },
      { v: '', bold: true, a: { horizontal: 'center', vertical: 'middle' }, b: B(null, 'hair') },
      { v: materialTotal, a: { horizontal: 'right', vertical: 'middle' }, b: B(null, 'hair', null, 'thin') },
    ]],
    [7, [
      { v: 2, a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Cost of Civil work', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair') },
      { v: civilTotal, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', null, 'thin') },
    ]],
    [8, [
      { v: '', a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Cost of Estimate : Part-I', bold: true, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair') },
      { v: costOfEstimate, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', null, 'thin') },
    ]],
    [9, [
      { v: '', a: { horizontal: 'center', vertical: 'top', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Part-II - Additional Items', bold: true, a: { horizontal: 'left', vertical: 'middle' }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '', a: { vertical: 'top', wrapText: true }, b: B('hair', 'hair') },
      { v: '', a: { horizontal: 'right', vertical: 'top', wrapText: true }, b: B('hair', 'hair', null, 'thin') },
    ]],
    [10, [
      { v: 3, a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: `GST @ ${gstPercent}%`, a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '₹', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair') },
      { v: gst, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', null, 'thin') },
    ]],
    [11, [
      { v: 4, a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Additional Items', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '₹', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair') },
      { v: additionalItemsTotal, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', null, 'thin') },
    ]],
    [13, [
      { v: '', a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Part-III: LS Provisions', bold: true, a: { horizontal: 'left', vertical: 'middle' }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '', a: { vertical: 'middle', wrapText: true }, b: B('hair', null) },
      { v: '', a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', null, null, 'thin') },
    ]],
    [14, [
      { v: 5, a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'LS unforeseen items and rounding off', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '₹', a: { vertical: 'middle', wrapText: true }, b: B('hair', 'thin', 'thin') },
      { v: lsProvision, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('hair', 'thin', null, 'thin') },
    ]],
    [16, [
      { v: '', a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: 'Grand Total (Part I + II + III)', bold: true, a: { horizontal: 'center', vertical: 'middle', wrapText: true }, b: B('hair', 'hair', 'thin', 'thin') },
      { v: '₹', bold: true, a: { vertical: 'middle', wrapText: true }, b: B(null, 'thin', 'thin') },
      { v: grandTotal, bold: true, a: { horizontal: 'right', vertical: 'middle', wrapText: true }, b: B('thin', 'thin', null, 'thin') },
    ]],
  ];

  rowSpecs.forEach(([rowNum, cells]) => {
    ws.getRow(rowNum).height = 15;
    cells.forEach((c, ci) => {
      const cell = ws.getCell(rowNum, ci + 1);
      cell.value = c.v;
      cell.font = ta(c.bold);
      cell.alignment = c.a;
      cell.border = c.b;
    });
  });

  ws.mergeCells(17, 1, 17, 4);
  const wc = ws.getCell(17, 1);
  wc.value = words;
  wc.font = ta(true);
  wc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  wc.border = B('hair', 'thin', 'thin', 'thin');
  ws.getRow(17).height = Math.max(15, Math.ceil(words.length / 70) * 15 + 2);

  return ws;
}

/* ------------------------------------------------------------------ */
/* Estimate Information (cover page)                                   */
/* ------------------------------------------------------------------ */
function writeInfoSheet(wb, ctx, qrId) {
  const { estimate, abstract, locNames, workflow } = ctx;
  const ws = wb.addWorksheet('Estimate Information', {});
  setupSheet(ws, 'FF64748B');
  writeHeader(ws, { ...ctx, title: 'ESTIMATE INFORMATION' });
  if (qrId != null) ws.addImage(qrId, { tl: { col: 9, row: 3 }, ext: { width: 40, height: 40 } });

  let r = 12;
  r = writeSection(ws, r, 'ESTIMATE DETAILS');
  const details = [
    ['Estimate ID', estimate.EstimateNo || estimate.WorkID || '-'],
    ['Name of Work', estimate.NameOfWork || '-'],
    ['Work Category', estimate.WorkCategory || '-'],
    ['Financial Year', estimate.FinancialYear || '-'],
    ['Version', String(estimate.Version || 1)],
    ['Current Status', estimate.Status || '-'],
    ['Digitally Signed', estimate.IsDigitallySigned ? 'Yes' : 'No'],
    ['Prepared By', ctx.createdBy ? `${ctx.createdBy.Name} (${ctx.createdBy.Designation})` : '-'],
    ['Created Date', fmtDateTime(estimate.CreatedDate)],
    ['Submission Date', estimate.SubmissionDate ? fmtDateTime(estimate.SubmissionDate) : '-'],
  ];
  r = writeKVBox(ws, r, details);

  r += 1;
  r = writeSection(ws, r, 'LOCATION');
  const locRows = [
    ['Region', locNames.region || '-'],
    ['Zone', locNames.zone || '-'],
    ['Division', locNames.division || '-'],
    ['Circle', locNames.circle || '-'],
    ['Ward', locNames.ward || '-'],
  ];
  r = writeKVBox(ws, r, locRows);

  r += 1;
  r = writeSection(ws, r, 'FINANCIAL SUMMARY');
  const civilTotal = abstract ? num(abstract.CivilTotal) : 0;
  const materialTotal = abstract ? num(abstract.MaterialTotal) : 0;
  const costOfEstimate = abstract ? num(abstract.CostOfEstimate) : 0;
  const finRows = [
    ['Cost of Material', inr(materialTotal)],
    ['Cost of Civil Work', inr(civilTotal)],
    ['Cost of Estimate', inr(costOfEstimate)],
    ['GST', inr(abstract ? num(abstract.GST) : 0)],
    ['Additional Items', inr(abstract ? num(abstract.AdditionalItemsTotal || 0) : 0)],
    ['LS Provision', inr(abstract ? num(abstract.LSProvision) : num(estimate.LSProvision))],
    ['Grand Total', inr(abstract ? num(abstract.GrandTotal) : 0)],
  ];
  r = writeKVBox(ws, r, finRows);

  r = writeAmountInWords(ws, r, abstract ? num(abstract.GrandTotal) : 0);

  r += 1;
  r = writeSection(ws, r, 'WORKFLOW SUMMARY');
  const wf = workflow || [];
  const last = wf[wf.length - 1];
  const wfRows = [
    ['Total Workflow Steps', String(wf.length)],
    ['Current Owner', estimate.Status || '-'],
    ['Last Action', last ? last.Action : '-'],
    ['Last Action Date', last && last.DateTime ? fmtDateTime(last.DateTime) : '-'],
  ];
  r = writeKVBox(ws, r, wfRows);

  r += 1;
  writeSignatureBand(ws, r);
  return ws;
}

/* ------------------------------------------------------------------ */
/* Movement History                                                    */
/* ------------------------------------------------------------------ */
const MOVEMENT_HEADERS = [[1, 1, 'S.No'], [2, 3, 'Date & Time'], [4, 6, 'Officer'], [7, 8, 'Designation'], [9, 9, 'Action'], [10, 12, 'Remarks']];

function writeMovementSheet(wb, ctx) {
  const { workflow } = ctx;
  const ws = wb.addWorksheet('Movement History', {});
  setupSheet(ws, 'FF7C3AED');
  writeHeader(ws, { ...ctx, title: 'MOVEMENT HISTORY' });

  const HDR = 12;
  ws.getRow(HDR).height = 22;
  MOVEMENT_HEADERS.forEach(([c1, c2, h]) => {
    mergeRow(ws, HDR, c1, c2, h, F.header, { horizontal: 'center', vertical: 'middle', wrapText: true }, C.navy, BORDER_HEADER);
  });

  const wf = workflow || [];
  let r = HDR + 1;
  wf.forEach((w, i) => {
    ws.getRow(r).height = 18;
    const values = [
      i + 1,
      fmtDateTime(w.DateTime),
      w.FromUserName || '',
      w.FromDesignation || '',
      w.Action || '',
      w.Remarks || '',
    ];
    MOVEMENT_HEADERS.forEach(([c1, c2], ci) => {
      const align = ci === 0 ? { horizontal: 'center', vertical: 'middle' }
        : { horizontal: 'left', vertical: 'middle', wrapText: true };
      mergeRow(ws, r, c1, c2, values[ci], F.small, align, i % 2 === 1 ? C.zebra : null, BORDER_ALL);
    });
    r++;
  });

  if (wf.length === 0) {
    ws.getRow(r).height = 18;
    mergeRow(ws, r, 1, COLS, 'No movement history recorded.', F.small, { horizontal: 'left', vertical: 'middle' }, null, BORDER_ALL);
    r++;
  }

  r += 1;
  writeSignatureBand(ws, r);
  return ws;
}

/* ------------------------------------------------------------------ */
/* Workbook assembly                                                   */
/* ------------------------------------------------------------------ */
function loadLogo(wb) {
  try {
    const logoPath = path.join(TEMPLATE_DIR, 'hmwssb-logo.png');
    if (!fs.existsSync(logoPath)) return null;
    const data = fs.readFileSync(logoPath);
    return wb.addImage({ base64: data.toString('base64'), extension: 'png' });
  } catch (_) {
    return null;
  }
}

async function makeQrImage(wb, estimate, abstract) {
  try {
    const qrPayload = [
      'HMWSSB Estimate',
      `EstimateNo: ${estimate.EstimateNo || estimate.WorkID || ''}`,
      `NameOfWork: ${(estimate.NameOfWork || '').substring(0, 60)}`,
      `GrandTotal: ${num(abstract && abstract.GrandTotal)}`,
      `Status: ${estimate.Status}`,
      `Version: ${estimate.Version}`,
    ].join('\n');
    const qrBuf = await QRCode.toBuffer(qrPayload, { width: 96, margin: 1 });
    return wb.addImage({ base64: qrBuf.toString('base64'), extension: 'png' });
  } catch (_) {
    return null;
  }
}

async function generateCompleteWorkbook(data) {
  const { header: estimate, items, abstract, locNames, createdBy, workflow, signedBy } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HMWSSB';
  wb.created = new Date();

  const ctx = { estimate, locNames, createdBy, signedBy, workflow, abstract };
  const civil = (items || []).filter((i) => (i.Category || '').toLowerCase() === 'civil');
  const material = (items || []).filter((i) => (i.Category || '').toLowerCase() === 'material');

  const sheets = [];
  sheets.push(writeAzamabadItemsSheet(wb, {
    name: 'Civil Estimate',
    title: 'Estimate for Civil Work',
    headerLabels: AZ_HEADERS.civil,
    items: civil,
    ctx,
    totalLabel: 'Part-I: Working Items Total',
    widths: [5.7, 40.5, 6.2, 7.3, 6.2, 5.0, 7.3, 8.5, 5.5, 10.2],
    scale: 95,
    margins: { left: 0.58, right: 0.45, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }));
  sheets.push(writeAzamabadItemsSheet(wb, {
    name: 'Material Estimate',
    title: 'Estimate for Material',
    headerLabels: AZ_HEADERS.material,
    items: material,
    ctx,
    totalLabel: 'Part-I: Cost of materials Total',
    widths: [5.7, 53.8, 5.0, 7.3, 2.5, 2.7, 8.5, 8.5, 5.0, 11.8],
    scale: 90,
    margins: { left: 0.42, right: 0.31, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }));
  sheets.push(writeAzamabadAbstractSheet(wb, ctx, items));

  const qrId = await makeQrImage(wb, estimate, abstract);
  sheets.push(writeInfoSheet(wb, ctx, qrId));
  sheets.push(writeMovementSheet(wb, ctx));

  const logoId = loadLogo(wb);
  if (logoId != null) {
    [sheets[3], sheets[4]].forEach((ws) => {
      ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 44, height: 44 } });
    });
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { generateCompleteWorkbook };
