import { memo } from 'react'
import { Pencil, Trash2, Check } from 'lucide-react'
import NumericInput from '../NumericInput'
import ItemSearchDropdown from './ItemSearchDropdown'

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function ItemRow({
  item,
  idx,
  disabled,
  highlighted,
  flashed,
  isEditing,
  onToggleEdit,
  onUpdate,
  onRemove,
  onFocusField,
  onFocusSearch,
  fieldRefs,
  search,
}) {
  const qty = parseFloat(item.Qty || 0)
  const rate = parseFloat(item.Rate || 0)
  const amt = parseFloat(item.Amount || 0)
  const setFieldRef = (field) => (el) => {
    if (fieldRefs?.current) {
      fieldRefs.current[`${item._tempId}_${field}`] = el
    }
  }

  const DIM_NEXT = { N: 'L', L: 'B', B: 'D', D: 'Qty' }
  const DIM_PREV = { L: 'N', B: 'L', D: 'B' }

  // N → L → B → D → Qty forward navigation (Enter) plus backward navigation:
  // Backspace on an EMPTY field moves focus to the previous dimension. A
  // non-empty field keeps default Backspace behaviour (delete the value), and
  // decimals like 3.45 / 10.00 / 0.50 are never touched.
  const onDimKeyDown = (field) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFocusField?.(item._tempId, DIM_NEXT[field])
      return
    }
    if (e.key === 'Backspace') {
      const value = item[field]
      const isEmpty = value === undefined || value === null || value === ''
      const prev = DIM_PREV[field]
      if (isEmpty && prev) {
        e.preventDefault()
        onFocusField?.(item._tempId, prev)
      }
    }
  }

  const onQtyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFocusSearch?.()
    }
  }

  const actions = !disabled && (
    <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onToggleEdit(item._tempId)}
        title={isEditing ? 'Done editing' : 'Edit dimensions'}
        aria-label={isEditing ? 'Done editing' : `Edit item ${item.ItemCode}`}
        className={`p-1 rounded transition-colors ${
          isEditing
            ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 bg-emerald-50'
            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
        }`}
      >
        {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => onRemove(item._tempId)}
        title="Delete item"
        aria-label={`Delete item ${item.ItemCode}`}
        className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )

  const descBlock = search ? (
    <div className="ew-grid-cell ew-desc-cell col-span-1">
      <input
        ref={setFieldRef('DESC')}
        type="text"
        value={search.term}
        onChange={e => search.onTermChange(e.target.value)}
        onKeyDown={search.onKeyDown}
        onFocus={search.onFocus}
        placeholder="Search item by code or description..."
        className="ew-items-search ec-search-row-input"
        aria-label="Search estimate item"
        aria-expanded={search.open}
        role="combobox"
        autoComplete="off"
        spellCheck="false"
      />
      {search.open && (
        <ItemSearchDropdown
          searching={search.searching}
          query={search.term}
          results={search.results}
          activeResult={search.activeResult}
          onMouseEnter={search.onMouseEnter}
          onSelect={search.onSelect}
        />
      )}
    </div>
  ) : (
    <div className="ew-grid-cell ew-desc-cell py-0.5 px-2 text-left">
      <span className="font-bold text-xs text-slate-900 leading-tight block">{item.ItemCode}</span>
      <span className="text-xs text-slate-600 leading-snug block" style={{ wordBreak: 'break-word' }}>
        {item.Description}
      </span>
    </div>
  )

  const typeLabel = item.Category === 'Material' ? 'Material' : 'Civil Work'

  return (
    <div
      className={`ew-grid-row ${idx % 2 === 1 ? 'ew-grid-row-odd' : ''} ${
        highlighted ? 'ec-item-highlight-row' : ''
      } ${isEditing ? 'bg-blue-50/40' : ''}`}
    >
      {/* S.NO */}
      <div className="ew-grid-cell ew-cell-sno text-center text-xs font-medium text-slate-600">
        {idx + 1}
      </div>

      {/* ITEM CODE / DESCRIPTION */}
      {descBlock}

      {/* TYPE */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {isEditing && !search ? (
          <select
            value={item.Category || 'Civil'}
            onChange={e => onUpdate(item._tempId, 'Category', e.target.value)}
            className="text-[10px] py-0.5 px-1 rounded border border-[#CBD5E1] bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            title="Item Type"
            aria-label="Item Type"
          >
            <option value="Civil">Civil Work</option>
            <option value="Material">Material</option>
          </select>
        ) : (
          <span className="text-xs text-slate-600 font-medium">{search ? '-' : typeLabel}</span>
        )}
      </div>

      {/* N */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {search ? (
          <span className="text-slate-400 text-xs">-</span>
        ) : isEditing ? (
          <NumericInput
            id={`${item._tempId}_N`}
            ref={el => setFieldRef('N')(el)}
            value={item.N ?? ''}
            disabled={disabled}
            onChange={e => onUpdate(item._tempId, 'N', e.target.value)}
            onKeyDown={onDimKeyDown('N')}
            className="ew-dim-input ec-dim-input text-center"
            placeholder="-"
            autoComplete="off"
          />
        ) : (
          <span className="text-slate-500 text-xs font-medium">
            {item.N != null && item.N !== '' ? item.N : '-'}
          </span>
        )}
      </div>

      {/* L */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {search ? (
          <span className="text-slate-400 text-xs">-</span>
        ) : isEditing ? (
          <NumericInput
            id={`${item._tempId}_L`}
            ref={el => setFieldRef('L')(el)}
            value={item.L ?? ''}
            disabled={disabled}
            onChange={e => onUpdate(item._tempId, 'L', e.target.value)}
            onKeyDown={onDimKeyDown('L')}
            className="ew-dim-input ec-dim-input text-center"
            placeholder="-"
            autoComplete="off"
          />
        ) : (
          <span className="text-slate-500 text-xs font-medium">
            {item.L != null && item.L !== '' ? item.L : '-'}
          </span>
        )}
      </div>

      {/* B */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {search ? (
          <span className="text-slate-400 text-xs">-</span>
        ) : isEditing ? (
          <NumericInput
            id={`${item._tempId}_B`}
            ref={el => setFieldRef('B')(el)}
            value={item.B ?? ''}
            disabled={disabled}
            onChange={e => onUpdate(item._tempId, 'B', e.target.value)}
            onKeyDown={onDimKeyDown('B')}
            className="ew-dim-input ec-dim-input text-center"
            placeholder="-"
            autoComplete="off"
          />
        ) : (
          <span className="text-slate-500 text-xs font-medium">
            {item.B != null && item.B !== '' ? item.B : '-'}
          </span>
        )}
      </div>

      {/* D */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {search ? (
          <span className="text-slate-400 text-xs">-</span>
        ) : isEditing ? (
          <NumericInput
            id={`${item._tempId}_D`}
            ref={el => setFieldRef('D')(el)}
            value={item.D ?? ''}
            disabled={disabled}
            onChange={e => onUpdate(item._tempId, 'D', e.target.value)}
            onKeyDown={onDimKeyDown('D')}
            className="ew-dim-input ec-dim-input text-center"
            placeholder="-"
            autoComplete="off"
          />
        ) : (
          <span className="text-slate-500 text-xs font-medium">
            {item.D != null && item.D !== '' ? item.D : '-'}
          </span>
        )}
      </div>

      {/* QTY */}
      <div className="ew-grid-cell ew-cell-center px-1 text-center">
        {search ? (
          <span className="text-slate-400 text-xs">-</span>
        ) : isEditing ? (
          <NumericInput
            id={`${item._tempId}_Qty`}
            ref={el => setFieldRef('Qty')(el)}
            value={item.Qty ?? ''}
            disabled={disabled}
            onChange={e => onUpdate(item._tempId, 'Qty', e.target.value)}
            onKeyDown={onQtyKeyDown}
            className="ew-dim-input text-center"
            placeholder="0.00"
          />
        ) : (
          <span className={`text-slate-800 text-xs font-medium tabular-nums ${flashed ? 'ec-flash' : ''}`}>
            {fmt(qty)}
          </span>
        )}
      </div>

      {/* UNIT */}
      <div className="ew-grid-cell ew-cell-center text-center text-slate-700 text-xs">
        {item.Unit || '-'}
      </div>

      {/* RATE (₹) */}
      <div className="ew-grid-cell ew-cell-right text-right text-slate-800 text-xs font-medium tabular-nums px-2">
        {fmt(rate)}
      </div>

      {/* AMOUNT (₹) */}
      <div className="ew-grid-cell ew-cell-right text-right text-slate-900 text-xs font-semibold tabular-nums px-2">
        <span className={flashed ? 'ec-flash' : ''}>{fmt(amt)}</span>
      </div>

      {/* ACTIONS */}
      <div className="ew-grid-cell ew-cell-actions text-center">
        {search ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => onRemove(item._tempId)}
              title="Cancel item"
              className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          actions
        )}
      </div>
    </div>
  )
}

export default memo(ItemRow)