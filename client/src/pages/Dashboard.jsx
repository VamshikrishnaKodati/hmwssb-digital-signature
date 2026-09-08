import { useState, useEffect, Suspense } from 'react'
import api from '../utils/api'
import RoleDashboardRouter from './dashboards/RoleDashboardRouter'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/dashboard/stats')
      setData(res.data)
    } catch (err) {
      setData(null)
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard')
    }
    setLoading(false)
  }

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>
  if (!data) return (
    <div className="ec-loader flex flex-col items-center gap-3 text-sm text-[#64748B]">
      <span>{error || 'Failed to load dashboard'}</span>
      <button type="button" onClick={load}
        className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium hover:opacity-90 transition-opacity">
        Retry
      </button>
    </div>
  )

  return (
    <Suspense fallback={<div className="ec-loader"><div className="ec-spinner" /></div>}>
      <RoleDashboardRouter role={data.role} props={{ ...data, user }} />
    </Suspense>
  )
}