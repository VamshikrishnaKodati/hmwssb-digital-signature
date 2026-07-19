import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderAbstractHtml } from '../utils/pdfTemplate.js';
import { sanitizeFilename } from '../utils/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _browser = null;

const getBrowser = async () => {
  if (!_browser) {
    const launchOptions = {};
    if (process.env.CHROMIUM_PATH) {
      launchOptions.executablePath = process.env.CHROMIUM_PATH;
    }
    launchOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    _browser = await chromium.launch(launchOptions);
    _browser.on('disconnected', () => { _browser = null; });
  }
  return _browser;
};

export const generateAbstractPdf = async (estimate, items) => {
  const html = renderAbstractHtml(estimate, items || []);
  const uploadsDir = path.resolve(__dirname, '../uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const fileName = `${sanitizeFilename(estimate.estimateId || 'estimate')}_abstract.pdf`;
  const filePath = path.join(uploadsDir, fileName);

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  await page.pdf({
    path: filePath,
    format: 'A4',
    printBackground: true,
    margin: { top: '28mm', bottom: '25mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%; font-size:10px; color:#4b5563; padding:5px 18px; display:flex; justify-content:space-between; align-items:center; font-family: Inter, sans-serif;">
        <span style="font-weight:700; color:#0B5CAD;">HMWSSB</span>
        <span>Estimate Abstract - ${estimate.estimateId || ''}</span>
      </div>
    `,
    footerTemplate: `
      <div style="width:100%; font-size:9px; color:#6b7280; padding:5px 18px; display:flex; justify-content:space-between; font-family: Inter, sans-serif;">
        <span>HMWSSB Works Management System · Government of Telangana</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });

  await page.close();
  return filePath;
};
