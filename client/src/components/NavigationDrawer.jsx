import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Star, X, Pin, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Logo from './Logo'
import {
  DRAWER_WIDTH, DRAWER_TRANSITION, groupLabels, isPathActive
} from '../config/navConfig'

const DRAWER_RAIL_WIDTH = 72
const ease = [0.22, 1, 0.36, 1]

function RailTooltip({ label, children }) {
  const hostRef = useRef(null)
  const [tip, setTip] = useState(null)

  const show = () => {
    const el = hostRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTip({ top: r.top + r.height / 2, left: r.right + 12 })
  }
  const hide = () => setTip(null)

  return (
    <>
      <span
        ref={hostRef}
        className="relative block"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {tip && createPortal(
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.12 }}
          role="tooltip"
          className="fixed z-[100] -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-md bg-[#0F172A] text-white text-xs px-2.5 py-1.5 font-medium shadow-lg border border-white/10"
          style={{ top: tip.top, left: tip.left }}
        >
          {label}
        </motion.span>,
        document.body
      )}
    </>
  )
}

function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return
    const container = ref.current
    const getFocusables = () => Array.from(
      container.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null)
    const prev = document.activeElement
    getFocusables()[0]?.focus()
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const els = getFocusables()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    container.addEventListener('keydown', onKey)
    return () => {
      container.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [active, ref])
}

function DrawerItem({ item, collapsed, active, onClick, onFavToggle, favorite, showFav }) {
  const Icon = item.icon
  const inner = (
    <>
      <Icon
        className={`w-[18px] h-[18px] shrink-0 transition-colors ${
          active ? 'text-[#2563EB]' : 'text-[#475569] group-hover:text-[#1E293B]'
        }`}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && showFav && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavToggle() }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onFavToggle() } }}
          aria-label={favorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
          className={`ml-auto rounded p-1 transition-colors ${
            favorite ? 'text-amber-400 hover:text-amber-500' : 'text-[#CBD5E1] hover:text-amber-400'
          }`}
        >
          <Star className="w-3.5 h-3.5" fill={favorite ? 'currentColor' : 'none'} />
        </span>
      )}
    </>
  )

  const baseCls = 'group relative flex items-center rounded-lg transition-all duration-150'
  const sizeCls = collapsed
    ? 'mx-auto w-10 h-10 justify-center'
    : 'w-full px-3 py-2.5 text-sm font-medium gap-3'

  let element
  if (item.isLogout) {
    element = (
      <button
        type="button"
        onClick={onClick}
        className={`${baseCls} ${sizeCls} ${collapsed ? 'text-[#DC2626]' : 'text-[#DC2626] hover:bg-[#FEF2F2]'}`}
      >
        {inner}
      </button>
    )
  } else {
    element = (
      <Link
        to={item.path}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`${baseCls} ${sizeCls} ${active ? 'ec-nav-link-active' : 'ec-nav-link-inactive'}`}
      >
        {inner}
      </Link>
    )
  }

  if (collapsed) return <RailTooltip label={item.label}>{element}</RailTooltip>
  return element
}

function SectionLabel({ children, collapsed }) {
  if (collapsed) return null
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
      {children}
    </p>
  )
}

