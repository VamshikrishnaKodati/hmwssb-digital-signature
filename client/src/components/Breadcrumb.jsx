import { Link } from 'react-router-dom'
import { Home, ChevronRight } from 'lucide-react'

export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="ec-breadcrumb">
      <ol className="flex items-center flex-wrap gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5 min-w-0">
              {i === 0 && <Home className="w-3.5 h-3.5 shrink-0 text-[#94A3B8]" />}
              {i > 0 && <ChevronRight className="ec-breadcrumb-sep w-3 h-3 shrink-0" />}
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-[#2563EB] transition-colors whitespace-nowrap">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`whitespace-nowrap ${isLast ? 'text-[#1E293B] font-medium' : 'text-[#94A3B8]'}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
