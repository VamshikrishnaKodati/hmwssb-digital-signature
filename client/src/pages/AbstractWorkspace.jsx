import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FileText, FileSpreadsheet, ArrowLeft, Loader } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { downloadExport } from '../utils/download'

export default function AbstractWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState(null)
  const [exporting, setExporting] = useState('')

  useEffect(() => { loadEstimate() }, [id])

  const loadEstimate = async () => {
    try {
      const res = await api.get(`/estimates/${id}`)
      setEstimate(res.data)
    } catch (_) { toast.error('Failed to load') }
  }

  const exportFile = async (format) => {
    setExporting(format)
    try {
      const fallback = `${(estimate.EstimateNo || estimate.WorkID || `ESTIMATE_${id}`).replace(/\//g, '_')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      const name = await downloadExport(`/exports/${id}/${format === 'pdf' ? 'pdf' : 'excel'}`, fallback)
      toast.success(`${name} downloaded`)
    } catch (_) { toast.error('Export failed') }
    setExporting('')
  }

  if (!estimate) return <div className="ec-loader"><div className="ec-spinner" /></div>

  if (!estimate.Abstract) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => navigate(-1)} className="p-1 rounded text-[#64748B] hover:bg-[#F1F5F9]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="ec-page-title">Abstract of Estimate</h1>
        </div>
        <div className="ec-card p-10 text-center">
          <p className="text-sm text-[#64748B] mb-4">
            The abstract for this estimate has not been generated yet. Save the estimate to compute the abstract.
          </p>
          <Link to={`/estimates/${id}/preview`} className="ec-btn-outline ec-btn-sm">
            <FileText className="w-3.5 h-3.5" /> View Estimate Preview
          </Link>
        </div>
      </div>
    )
  }

  const { Abstract: a, Items } = estimate
  const civilItems = Items.filter(i => i.Category === 'Civil')
  const materialItems = Items.filter(i => i.Category === 'Material')
  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-1 rounded text-[#64748B] hover:bg-[#F1F5F9]">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="ec-page-title">Abstract of Estimate</h1>
          <p className="ec-page-subtitle">{estimate.EstimateNo || estimate.WorkID} &mdash; {estimate.NameOfWork?.substring(0, 100)}</p>
        </div>
      </div>

      {/* Export Documents */}
      <div className="ec-card mb-6">
        <div className="ec-card-header">
          <FileText className="w-4 h-4 text-[#1E3A5F]" />
          <span className="ec-card-title">Export Documents</span>
        </div>
        <div className="ec-card-body">
          <p className="text-xs text-[#64748B] mb-4">Generate professional HMWSSB estimate documents as a single file.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => exportFile('pdf')} disabled={!!exporting}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-[#1E3A5F] bg-[#1E3A5F] text-white hover:bg-[#162a4a] transition-all text-left shadow-sm">
              {exporting === 'pdf' ? <Loader className="w-7 h-7 animate-spin" /> : <FileText className="w-7 h-7" />}
              <span>
                <span className="block font-semibold">Download Complete PDF</span>
                <span className="block text-xs opacity-80 mt-0.5">Single printable document with all sections</span>
              </span>
            </button>
            <button onClick={() => exportFile('excel')} disabled={!!exporting}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-[#16a34a] bg-white hover:bg-green-50 transition-all text-left shadow-sm">
              {exporting === 'excel' ? <Loader className="w-7 h-7 animate-spin text-green-700" /> : <FileSpreadsheet className="w-7 h-7 text-green-700" />}
              <span>
                <span className="block font-semibold text-[#0F172A]">Download Complete Excel</span>
                <span className="block text-xs text-[#64748B] mt-0.5">Workbook with all estimate sheets</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* HMWSSB Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mb-5 text-center">
        <h2 className="text-lg font-bold text-[#1E3A5F]">HYDERABAD METROPOLITAN WATER SUPPLY & SEWERAGE BOARD</h2>
        <p className="text-sm text-[#64748B] mt-1">Works Management System — Abstract of Estimate</p>
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-[#475569]">
          <span>Estimate No: <strong>{estimate.EstimateNo || estimate.WorkID}</strong></span>
          <span>Date: <strong>{new Date().toLocaleDateString('en-IN')}</strong></span>
          <span>FY: <strong>{estimate.FinancialYear || '-'}</strong></span>
        </div>
      </div>

      {/* Part I — Civil Estimate */}
      {civilItems.length > 0 && (
        <div className="ec-card mb-5">
          <div className="ec-card-header bg-[#F8FAFC] border-b-2 border-[#1E3A5F]">
            <span className="ec-card-title">Part I — Estimate for Civil Work</span>
            <span className="text-xs text-[#64748B]">{civilItems.length} items</span>
          </div>
          <div className="overflow-x-auto">{renderItemsTable(civilItems)}</div>
          <div className="px-4 py-3 border-t-2 border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
            <div className="text-right">
              <span className="text-xs text-[#64748B]">Civil Work Total</span>
              <p className="text-base font-bold text-[#1E3A5F]">{fmt(a.CivilTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Part II — Material Estimate */}
      {materialItems.length > 0 && (
        <div className="ec-card mb-5">
          <div className="ec-card-header bg-[#F8FAFC] border-b-2 border-[#1E3A5F]">
            <span className="ec-card-title">Part II — Estimate for Material</span>
            <span className="text-xs text-[#64748B]">{materialItems.length} items</span>
          </div>
          <div className="overflow-x-auto">{renderItemsTable(materialItems)}</div>
          <div className="px-4 py-3 border-t-2 border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
            <div className="text-right">
              <span className="text-xs text-[#64748B]">Material Total</span>
              <p className="text-base font-bold text-[#1E3A5F]">{fmt(a.MaterialTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Part III — General Abstract */}
      <div className="ec-card mb-5 border-2 border-[#1E3A5F]">
        <div className="ec-card-header bg-[#1E3A5F] text-white">
          <span className="font-bold">Part III — General Abstract</span>
        </div>
        <div className="ec-card-body">
          <table className="w-full max-w-lg mx-auto text-sm">
            <tbody>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-3 font-bold text-[#0F172A] text-base">Part I — Cost of Estimate</td>
                <td></td>
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-2 pl-8 text-[#64748B]">Cost of Material</td>
                <td className="py-2 text-right font-medium">{fmt(a.MaterialTotal)}</td>
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-2 pl-8 text-[#64748B]">Cost of Civil Work</td>
                <td className="py-2 text-right font-medium">{fmt(a.CivilTotal)}</td>
              </tr>
              <tr className="border-b-2 border-[#1E3A5F] bg-[#F8FAFC]">
                <td className="py-3 pl-8 font-bold text-[#1E3A5F]">Cost of Estimate (Civil + Material)</td>
                <td className="py-3 text-right font-bold text-[#1E3A5F]">{fmt(a.CostOfEstimate)}</td>
              </tr>

              <tr className="border-b border-[#E2E8F0]">
                <td className="py-3 font-bold text-[#0F172A] text-base">Part II — Additional Items</td>
                <td></td>
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-2 pl-8 text-[#64748B]">GST @ {estimate.GSTPercent}%</td>
                <td className="py-2 text-right font-medium">{fmt(a.GST)}</td>
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-2 pl-8 text-[#64748B]">Additional Items</td>
                <td className="py-2 text-right font-medium">{fmt(a.AdditionalItemsTotal)}</td>
              </tr>

              <tr className="border-b border-[#E2E8F0]">
                <td className="py-3 font-bold text-[#0F172A] text-base">Part III — LS Provisions</td>
                <td></td>
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-2 pl-8 text-[#64748B]">LS unforeseen items and rounding off</td>
                <td className="py-2 text-right font-medium">{fmt(a.LSProvision)}</td>
              </tr>

              <tr className="bg-[#1E3A5F] text-white">
                <td className="py-4 pl-6 font-bold text-lg">Grand Total (Part-I + Part-II + Part-III)</td>
                <td className="py-4 text-right font-bold text-lg">{fmt(a.GrandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 text-center text-xs text-[#64748B] border-t border-[#E2E8F0] pt-4">
            <p>HMWSSB Works Management System — Generated on {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </div>
  )

  function renderItemsTable(items) {
    return (
      <table className="ec-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th className="text-right">N</th>
            <th className="text-right">L</th>
            <th className="text-right">B</th>
            <th className="text-right">D</th>
            <th className="text-right">Qty</th>
            <th>Unit</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.DetailID || idx}>
              <td className="text-[#94A3B8] text-xs">{idx + 1}</td>
              <td className="font-medium text-xs font-mono">{item.ItemCode}</td>
              <td className="max-w-[180px] truncate text-xs">{item.Description}</td>
              <td className="text-right text-xs">{item.N ?? '-'}</td>
              <td className="text-right text-xs">{item.L ?? '-'}</td>
              <td className="text-right text-xs">{item.B ?? '-'}</td>
              <td className="text-right text-xs">{item.D ?? '-'}</td>
              <td className="text-right font-medium text-xs">{parseFloat(item.Qty).toFixed(3)}</td>
              <td className="text-[10px]">{item.Unit}</td>
              <td className="text-right text-xs">{fmt(item.Rate)}</td>
              <td className="text-right font-semibold text-xs">{fmt(item.Amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
}
