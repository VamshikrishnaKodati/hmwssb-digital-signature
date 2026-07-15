export const formatINR = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const numberToWords = (num) => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };

  const n = Math.floor(Number(num) || 0);
  const paise = Math.round((Number(num) - n) * 100);
  let words = 'Rupees ';
  if (n === 0) words += 'Zero';
  else words += inWords(n);
  if (paise) words += ` and ${inWords(paise)} Paise`;
  words += ' Only';
  return words;
};

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="72" height="72">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0B5CAD;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1E88E5;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#21B6D7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0B5CAD;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#bgGrad)" stroke="#16355C" stroke-width="3"/>
  <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
  <path d="M60 22 C60 22 38 48 38 62 C38 74.15 47.85 84 60 84 C72.15 84 82 74.15 82 62 C82 48 60 22 60 22Z" fill="url(#waterGrad)" opacity="0.9"/>
  <path d="M42 65 Q47 60 52 65 Q57 70 62 65 Q67 60 72 65 Q77 70 82 65" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round"/>
  <path d="M44 72 Q49 67 54 72 Q59 77 64 72 Q69 67 74 72 Q79 77 80 72" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="54" y="78" width="12" height="4" rx="2" fill="rgba(255,255,255,0.6)"/>
  <text x="60" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="white" letter-spacing="3">HMWSSB</text>
