import { memo } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import NumericInput from '../NumericInput'
import ItemSearchDropdown from './ItemSearchDropdown'

const FIELD_ORDER = ['N', 'L', 'B', 'D']
const READ_MORE_THRESHOLD = 60

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function nextField(item, field) {
  const idx = FIELD_ORDER.indexOf(field)
  return idx >= 0 && idx < FIELD_ORDER.length - 1 ? FIELD_ORDER[idx + 1] : null
}

function ItemRow({
  item, idx, expanded, disabled, highlighted, flashed,
  errorN, errorL, errorB, errorD,
  onUpdate, onRemove, onDuplicate, onToggleDesc,
  onFocusField, onFocusSearch, fieldRefs, search,
}) {
  const qty = parseFloat(item.Qty || 0)
  const rate = parseFloat(item.Rate || 0)
  const amt = parseFloat(item.Amount || 0)
  const isLong = (item.Description || '').length > READ_MORE_THRESHOLD

  const handleKeyDown = (field) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    const next = nextField(item, field)
    if (next) onFocusField(item._tempId, next)
    else onFocusSearch()
  }

  const setFieldRef = (field) => (el) => { fieldRefs.current[`${item._tempId}_${field}`] = el }

  const dimCell = (field, error) => (
    <div className="ec-grid-cell ec-dim-col">
      <NumericInput
        id={`${item._tempId}_${field}`}
        ref={setFieldRef(field)}
        value={item[field] ?? ''}
        disabled={disabled}
        onChange={e => { e.stopPropagation(); onUpdate(item._tempId, field, e.target.value) }}
        onFocus={e => e.stopPropagation()}
        onKeyDown={handleKeyDown(field)}
        error={error}
        aria-label={`${field} for item ${item.ItemCode}`}
        aria-invalid={!!error}
        className="ec-dim-input"
        placeholder="0"
        autoComplete="off"
      />
    </div>
  )

  return (
    <div
      className={`ec-grid-row ${idx % 2 === 1 ? 'ec-grid-row-odd' : ''} ${highlighted ? 'ec-item-highlight-row' : ''}`}
    >
      <div className="ec-grid-cell ec-cell-sno">{idx + 1}</div>

      {search ? (
        <div className="ec-grid-cell ec-desc-cell ec-desc-cell-editing" ref={search.cellRef}>
          <input
            ref={setFieldRef('DESC')}
            type="text"
            value={search.term}
            onChange={e => { e.stopPropagation(); search.onTermChange(e.target.value) }}
            onKeyDown={search.onKeyDown}
            onFocus={search.onFocus}
            placeholder="Search item by code or description..."
            className="ec-search-row-input"
            aria-label="Search estimate item"
            aria-expanded={search.open}
            aria-controls={`item-search-results_${item._tempId}`}
            role="combobox"
            autoComplete="off"
            spellCheck="false"
          />
          {search.open && (
            <div id={`item-search-results_${item._tempId}`} role="listbox">
              <ItemSearchDropdown
                searching={search.searching}
                query={search.term}
                results={search.results}
                activeResult={search.activeResult}
                onMouseEnter={search.onMouseEnter}
                onSelect={search.onSelect}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="ec-grid-cell ec-desc-cell">
          <div className="ec-item-code">{item.ItemCode}</div>
          <p id={`desc_${item._tempId}`} className={`text-xs text-[#334155] leading-snug ${expanded ? '' : 'ec-clamp-2'}`}>
            {item.Description}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleDesc(item._tempId) }}
              aria-expanded={expanded}
              aria-controls={`desc_${item._tempId}`}
              className="ec-read-more"
            >
              {expanded ? 'Read Less' : 'Read More'}
            </button>
          )}
        </div>
      )}

      <div className="ec-grid-cell ec-cell-center">
        <select
          value={item.Category === 'Material' ? 'Yes' : 'No'}
          disabled={disabled}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onUpdate(item._tempId, 'Category', e.target.value === 'Yes' ? 'Material' : 'Civil') }}
          aria-label={`Material status for item ${item.ItemCode}`}
          title={item.Category === 'Material' ? 'Material item' : 'Civil item'}
          className={`ec-cat-select ${item.Category === 'Material' ? 'ec-cat-select-material' : 'ec-cat-select-civil'}`}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      {dimCell('N', errorN)}
      {dimCell('L', errorL)}
      {dimCell('B', errorB)}
      {dimCell('D', errorD)}

      <div className="ec-grid-cell ec-cell-center">
        <span className={`ec-qty ${flashed ? 'ec-flash' : ''}`}>{fmt(qty)}</span>
      </div>

      <div className="ec-grid-cell ec-cell-center">
        <span className="ec-unit">{item.Unit}</span>
      </div>

      <div className="ec-grid-cell ec-cell-right">
        <span className="ec-rate">₹{fmt(rate)}</span>
      </div>

      <div className="ec-grid-cell ec-cell-right">
        <span className={`ec-amount ${flashed ? 'ec-flash' : ''}`}>₹{fmt(amt)}</span>
      </div>

      <div className="ec-grid-cell ec-cell-actions">
        {!disabled && (
          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onDuplicate(item)}
              title="Duplicate item"
              aria-label={`Duplicate item ${item.ItemCode}`}
              className="ec-btn-outline ec-btn-sm !p-1 hover:!bg-[#EFF6FF] hover:!text-[#1E3A5F]"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item._tempId)}
              title="Remove item"
              aria-label={`Remove item ${item.ItemCode}`}
              className="ec-btn-outline ec-btn-sm !p-1 hover:!bg-[#FEF2F2] hover:!text-[#DC2626]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ItemRow)
