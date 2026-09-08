import { ArrowRight } from 'lucide-react'

export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN')
}

export function fmtCurrency(n) {
  const v = Number(n || 0)
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function fmtDays(d) {
  if (!d) return '—'
  const v = Number(d)
  if (v < 1) return `${Math.round(v * 24)}h`
  return `${Math.round(v)}d`
}

export function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v))
  })
  const s = sp.toString()
  return s ? `/estimates?${s}` : '/estimates'
}

export const ARROW = ArrowRight
