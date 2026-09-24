import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import api from '../utils/api'
import LOADocument from '../components/print/LOADocument'

// Print/Download route for the Letter of Award. Renders the SAME canonical
// LOADocument as the detail page, auto-opens the browser print dialog (the
// "Download PDF" path is Save-as-PDF here), and records the print audit once.
export default function LoaPrint() {
  const { tenderId } = useParams()
  const [loa, setLoa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/loa/tender/${tenderId}`)
        setLoa(res.data)
        api.post(`/loa/tender/${tenderId}/print`).catch(() => {})
      } catch (err) {
        setError(true)
      }
      setLoading(false)
    }
    load()
  }, [tenderId])

  useEffect(() => {
    if (!loading && loa) {
      document.title = `${loa.LOANumber} — LOA`
      setTimeout(() => window.print(), 300)
    }
  }, [loading, loa])

  if (loading) return <div className="print-page" style={{ textAlign: 'center', paddingTop: '40mm' }}>Loading...</div>
  if (error || !loa) return <Navigate to={`/tenders/${tenderId}`} replace />

  return (
    <div>
      <div className="no-print" style={{ textAlign: 'center', padding: '16px', background: '#f1f5f9' }}>
        <button onClick={() => window.print()} className="print-btn">Print {loa.LOANumber}</button>
        <span style={{ margin: '0 8px', color: '#64748b', fontSize: '12px' }}>
          or press Ctrl+P &middot; Select A4, Margins: None &middot; To save as PDF choose "Save as PDF" in the printer dialog
        </span>
      </div>
      <LOADocument loa={loa} />
    </div>
  )
}