</svg>`;

const LOGO_BASE64 = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;

export const renderAbstractHtml = (estimate, items) => {
  const data = estimate || {};
  const itemRows = (items || []).map((item, index) => {
    const qty = Number(item.qty || 0).toFixed(2);
    const rate = formatINR(item.rate || 0);
    const amount = formatINR(item.amount || 0);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.description || '-')}</td>
        <td>${escapeHtml(item.material || '-')}</td>
        <td>${qty}</td>
        <td>${escapeHtml(item.unit || '-')}</td>
        <td>${rate}</td>
        <td>${amount}</td>
      </tr>
    `;
  }).join('');

  const materialTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gstTotal = items.reduce((sum, item) => sum + (Number(item.amount || 0) * (Number(item.gst || 0) / 100)), 0);
  const grandTotal = materialTotal + gstTotal;
  const status = data.status || 'Draft';
  const preparedDate = new Date(data.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const generationDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const amountInWords = numberToWords(grandTotal);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>HMWSSB Estimate Abstract - ${escapeHtml(data.estimateId || '')}</title>
        <style>
          @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
          body { margin: 0; font-family: 'Inter', 'Helvetica', 'Arial', sans-serif; color: #24324a; background: #f5f7fb; }
          .page { width: 100%; box-sizing: border-box; padding: 20px 0; }
          .sheet { background: #fff; padding: 24px 28px 32px; border-radius: 12px; box-shadow: 0 18px 80px rgba(13, 34, 61, 0.08); }

          /* Official Header */
          .official-header { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
          .official-header img { width: 72px; height: 72px; border-radius: 14px; flex-shrink: 0; }
          .header-text { flex: 1; }
          .header-text .org-name { margin: 0; font-size: 15px; font-weight: 800; color: #0B5CAD; letter-spacing: 0.08em; text-transform: uppercase; }
          .header-text .org-full { margin: 4px 0 0; font-size: 10px; color: #4e5d78; letter-spacing: 0.04em; }
          .header-text .system-name { margin: 4px 0 0; font-size: 11px; font-weight: 600; color: #16355C; }
          .header-right { text-align: right; flex-shrink: 0; }
          .header-right .doc-type { font-size: 14px; font-weight: 700; color: #16355C; margin-bottom: 4px; }
          .header-right .estimate-id { font-size: 10px; color: #4e5d78; margin-bottom: 2px; }
          .header-right .gen-date { font-size: 10px; color: #4e5d78; }

          .separator { border: none; border-top: 3px solid #0B5CAD; margin: 12px 0 20px; }
          .separator-thin { border: none; border-top: 1px solid #DCE8F5; margin: 8px 0; }

          .status-chip { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; background: #e7f0ff; color: #0b5cad; }

          .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 0 0 24px; }
          .meta-card { padding: 16px; border: 1px solid #e5eaf3; border-radius: 12px; background: #fbfcfd; }
          .meta-card h3 { margin: 0 0 12px; font-size: 11px; color: #0B5CAD; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
          .meta-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 11px; color: #3f4b67; }
          .meta-list li { display: flex; justify-content: space-between; gap: 12px; }
          .meta-list span:last-child { color: #020617; font-weight: 600; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
          th, td { padding: 12px 10px; border: 1px solid #e3e8f0; }
          th { background: #0B5CAD; color: #fff; font-weight: 700; text-align: left; }
          td { color: #344054; }
          tbody tr:nth-child(even) { background: #f8faff; }

          .summary-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; margin-bottom: 18px; }
          .summary-card { border: 1px solid #e5eaf3; border-radius: 12px; padding: 16px; background: #fbfcfd; }
          .summary-row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: 11px; }
          .summary-row strong { color: #0f172a; }
          .summary-total { background: #e6f4ea; padding: 14px 16px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; color: #0f652d; }

          .signature-blocks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
          .signature-card { min-height: 110px; padding: 12px 14px; border: 1px solid #dfe7ef; border-radius: 10px; background: #fff; }
          .signature-card strong { display: block; margin-bottom: 10px; font-size: 12px; color: #102a43; }

          .notes { padding: 16px; border-radius: 12px; background: #f4f7ff; border: 1px solid #dfe7ef; font-size: 11px; color: #334e68; line-height: 1.6; }

          .footer { margin-top: 30px; padding-top: 16px; border-top: 2px solid #0B5CAD; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #4b5563; }
          .footer .footer-brand { display: flex; align-items: center; gap: 8px; }
          .footer .footer-brand img { width: 24px; height: 24px; border-radius: 4px; }
          .footer span { display: inline-block; }
          .page-note { margin-top: 12px; font-size: 9px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="sheet">
            <!-- Official Header -->
            <div class="official-header">
              <img src="${LOGO_BASE64}" alt="HMWSSB Logo" />
              <div class="header-text">
                <p class="org-name">HMWSSB</p>
                <p class="org-full">Hyderabad Metropolitan Water Supply &amp; Sewerage Board</p>
                <p class="system-name">Works Management System</p>
              </div>
              <div class="header-right">
                <div class="doc-type">Official Estimate Abstract</div>
                <div class="estimate-id">Estimate: ${escapeHtml(data.estimateId || '-')}</div>
                <div class="gen-date">Generated: ${generationDate}</div>
              </div>
            </div>

            <hr class="separator" />

            <div class="meta-grid">
              <div class="meta-card">
                <h3>Project Details</h3>
                <ul class="meta-list">
                  <li><span>Estimate ID</span><span>${escapeHtml(data.estimateId || '-')}</span></li>
                  <li><span>Work Name</span><span>${escapeHtml(data.nameOfWork || '-')}</span></li>
                  <li><span>Region</span><span>${escapeHtml(data.region || '-')}</span></li>
                  <li><span>Zone</span><span>${escapeHtml(data.zone || '-')}</span></li>
                  <li><span>Division</span><span>${escapeHtml(data.division || '-')}</span></li>
                  <li><span>Circle</span><span>${escapeHtml(data.circle || '-')}</span></li>
                  <li><span>Ward</span><span>${escapeHtml(data.ward || '-')}</span></li>
                </ul>
              </div>
              <div class="meta-card">
                <h3>Administrative Details</h3>
                <ul class="meta-list">
                  <li><span>Prepared By</span><span>${escapeHtml(data.managerName || '-')}</span></li>
                  <li><span>Prepared Date</span><span>${preparedDate}</span></li>
                  <li><span>Total Items</span><span>${items.length}</span></li>
                  <li><span>Total Amount</span><span>${formatINR(materialTotal)}</span></li>
                  <li><span>GST Total</span><span>${formatINR(gstTotal)}</span></li>
                  <li><span>Grand Total</span><span>${formatINR(grandTotal)}</span></li>
                </ul>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Description</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>

            <div class="summary-grid">
              <div class="notes">
                <strong>Amount in Words</strong>
                <p>${amountInWords}</p>
              </div>
              <div class="summary-card">
                <div class="summary-row"><span>Material Total</span><strong>${formatINR(materialTotal)}</strong></div>
                <div class="summary-row"><span>GST Total</span><strong>${formatINR(gstTotal)}</strong></div>
                <div class="summary-row"><span>Grand Total</span><strong>${formatINR(grandTotal)}</strong></div>
                <div class="summary-total"><span>Estimated Total</span><span>${formatINR(grandTotal)}</span></div>
              </div>
            </div>

            <div class="signature-blocks">
              <div class="signature-card"><strong>Prepared By</strong><span>Signature</span><span>Name</span><span>Date</span></div>
              <div class="signature-card"><strong>Verified By</strong><span>Signature</span><span>Name</span><span>Date</span></div>
              <div class="signature-card"><strong>Approved By</strong><span>Signature</span><span>Name</span><span>Date</span></div>
            </div>

            <div class="footer">
              <div class="footer-brand">
                <img src="${LOGO_BASE64}" alt="HMWSSB" />
                <span>HMWSSB Works Management System</span>
              </div>
              <span>${generationDate}</span>
            </div>
            <div class="page-note">This is a computer-generated document. Hyderabad Metropolitan Water Supply &amp; Sewerage Board, Government of Telangana.</div>
          </div>
        </div>
      </body>
    </html>
  `;
};
