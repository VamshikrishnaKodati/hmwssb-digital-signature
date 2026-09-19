import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Download, FileText, Loader } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { downloadExport } from '../utils/download'
import StatusBadge from '../components/shared/StatusBadge'
import Logo from '../components/Logo'
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
  if (!estimate) return <div className="text-center py-12 text-sm text-[#475569]">Estimate not found</div>

  const items = estimate.Items || []
  const civilItems = items.filter(i => i.Category === 'Civil')
  const materialItems = items.filter(i => i.Category === 'Material')
  const locParts = [estimate.RegionName, estimate.ZoneName, estimate.DivisionName, estimate.CircleName, estimate.WardName].filter(Boolean)
  const preparedBy = estimate.CreatedByName
    ? `${estimate.CreatedByName}${estimate.CreatedByDesignation ? ` (${estimate.CreatedByDesignation})` : ''}`
    : null
  const createdDate = estimate.CreatedDate
    ? new Date(estimate.CreatedDate).toLocaleDateString('en-IN')
    : null

  return (
    <div className="min-w-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#475569] hover:bg-[#F1F5F9]">
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

      <div className="no-print ec-card mb-5">
        <div className="ec-card-header">
          <FileText className="w-4 h-4 text-[#2563EB]" />
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
                <p className="text-[10px] font-medium text-[#475569]">{k}</p>
                <p className="text-sm font-medium text-[#0F172A]">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Printable layout — one continuous A4 document (no page breaks between sections) */}
      <div className="print-wrapper estimate-print-document">
        <div className="print-cover">
          <div className="flex justify-center mb-2"><Logo size={36} /></div>
          <h1>Government of Telangana</h1>
          <p className="pc-board">HMWSSB - Hyderabad Metropolitan Water Supply &amp; Sewerage Board</p>
          <p className="pc-wms">Works Management System</p>
          <div className="pc-rule" />
          <h2 className="pc-abstract">ABSTRACT OF ESTIMATE</h2>
          <p className="pc-sub">
            {estimate.EstimateNo || estimate.WorkID}
            <span className="mx-1">|</span>
            Financial Year {estimate.FinancialYear}
          </p>
          <div className="print-cover-grid">
            {[
              ['Estimate ID', estimate.EstimateNo || estimate.WorkID || '-', 'Name of Work', estimate.NameOfWork || '-'],
              ['Work Category', estimate.WorkCategory || '-', 'Location', locParts.length ? locParts.join(' → ') : '-'],
              ['Status', estimate.Status || '-', 'Version', String(estimate.Version || 1)],
              ['Prepared By', preparedBy || '-', 'Prepared Date', createdDate || '-'],
            ].map(([l1, v1, l2, v2]) => [
              <div className="pc-cell" key={l1}>
                <p className="pc-label">{l1}</p>
                <p className="pc-value">{v1}</p>
              </div>,
              <div className="pc-cell" key={l2}>
                <p className="pc-label">{l2}</p>
                <p className="pc-value">{v2}</p>
              </div>,
            ])}
          </div>
        </div>
        {civilItems.length > 0 && (
          <CivilEstimatePrint estimate={estimate} items={civilItems} />
        )}
        {materialItems.length > 0 && (
          <MaterialEstimatePrint estimate={estimate} items={materialItems} />
        )}
        <GeneralAbstractPrint
          estimate={estimate}
          items={items}
          abstract={estimate.Abstract || {}}
        />
        <div className="print-signatures">
          <div className="print-sig">
            <div className="print-sig-line" />
            <div className="print-sig-label">Prepared by</div>
            <div className="print-sig-role">Manager / Engineer</div>
          </div>
          <div className="print-sig">
            <div className="print-sig-line" />
            <div className="print-sig-label">Checked by</div>
            <div className="print-sig-role">DGM (Works)</div>
          </div>
          <div className="print-sig">
            <div className="print-sig-line" />
            <div className="print-sig-label">Approved by</div>
            <div className="print-sig-role">GM (Works)</div>
          </div>
        </div>
      </div>

      {/* Grand Total summary strip */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 no-print">
        <Link to={`/abstract/${id}`} className="ec-btn-outline ec-btn-sm">
          <FileText className="w-3.5 h-3.5" /> Full Abstract &amp; Export
        </Link>
        <div className="text-right">
          <p className="text-[10px] text-[#475569]">Grand Total</p>
          <p className="text-xl font-bold text-[#2563EB]">{fmt(estimate.Abstract?.GrandTotal)}</p>
        </div>
      </div>
    </div>
  )
}
