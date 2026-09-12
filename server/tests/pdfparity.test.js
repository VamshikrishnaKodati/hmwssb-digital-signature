const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateCompletePDF } = require('../utils/completePdfExporter');

// pdfkit emits the root page tree as << /Type /Pages /Count N /Kids [...] >>.
function countPages(buffer) {
  const s = buffer.toString('latin1');
  const counts = [...s.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length) return Math.max(...counts);
  return (s.match(/\/Type\s*\/Page\b/g) || []).length;
}

function item(i, category) {
  const desc = category === 'Civil'
    ? `Laying of ${i}00mm diameter PSC pressure pipe with jointing and testing`
    : `Provide ${i}00mm uPVC pipe with specials and ${i + 1} no. sluice valve`;
  return {
    DetailID: i,
    ItemID: i,
    ItemCode: (category === 'Civil' ? 'BARR-HW-' : 'AIRVALVE-') + String(i).padStart(3, '0'),
    Description: desc,
    Category: category,
    FormulaType: 'L',
    N: null,
    L: 10.5 + i,
    B: null,
    D: null,
    Qty: 10.5 + i,
    Unit: 'm',
    Rate: 1250.5,
    Amount: (10.5 + i) * 1250.5,
  };
}

function smallFixture() {
  const civil = [1, 2, 3].map((i) => item(i, 'Civil'));
  const material = [1, 2, 3].map((i) => item(i, 'Material'));
  const civilTotal = civil.reduce((s, d) => s + d.Amount, 0);
  const materialTotal = material.reduce((s, d) => s + d.Amount, 0);
  const costOfEstimate = civilTotal + materialTotal;
  const gst = Math.round(costOfEstimate * 0.18 * 100) / 100;
  const grandTotal = Math.round((costOfEstimate + gst + 6121.77) * 100) / 100;
  return {
    header: {
      EstimateID: 213,
      EstimateNo: 'E/213/2026-27',
      WorkID: 'W-213',
      NameOfWork: 'Laying of sewerage network at Balapur — single-page canonical shape',
      WorkCategory: 'Water Supply',
      Status: 'Draft',
      Version: 1,
      GSTPercent: 18,
      LSProvision: 6121.77,
      CreatedDate: '2026-09-01',
      CreatedBy: 1,
    },
    items: [...civil, ...material],
    abstract: {
      CivilTotal: civilTotal,
      MaterialTotal: materialTotal,
      CostOfEstimate: costOfEstimate,
      GSTPercent: 18,
      GST: gst,
      Subtotal: costOfEstimate + gst,
      LSProvision: 6121.77,
      AdditionalItemsTotal: 0,
      GrandTotal: grandTotal,
    },
    locNames: { region: 'Hyderabad', zone: 'South', division: 'D-4', circle: 'C-2', ward: 'Balapur' },
    createdBy: { Name: 'Ramesh Kumar', Designation: 'Junior Engineer' },
  };
}

test('small estimate (3 civil + 3 material) renders on exactly ONE A4 page', async () => {
  const buf = await generateCompletePDF(smallFixture());
  assert.ok(buf.length > 1000, 'PDF should be a non-trivial binary');
  assert.equal(countPages(buf), 1, 'a document that fits must be a single page — print parity');
});

test('document flows to multiple pages when content overflows', async () => {
  const data = smallFixture();
  data.items = [
    ...[...Array(25)].map((_, i) => item(i + 10, 'Civil')),
    ...[...Array(25)].map((_, i) => item(i + 10, 'Material')),
  ];
  const buf = await generateCompletePDF(data);
  assert.ok(buf.length > 1000, 'PDF should be a non-trivial binary');
  assert.ok(countPages(buf) > 1, 'an overflowing document must paginate naturally');
});