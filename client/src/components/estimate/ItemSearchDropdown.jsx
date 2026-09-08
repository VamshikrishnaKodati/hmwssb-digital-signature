import { memo } from 'react'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function ItemSearchDropdown({ searching, query, results, activeResult, onMouseEnter, onSelect }) {
  return (
    <div className="ec-search-row-dropdown">
      <div className="ec-search-row-dropdown-body">
        {searching && (
          <div className="ec-search-row-empty"><div className="ec-spinner w-4 h-4" /> Searching...</div>
        )}

        {!searching && query && results.length === 0 && (
          <div className="ec-search-row-empty">No items found</div>
        )}

        {!searching && !query && (
          <div className="ec-search-row-empty">Type to search for an item</div>
        )}

        {results.length > 0 && (
          <ul className="ec-search-row-list">
            {results.map((item, i) => (
              <li key={item.ItemID}>
                <button
                  type="button"
                  data-result-index={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => onMouseEnter(i)}
                  onClick={() => onSelect(item)}
                  className={`ec-search-row-item ${i === activeResult ? 'ec-search-row-item-active' : ''}`}
                >
                  <div className="ec-search-row-item-top">
                    <span className="ec-search-row-code">{item.ItemCode}</span>
                    <span className={`ec-badge ${item.Category === 'Civil' ? 'ec-badge-civil' : 'ec-badge-material'}`}>
                      <span className={`ec-badge-dot ${item.Category === 'Civil' ? 'bg-[#2563EB]' : 'bg-[#059669]'}`} aria-hidden="true" />
                      {item.Category}
                    </span>
                  </div>
                  <span className="ec-search-row-desc">{item.Description}</span>
                  <div className="ec-search-row-meta">
                    <span className="ec-search-row-unit">{item.Unit}</span>
                    <span className="ec-search-row-sep">•</span>
                    <span className="ec-search-row-rate">₹{fmt(item.Rate)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ec-search-row-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> select</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  )
}

export default memo(ItemSearchDropdown)
