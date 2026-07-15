export const escapeRegex = (str) => {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const sanitizeFilename = (str) => {
  return String(str).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 100);
};

export const isPlaceholder = (val) => {
  if (!val) return true;
  const placeholders = ['your-', 'change_me', 'changeme', 'placeholder'];
  return placeholders.some(p => val.toLowerCase().includes(p));
};

export const buildReportFilter = (query) => {
  const filter = {};
  if (query.region) filter.region = query.region;
  if (query.zone) filter.zone = query.zone;
  if (query.division) filter.division = query.division;
  if (query.status) filter.status = query.status;
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }
  return filter;
};
