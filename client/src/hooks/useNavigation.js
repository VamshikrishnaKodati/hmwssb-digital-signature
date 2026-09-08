import { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const KEYS = {
  drawer: 'hmwssb.nav.drawer',
  favorites: 'hmwssb.nav.favorites',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export default function useNavigation() {
  const location = useLocation()

  const [prefs, setPrefs] = useState(() => read(KEYS.drawer, { pinned: false, expanded: true }))
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [favorites, setFavorites] = useState(() => read(KEYS.favorites, []))

  const pinned = prefs.pinned
  const expanded = prefs.expanded

  useEffect(() => {
    write(KEYS.drawer, prefs)
  }, [prefs])

  useEffect(() => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  const toggleDrawer = useCallback(() => {
    setDesktopOpen(prev => {
      if (prev) return false
      if (pinned) {
        setPrefs(p => ({ ...p, expanded: !p.expanded }))
        return false
      }
      return true
    })
  }, [pinned])

  const closeDrawer = useCallback(() => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }, [])

  const openMobileDrawer = useCallback(() => setMobileOpen(true), [])

  const togglePin = useCallback(() => {
    setPrefs(p => ({ pinned: !p.pinned, expanded: p.pinned ? true : p.expanded }))
  }, [])

  const toggleFavorites = useCallback((path) => {
    setFavorites(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      write(KEYS.favorites, next)
      return next
    })
  }, [])

  return {
    pinned,
    expanded,
    desktopOpen,
    mobileOpen,
    favorites,
    toggleDrawer,
    closeDrawer,
    openMobileDrawer,
    togglePin,
    toggleFavorites,
  }
}