export default function NavigationDrawer({
  visibleItems,
  currentPath,
  open,
  mobileOpen,
  pinned,
  expanded,
  favorites,
  onClose,
  onNavigate,
  togglePin,
  toggleExpand,
  toggleFavorites,
  onLogoutClick,
}) {
  const asideRef = useRef(null)
  const [query, setQuery] = useState('')

  const isOverlay = mobileOpen || (open && !pinned)
  const collapsed = !isOverlay && pinned && !expanded
  const isVisible = isOverlay || pinned

  useFocusTrap(asideRef, isOverlay)

  useEffect(() => {
    if (!isVisible) setQuery('')
  }, [isVisible])

  const favoritesList = useMemo(
    () => visibleItems.filter(i => !i.isLogout && favorites.includes(i.path)),
    [visibleItems, favorites]
  )

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return visibleItems.filter(i => !i.isLogout && i.label.toLowerCase().includes(q))
  }, [query, visibleItems])

  const grouped = useMemo(() => {
    const groups = {}
    for (const item of visibleItems) {
      if (item.isLogout) continue
      const g = item.group || 'main'
      groups[g] = groups[g] || []
      groups[g].push(item)
    }
    return groups
  }, [visibleItems])

  const handleNavigate = (item) => () => onNavigate(item.path)

  const header = (
    <div className={`flex items-center shrink-0 border-b border-[#CBD5E1] ${collapsed ? 'justify-center py-2.5 flex-col gap-2' : 'justify-between px-4 py-3'}`}>
      <div className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-3'}`}>
        <Logo size={collapsed ? 28 : 34} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold text-[#0F172A] truncate">HMWS&SB</p>
            <p className="text-[10px] text-[#475569] truncate">Works Management System</p>
          </div>
        )}
      </div>
      {collapsed ? (
        <button
          type="button"
          onClick={toggleExpand}
          title="Expand drawer"
          aria-label="Expand drawer"
          className="p-1.5 rounded-md text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          {pinned && !isOverlay && (
            <button
              type="button"
              onClick={toggleExpand}
              title="Collapse drawer to icon rail"
              aria-label="Collapse drawer to icon rail"
              className="p-1.5 rounded-md text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? 'Unpin drawer' : 'Pin drawer open'}
            aria-label={pinned ? 'Unpin drawer' : 'Pin drawer open'}
            aria-pressed={pinned}
            className={`p-1.5 rounded-md transition-colors ${
              pinned
                ? 'text-[#2563EB] bg-[#2563EB]/10'
                : 'text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]'
            }`}
          >
            <Pin className="w-4 h-4" fill={pinned ? 'currentColor' : 'none'} />
          </button>
          {isOverlay && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close navigation"
              className="p-1.5 rounded-md text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )

  const searchBox = (
    <div className="px-3 pt-3 shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search menu..."
          aria-label="Search menu"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] focus:border-[#2563EB] outline-none transition-all placeholder:text-[#94A3B8]"
        />
      </div>
    </div>
  )

  const renderList = (items, showFav) => (
    <nav className="px-2 pb-1 space-y-0.5" aria-label="Navigation items">
      {items.map(item => (
        <DrawerItem
          key={item.path}
          item={item}
          collapsed={collapsed}
          active={isPathActive(item.path, currentPath)}
          onClick={item.isLogout ? onLogoutClick : handleNavigate(item)}
          onFavToggle={() => toggleFavorites(item.path)}
          favorite={favorites.includes(item.path)}
          showFav={showFav}
        />
      ))}
    </nav>
  )

  const body = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 drawer-scroll">
      {!collapsed ? (
        <>
          {searchBox}

          {query.trim() ? (
            <>
              <SectionLabel>Search Results</SectionLabel>
              {searchResults.length > 0 ? (
                renderList(searchResults, false)
              ) : (
                <p className="px-4 py-6 text-center text-xs text-[#94A3B8]">No modules match "{query}"</p>
              )}
            </>
          ) : (
            <>
              {favoritesList.length > 0 && (
                <>
                  <SectionLabel>Pinned Modules</SectionLabel>
                  {renderList(favoritesList, true)}
                </>
              )}
              {Object.entries(groupLabels).map(([key, label]) => {
                if (!grouped[key] || grouped[key].length === 0) return null
                return (
                  <div key={key}>
                    <SectionLabel>{label}</SectionLabel>
                    {renderList(grouped[key], true)}
                  </div>
                )
              })}
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 pt-2">
          {visibleItems.filter(i => !i.isLogout).map(item => (
            <DrawerItem
              key={item.path}
              item={item}
              collapsed
              active={isPathActive(item.path, currentPath)}
              onClick={handleNavigate(item)}
            />
          ))}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="shrink-0 border-t border-[#CBD5E1] p-2">
      <DrawerItem
        item={{ label: 'Logout', icon: LogOut, isLogout: true }}
        collapsed={collapsed}
        active={false}
        onClick={onLogoutClick}
      />
    </div>
  )

  const inner = (
    <>
      {header}
      {body}
      {footer}
    </>
  )

  return (
    <AnimatePresence initial={false}>
      {isOverlay && (
        <>
          <motion.div
            key="nav-backdrop"
            className="fixed inset-0 z-40 bg-[#0F172A]/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="nav-overlay"
            id="app-navigation"
            ref={asideRef}
            role="navigation"
            aria-label="Primary navigation"
            initial={{ x: -DRAWER_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -DRAWER_WIDTH }}
            transition={{ type: 'tween', duration: DRAWER_TRANSITION / 1000, ease }}
            className="fixed left-0 top-0 bottom-0 z-50 flex w-[260px] flex-col shadow-[4px_0_24px_rgba(15,23,42,0.12)] border-r border-[#CBD5E1]"
          >
            {inner}
          </motion.aside>
        </>
      )}

      {pinned && !isOverlay && (
        <motion.aside
          key="nav-pinned"
          id="app-navigation"
          ref={asideRef}
          role="navigation"
          aria-label="Primary navigation"
          initial={false}
          animate={{ width: collapsed ? DRAWER_RAIL_WIDTH : DRAWER_WIDTH }}
          transition={{ type: 'tween', duration: DRAWER_TRANSITION / 1000, ease }}
          className="fixed left-0 top-0 bottom-0 z-30 hidden lg:flex flex-col border-r border-[#CBD5E1] shadow-[2px_0_12px_rgba(15,23,42,0.04)]"
        >
          {inner}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
