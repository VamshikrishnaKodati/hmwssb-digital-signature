export function calcQtyByFormula(formulaType, n, l, b, d) {
  const N = parseFloat(n) || 0
  const L = parseFloat(l) || 0
  const B = parseFloat(b) || 0
  const D = parseFloat(d) || 0
  switch (formulaType) {
    case 'N': return N
    case 'L': return L
    case 'LxB': return L * B
    case 'LxBxD': return L * B * D
    case 'NxL': return N * L
    case 'NxLxBxD': return N * L * B * D
    default: return 0
  }
}

export function getFormulaFields(formulaType) {
  switch (formulaType) {
    case 'N': return { N: true, L: false, B: false, D: false }
    case 'L': return { N: false, L: true, B: false, D: false }
    case 'LxB': return { N: false, L: true, B: true, D: false }
    case 'LxBxD': return { N: false, L: true, B: true, D: true }
    case 'NxL': return { N: true, L: true, B: false, D: false }
    case 'NxLxBxD': return { N: true, L: true, B: true, D: true }
    default: return { N: true, L: true, B: true, D: true }
  }
}

export const FORMULA_LABELS = {
  N: 'Count (N)',
  L: 'Length (L)',
  LxB: 'L x B',
  LxBxD: 'L x B x D',
  NxL: 'N x L',
  NxLxBxD: 'N x L x B x D',
}
