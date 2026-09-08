import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ITEM_SIZE = 32
const ITEM_GAP = 4
const FAN_PAD = 6
const TRIGGER_GAP = 6

export default function ActionFan({ anchor, actions, isOpen, onClose }) {
  const fanRef = useRef(null)
  const firstItemRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [animated, setAnimated] = useState(false)

  const calcPos = useCallback(() => {
    if (!anchor) { setPos(null); return }
    const r = anchor.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) { onClose(); return }
    const fanH = actions.length * (ITEM_SIZE + ITEM_GAP) - ITEM_GAP + FAN_PAD * 2
    const above = r.top
    const below = window.innerHeight - r.bottom
    const dir = (above >= fanH + TRIGGER_GAP || above > below) ? 'up' : 'down'
    const top = dir === 'up' ? r.top - fanH - TRIGGER_GAP : r.bottom + TRIGGER_GAP
    const left = r.right - ITEM_SIZE - FAN_PAD * 2
    setPos({ top: Math.max(4, top), left: Math.max(4, left), direction: dir })
  }, [anchor, actions.length, onClose])

  useLayoutEffect(() => {
    if (isOpen && anchor) {
      calcPos()
      setAnimated(false)
      requestAnimationFrame(() => setAnimated(true))
    } else {
      setAnimated(false)
      setPos(null)
    }
  }, [isOpen, anchor, calcPos])

  useEffect(() => {
    if (!isOpen) return
    const handler = () => calcPos()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [isOpen, calcPos])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (fanRef.current?.contains(e.target) || anchor?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, anchor, onClose])

  useEffect(() => {
    if (isOpen && animated) firstItemRef.current?.focus()
  }, [isOpen, animated])

  if (!isOpen || !pos) return null

  return createPortal(
    <div
      ref={fanRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        opacity: animated ? 1 : 0,
        transform: `scale(${animated ? 1 : 0.9})`,
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        transformOrigin: pos.direction === 'up' ? 'bottom right' : 'top right',
      }}
    >
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1.5 px-1.5 flex flex-col gap-1">
        {actions.map((a, i) => (
          <button
            key={a.key}
            ref={i === 0 ? firstItemRef : undefined}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={(e) => { e.stopPropagation(); onClose(); a.onClick() }}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 ${
              a.tone === 'danger'
                ? 'text-[#DC2626] hover:text-[#B91C1C] hover:bg-red-50'
                : 'text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F1F5F9]'
            }`}
          >
            <a.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}
