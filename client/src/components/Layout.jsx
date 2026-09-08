import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react'
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
      className="relative p-1.5 rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B] transition-colors"
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
    <div className="flex h-screen overflow-hidden bg-[#F5F7FA]">
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

      <div className={`flex-1 flex flex-col min-w-0 transition-[padding-left] duration-300 ${contentPadding}`}>
        <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center gap-3 px-3 md:px-5 shrink-0 z-20">
          <button
            onClick={handleHamburger}
            aria-label={nav.desktopOpen || nav.mobileOpen ? 'Close navigation (Ctrl+B)' : 'Open navigation (Ctrl+B)'}
            aria-expanded={nav.desktopOpen || nav.mobileOpen}
            aria-controls="app-navigation"
            title="Toggle navigation (Ctrl+B)"
            className="p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B] transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(30,58,95,0.2)]"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0" title="HMWSSB Works Management System">
            <Logo size={30} />
            <div className="leading-tight min-w-0 hidden sm:block">
              <p className="text-sm font-bold text-[#0F172A] truncate">HMWSSB</p>
              <p className="text-[10px] text-[#64748B] truncate hidden md:block">Works Management System</p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1.5 md:gap-3">
            <NotificationBell />

            <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user?.Name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-medium text-[#1E293B] leading-tight max-w-[140px] truncate">{user?.Name}</p>
                  <p className="text-[10px] text-[#64748B] leading-tight">{roleLabel(user?.Designation)}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] hidden md:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-[#E2E8F0] shadow-xl z-40 py-1.5 animate-scaleIn"
                  >
                    <div className="px-3.5 py-2.5 border-b border-[#E2E8F0]">
                      <p className="text-sm font-semibold text-[#1E293B] truncate">{user?.Name}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{roleLabel(user?.Designation)}</p>
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors"
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
          <div className="h-9 bg-white border-b border-[#E2E8F0] flex items-center px-3 md:px-5 shrink-0 overflow-x-auto">
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6" id="app-main">
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
