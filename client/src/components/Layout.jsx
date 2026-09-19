import { useState, useEffect } from 'react'
import { animate } from 'animejs'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { Menu, Bell, ChevronDown, LogOut, Sun, Moon } from 'lucide-react'
import Logo from './Logo'
import NavigationDrawer from './NavigationDrawer'
import Breadcrumb from './Breadcrumb'
import LogoutConfirmationDialog from './shared/LogoutConfirmationDialog'
import useNavigation from '../hooks/useNavigation'
import { getVisibleNavItems, roleLabel } from '../config/navConfig'
import { buildBreadcrumbs } from '../utils/breadcrumbs'

function NotificationBell() {
  const [count, setCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let active = true
    api.get('/notifications/unread-count')
      .then(res => { if (active) setCount(res.data?.count || 0) })
      .catch(() => {})
    return () => { active = false }
  }, [location.pathname])

  return (
    <Link
      to="/notifications"
      title="Notifications"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      className="relative p-1.5 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#1E293B] transition-colors"
    >
      <Bell className="w-[18px] h-[18px]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const nav = useNavigation()

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem('hmwssb-theme', isDark ? 'dark' : 'light') } catch (e) {}
  }, [isDark])

  useEffect(() => {
    const shell = document.querySelector('.app-shell')
    const animatedNodes = document.querySelectorAll('.app-header, .app-breadcrumb, .app-main')

    if (shell) {
      animate(shell, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 500,
        easing: 'easeOutCubic',
      })
    }

    if (animatedNodes.length > 0) {
      animate(animatedNodes, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 420,
        delay: (el, i) => i * 50,
        easing: 'easeOutExpo',
      })
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        if (isMobile) nav.openMobileDrawer()
        else nav.toggleDrawer()
      }
      if (e.key === 'Escape') {
        nav.closeDrawer()
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, nav.toggleDrawer, nav.closeDrawer, nav.openMobileDrawer])

  const performLogout = () => {
    logout()
    navigate('/login')
    toast.success('Logged out successfully.')
  }

  const handleHamburger = () => {
    if (isMobile) nav.openMobileDrawer()
    else nav.toggleDrawer()
  }

  const visibleItems = getVisibleNavItems(user?.Designation)
  const breadcrumbs = buildBreadcrumbs(location.pathname)

  const contentPadding = nav.pinned && !nav.mobileOpen && !isMobile
    ? (nav.expanded ? 'lg:pl-[260px]' : 'lg:pl-[72px]')
    : ''

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <NavigationDrawer
        visibleItems={visibleItems}
        currentPath={location.pathname}
        open={nav.desktopOpen}
        mobileOpen={nav.mobileOpen}
        pinned={nav.pinned}
        expanded={nav.expanded}
        favorites={nav.favorites}
        onClose={nav.closeDrawer}
        onNavigate={nav.closeDrawer}
        togglePin={nav.togglePin}
        toggleExpand={nav.toggleDrawer}
        toggleFavorites={nav.toggleFavorites}
        onLogoutClick={() => { nav.closeDrawer(); setShowLogoutDialog(true) }}
      />

      <div className={`app-frame flex-1 flex flex-col min-w-0 transition-[padding-left] duration-300 ${contentPadding}`}>
        <header className="app-header h-12 bg-white border-b border-[#CBD5E1] flex items-center gap-3 px-3 md:px-5 shrink-0 z-20">
          <button
            onClick={handleHamburger}
            aria-label={nav.desktopOpen || nav.mobileOpen ? 'Close navigation (Ctrl+B)' : 'Open navigation (Ctrl+B)'}
            aria-expanded={nav.desktopOpen || nav.mobileOpen}
            aria-controls="app-navigation"
            title="Toggle navigation (Ctrl+B)"
            className="p-2 rounded-lg text-[#475569] hover:bg-[#F1F5F9] hover:text-[#1E293B] transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.2)]"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0" title="HMWSSB Works Management System">
            <Logo size={30} />
            <div className="leading-tight min-w-0 hidden sm:block">
              <p className="text-sm font-bold text-[#0F172A] truncate">HMWSSB</p>
              <p className="text-[10px] text-[#475569] truncate hidden md:block">Works Management System</p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-4 md:gap-6 relative">
            {/* Water Tank Watermark & Motto matching reference image */}
            <div className="hidden lg:flex items-center gap-4 select-none pointer-events-none pr-2">
              <div className="flex flex-col text-right leading-tight">
                <span className="text-[11px] font-bold text-sky-500 tracking-wide">Clean Water</span>
                <span className="text-[11px] font-bold text-sky-600 tracking-wide">Healthy Hyderabad</span>
                <span className="text-[11px] font-bold text-sky-700 tracking-wide">Brighter Tomorrow</span>
              </div>
              <div className="w-16 h-12 opacity-80 shrink-0">
                <svg viewBox="0 0 100 80" className="w-full h-full text-sky-600" fill="currentColor">
                  {/* Elevated Water Tank */}
                  <ellipse cx="50" cy="16" rx="34" ry="8" />
                  <rect x="16" y="16" width="68" height="22" rx="2" />
                  <ellipse cx="50" cy="38" rx="34" ry="8" />
                  <text x="50" y="30" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold" letterSpacing="0.8">HMWSSB</text>
                  {/* Pillars */}
                  <rect x="24" y="40" width="3.5" height="34" />
                  <rect x="40" y="42" width="3.5" height="32" />
                  <rect x="56" y="42" width="3.5" height="32" />
                  <rect x="72" y="40" width="3.5" height="34" />
                  <line x1="24" y1="54" x2="75.5" y2="54" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="24" y1="66" x2="75.5" y2="66" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#1E293B] transition-colors"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            <NotificationBell />

            <div className="h-6 w-px bg-[#CBD5E1] hidden sm:block" />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user?.Name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-medium text-[#1E293B] leading-tight max-w-[140px] truncate">{user?.Name}</p>
                  <p className="text-[10px] text-[#475569] leading-tight">{roleLabel(user?.Designation)}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] hidden md:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-[#CBD5E1] shadow-xl z-40 py-1.5 animate-scaleIn"
                  >
                    <div className="px-3.5 py-2.5 border-b border-[#CBD5E1]">
                      <p className="text-sm font-semibold text-[#1E293B] truncate">{user?.Name}</p>
                      <p className="text-[11px] text-[#475569] mt-0.5">{roleLabel(user?.Designation)}</p>
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" /> Notifications
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); setShowLogoutDialog(true) }}
                      role="menuitem"
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {breadcrumbs.length > 0 && (
          <div className="app-breadcrumb h-8 bg-white border-b border-[#CBD5E1] flex items-center px-3 md:px-5 shrink-0 overflow-x-auto">
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}

        <main className={`app-main flex-1 overflow-y-auto p-3 md:p-5`} id="app-main">
          {children}
        </main>
      </div>

      <LogoutConfirmationDialog
        open={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onLogout={performLogout}
      />
    </div>
  )
}
