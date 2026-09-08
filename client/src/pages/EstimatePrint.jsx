import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import api from '../utils/api'
import CivilEstimatePrint from '../components/print/CivilEstimatePrint'
import MaterialEstimatePrint from '../components/print/MaterialEstimatePrint'
import GeneralAbstractPrint from '../components/print/GeneralAbstractPrint'

export default function EstimatePrint() {
  const { id, type } = useParams()
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const eRes = await api.get(`/estimates/${id}`)
        setEstimate(eRes.data)
      } catch (err) {
        setError(true)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!loading && estimate) {
      setTimeout(() => window.print(), 300)
    }
  }, [loading, estimate])

  if (loading) return <div className="print-page" style={{ textAlign: 'center', paddingTop: '40mm' }}>Loading...</div>
  if (error || !estimate) return <Navigate to="/estimates" replace />

  const civilItems = (estimate.Items || []).filter(d => (d.Category || '').toLowerCase() === 'civil')
  const materialItems = (estimate.Items || []).filter(d => (d.Category || '').toLowerCase() === 'material')

  let content
  if (type === 'civil') {
    content = <CivilEstimatePrint estimate={estimate} items={civilItems} />
  } else if (type === 'material') {
    content = <MaterialEstimatePrint estimate={estimate} items={materialItems} />
  } else if (type === 'abstract') {
    content = (
      <GeneralAbstractPrint
        estimate={estimate}
        items={estimate.Items || []}
        abstract={estimate.Abstract || {}}
      />
    )
  }

  return (
    <div>
      <div className="no-print" style={{ textAlign: 'center', padding: '16px', background: '#f1f5f9' }}>
        <button onClick={() => window.print()} className="print-btn">Print {type}</button>
        <span style={{ margin: '0 8px', color: '#64748b', fontSize: '12px' }}>
          or press Ctrl+P &middot; Select A4, Margins: None
        </span>
      </div>
      {content}
    </div>
  )
}
