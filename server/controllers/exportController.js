const db = require('../config/db');
const { generateCompletePDF } = require('../utils/completePdfExporter');
const { generateCompleteWorkbook } = require('../utils/workbookExporter');
const { fetchLocationNames } = require('../utils/locations');
const { estimateInScope } = require('../services/locationScope');

function estimateFileName(estimate, ext) {
  const base = (estimate.EstimateNo || estimate.WorkID || `ESTIMATE_${estimate.EstimateID}`).replace(/\//g, '_');
  return `${base}.${ext}`;
}

async function getEstimateData(estimateId) {
  const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  if (header.rows.length === 0) return null;

  const details = await db.query(
    `SELECT ed.*, im."ItemCode", im."Description", im."RateIncludesGST"
     FROM "EstimateDetails" ed
     JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
     WHERE ed."EstimateID" = $1
     ORDER BY ed."Category", ed."DetailID"`,
    [estimateId]
  );

  const abstract = await db.query('SELECT * FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);

  const creator = await db.query(
    'SELECT "Name", "Designation" FROM "Users" WHERE "UserID" = $1',
    [header.rows[0].CreatedBy]
  );

  const signer = header.rows[0].DigitallySignedBy
    ? await db.query('SELECT "Name", "Designation" FROM "Users" WHERE "UserID" = $1', [header.rows[0].DigitallySignedBy])
    : null;

  const workflow = await db.query(
    `SELECT w."Action", w."Remarks", w."Version", w."OTPVerified", w."DateTime",
            fu."Name" as "FromUserName", fu."Designation" as "FromDesignation",
            tu."Name" as "ToUserName", tu."Designation" as "ToDesignation"
     FROM "Workflow" w
     LEFT JOIN "Users" fu ON fu."UserID" = w."FromUserID"
     LEFT JOIN "Users" tu ON tu."UserID" = w."ToUserID"
     WHERE w."EstimateID" = $1
     ORDER BY w."DateTime"`,
    [estimateId]
  );

  const locNames = await fetchLocationNames(header.rows[0]);

  return {
    header: header.rows[0],
    items: details.rows,
    abstract: abstract.rows[0] || null,
    createdBy: creator.rows[0] || null,
    signedBy: signer ? signer.rows[0] || null : null,
    workflow: workflow.rows,
    locNames,
  };
}

function sendFile(res, buffer, contentType, filename) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

/* ------------------------------------------------------------------ */
/* Complete professional documents (single file each)                  */
/* ------------------------------------------------------------------ */
exports.exportCompletePDF = async (req, res, next) => {
  try {
    const data = await getEstimateData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Estimate not found' });
    if (!(await estimateInScope(req.user, data.header))) {
      return res.status(403).json({ error: 'This estimate is outside your assigned scope' });
    }
    const buffer = await generateCompletePDF(data);
    sendFile(res, buffer, 'application/pdf', estimateFileName(data.header, 'pdf'));
  } catch (err) { next(err); }
};

exports.exportCompleteWorkbook = async (req, res, next) => {
  try {
    const data = await getEstimateData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Estimate not found' });
    if (!(await estimateInScope(req.user, data.header))) {
      return res.status(403).json({ error: 'This estimate is outside your assigned scope' });
    }
    const buffer = await generateCompleteWorkbook(data);
    sendFile(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', estimateFileName(data.header, 'xlsx'));
  } catch (err) { next(err); }
};
