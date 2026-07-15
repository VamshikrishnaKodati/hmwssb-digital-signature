export const calculateQty = ({ n = 0, l = 0, b = 0, d = 0 }) => {
  return Number(n || 0) * Number(l || 0) * Number(b || 0) * Number(d || 0);
};

export const calculateAmount = ({ qty = 0, rate = 0, gstPercent = 0 }) => {
  const parsedRate = Number(rate || 0);
  const parsedQty = Number(qty || 0);
  const parsedGst = Number(gstPercent || 0);
  return parsedQty * parsedRate * (1 + parsedGst / 100);
};

export const calculateGrandTotal = (rows, lsAmount = 0) => {
  const totalRows = rows.reduce((sum, row) => {
    return sum + calculateAmount({ qty: row.qty, rate: row.rate, gstPercent: row.gst });
  }, 0);

  return totalRows + Number(lsAmount || 0);
};
