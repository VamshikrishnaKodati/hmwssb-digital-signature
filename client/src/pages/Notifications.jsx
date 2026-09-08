import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Mail, MailOpen } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data || [])
    } catch (_) {}
    setLoading(false)
  }

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`)
    load()
  }

  const markAllRead = async () => {
    await api.put('/notifications/read-all')
    toast.success('All marked as read')
    load()
  }

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  const unread = notifications.filter(n => !n.IsRead).length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="ec-page-title">Notifications</h1>
          <p className="ec-page-subtitle">{unread} unread notification{unread !== 1 ? 's' : ''}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="ec-btn-ghost ec-btn-sm">
            <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="ec-card">
          <div className="ec-empty">
            <Bell className="ec-empty-icon" />
            <p className="ec-empty-text">No notifications</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.NotificationID}
              className={`ec-card transition-colors ${n.IsRead ? '' : 'border-[#1E3A5F]/20 bg-[#F8FAFC]'}`}>
              <div className="ec-card-body flex items-start gap-3">
                <div className={`p-1.5 rounded-full shrink-0 ${n.IsRead ? 'bg-[#F1F5F9] text-[#94A3B8]' : 'bg-[#EFF6FF] text-[#1E3A5F]'}`}>
                  {n.IsRead ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.IsRead ? 'text-[#64748B]' : 'text-[#1E293B] font-medium'}`}>{n.Message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {n.WorkID && (
                      <Link to={`/estimates/${n.EstimateID}`}
                        className="text-xs text-[#1E3A5F] hover:underline font-medium">
                        {n.WorkID}
                      </Link>
                    )}
                    <span className="text-[10px] text-[#94A3B8]">
                      {n.CreatedDate?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                </div>
                {!n.IsRead && (
                  <button onClick={() => markRead(n.NotificationID)}
                    className="text-xs text-[#64748B] hover:text-[#1E3A5F] shrink-0 font-medium">
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
