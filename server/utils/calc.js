function calcQty(formulaType, values) {
  const { n = 0, l = 0, b = 0, d = 0 } = values;
  switch (formulaType) {
    case 'N': return n;
    case 'L': return l;
    case 'LxB': return l * b;
    case 'LxBxD': return l * b * d;
    case 'NxL': return n * l;
    case 'NxLxBxD': return n * l * b * d;
    default: return 0;
  }
}

function calcAmount(qty, rate) {
  return qty * rate;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function calcAbstract(details, gstPercent, lsProvision, additionalItems) {
  let civilTotal = 0;
  let materialTotal = 0;

  for (const d of details) {
    const amt = Number(d.Amount || d.amount || 0);
    const cat = d.Category || d.category || '';
    if (cat === 'Civil') civilTotal += amt;
    else materialTotal += amt;
  }

  const costOfEstimate = civilTotal + materialTotal;
  const ls = round2(lsProvision || 0);
  const add = round2(additionalItems || 0);
  // General Abstract per official HMWSSB reference workbook:
  //   Part-II : GST = Cost of Estimate * GSTPercent / 100 (LS NOT included)
  //             Additional Items (manual entry, no GST on it)
  //   Part-III: LS Provision (no GST on it)
  //   Subtotal   = Part-I + Part-II (Cost of Estimate + GST)
  //   GrandTotal = Subtotal + Additional Items + LS
  const gst = round2(costOfEstimate * (gstPercent / 100));
  const subtotal = costOfEstimate + gst;
  const grandTotal = subtotal + add + ls;

  return {
    civilTotal,
    materialTotal,
    costOfEstimate,
    subtotal,
    gst,
    additionalItems: add,
    lsProvision: ls,
    grandTotal,
  };
}

module.exports = { calcQty, calcAmount, calcAbstract };
