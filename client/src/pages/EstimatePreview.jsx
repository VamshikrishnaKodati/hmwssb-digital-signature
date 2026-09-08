import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Download, FileText, Loader } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { downloadExport } from '../utils/download'
import StatusBadge from '../components/shared/StatusBadge'
import CivilEstimatePrint from '../components/print/CivilEstimatePrint'
import MaterialEstimatePrint from '../components/print/MaterialEstimatePrint'
import GeneralAbstractPrint from '../components/print/GeneralAbstractPrint'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

export default function EstimatePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/estimates/${id}`)
        setEstimate(res.data)
      } catch (_) { toast.error('Failed to load estimate preview') }
      setLoading(false)
    }
    load()
  }, [id])

  const downloadPdf = async () => {
    setExporting(true)
    try {
      const fallback = `${(estimate.EstimateNo || estimate.WorkID || `ESTIMATE_${id}`).replace(/\//g, '_')}.pdf`
      const name = await downloadExport(`/exports/${id}/pdf`, fallback)
      toast.success(`${name} downloaded`)
    } catch (_) { toast.error('Download failed') }
    setExporting(false)
  }

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>
  if (!estimate) return <div className="text-center py-12 text-sm text-[#64748B]">Estimate not found</div>

  const items = estimate.Items || []
  const civilItems = items.filter(i => i.Category === 'Civil')
  const materialItems = items.filter(i => i.Category === 'Material')
  const locParts = [estimate.RegionName, estimate.ZoneName, estimate.DivisionName, estimate.CircleName, estimate.WardName].filter(Boolean)

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#64748B] hover:bg-[#F1F5F9]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="ec-page-title">Estimate Preview / General Abstract</h1>
            <p className="ec-page-subtitle">{estimate.EstimateNo || estimate.WorkID} &mdash; {estimate.NameOfWork}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/estimates/${id}/view`)} className="ec-btn-ghost ec-btn-sm">
            <FileText className="w-3.5 h-3.5" /> View
          </button>
          <button onClick={() => window.print()} className="ec-btn-outline ec-btn-sm">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={downloadPdf} disabled={exporting} className="ec-btn-primary ec-btn-sm">
            {exporting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Work Details */}
      <div className="ec-card mb-5">
        <div className="ec-card-header">
          <FileText className="w-4 h-4 text-[#1E3A5F]" />
          <span className="ec-card-title">Work Details</span>
          <StatusBadge status={estimate.Status} />
        </div>
        <div className="ec-card-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Estimate No', estimate.EstimateNo],
              ['Financial Year', estimate.FinancialYear],
              ['Work Category', estimate.WorkCategory],
              ['GST (%)', estimate.GSTPercent + '%'],
              ['Location', locParts.length ? locParts.join(' → ') : null],
              ['Civil Items', civilItems.length],
              ['Material Items', materialItems.length],
              ['Total Items', items.length],
            ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] font-medium text-[#64748B]">{k}</p>
                <p className="text-sm font-medium text-[#0F172A]">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Printable layout */}
      <div className="print-wrapper">
        {civilItems.length > 0 && (
          <CivilEstimatePrint estimate={estimate} items={civilItems} />
        )}
        {civilItems.length > 0 && materialItems.length > 0 && <div className="page-break" />}
        {materialItems.length > 0 && (
          <MaterialEstimatePrint estimate={estimate} items={materialItems} />
        )}
        {(civilItems.length > 0 || materialItems.length > 0) && <div className="page-break" />}
        <GeneralAbstractPrint
          estimate={estimate}
          items={items}
          abstract={estimate.Abstract || {}}
        />
      </div>

      {/* Grand Total summary strip */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 no-print">
        <Link to={`/abstract/${id}`} className="ec-btn-outline ec-btn-sm">
          <FileText className="w-3.5 h-3.5" /> Full Abstract &amp; Export
        </Link>
        <div className="text-right">
          <p className="text-[10px] text-[#64748B]">Grand Total</p>
          <p className="text-xl font-bold text-[#1E3A5F]">{fmt(estimate.Abstract?.GrandTotal)}</p>
        </div>
      </div>
    </div>
  )
}
