import { useEffect, useState } from 'react'
import api from './api'

// Returns the current user, refreshed from GET /auth/profile so permission
// grants/revokes made through Role & Permission Management take effect in the
// UI without a fresh login. Falls back to the login-time localStorage snapshot
// while the refresh is in flight or if it fails.
export default function useCurrentUser() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))

  useEffect(() => {
    let live = true
    const refresh = () => {
      api.get('/auth/profile')
        .then(res => { if (live) setUser(res.data) })
        .catch(() => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { live = false; window.removeEventListener('focus', refresh) }
  }, [])

  return user
}