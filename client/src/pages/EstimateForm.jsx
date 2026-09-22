import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, Fragment } from 'react'
import { useParams, useNavigate, useBlocker, Link } from 'react-router-dom'
import { Search, X, Save, RotateCcw, Send, Eye, Upload,
  Briefcase, Package,
  Lock, Printer, History, ClipboardList, Plus, Trash2, Check, Loader2, Pencil, ChevronDown
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { calcQtyByFormula, getFormulaFields } from '../utils/estimateUtils'
import { applyLocationChange, optionsFor } from '../utils/locationUtils'
import WorkflowStepper from '../components/shared/WorkflowStepper'
import ItemRow from '../components/estimate/ItemRow'
import { ItemFormDialog, ConfirmDialog } from '../components/estimate/EstimateItemDialog'
import EstimateDocuments from '../components/estimate/EstimateDocuments'
import EstimateDraftPrint from '../components/print/EstimateDraftPrint'

const WORK_CATEGORIES = ['Water Supply', 'Sewerage', 'EAM']
const FIELD_ORDER = ['N', 'L', 'B', 'D']
const SNAP_KEY = 'est_form_snapshot'
const RESTORE_KEY = 'est_form_scroll'
const EDITABLE_STATUSES = ['Draft', 'Reverted']
const GST_OPTIONS = [0, 5, 12, 18]
const DELETE_TITLE = { 'additional-item': 'Delete Additional Item', 'ls-provision': 'Delete LS Provision' }

// Scrolls a focused control into view INSIDE the internal item-list region
// only — never the whole document. Guarantees the workspace stays put while
// rows are added/edited.
function scrollIntoItemPanel(el) {
  const scroller = el?.closest?.('.ew-item-scroll')
  if (!scroller) return
  const r = el.getBoundingClientRect()
  const s = scroller.getBoundingClientRect()
  if (r.top < s.top) scroller.scrollBy({ top: r.top - s.top - 8, behavior: 'smooth' })
  else if (r.bottom > s.bottom) scroller.scrollBy({ top: r.bottom - s.bottom + 8, behavior: 'smooth' })
}

export default function EstimateForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const [savedId, setSavedId] = useState(isEdit && id ? Number(id) : null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const pickWrapRef = useRef(null)
  const fieldRefs = useRef({})
  const draftIdRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const flashTimerRef = useRef(null)
  const skipBlockerRef = useRef(false)
  const stateRef = useRef({ header: null, items: [], dirty: false, isEdit, readOnly: false })
  const saveRef = useRef(() => {})
  const docsRef = useRef(null)

  const currentFY = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 4 ? `${y}-${(y + 1).toString().slice(-2)}` : `${y - 1}-${y.toString().slice(-2)}`
  })()
  const [header, setHeader] = useState({
    EstimateNo: '',
    NameOfWork: '',
    WorkCategory: '',
    RegionID: '', ZoneID: '', DivisionID: '', CircleID: '', WardID: '',
    GSTPercent: 18, FinancialYear: currentFY,
    Status: '', ActionTakenReport: '',
  })
  const newDraftRow = useCallback(() => {
    const tempId = Date.now() + Math.random()
    return {
      _tempId: tempId, ItemID: null, ItemCode: '', Description: '', Category: 'Civil',
      FormulaType: '', Unit: '', Rate: 0, N: null, L: null, B: null, D: null,
      Qty: 0, Amount: 0, Remarks: '', isDraft: true,
    }
  }, [])

  const [items, setItems] = useState([])
  const [draftTempId, setDraftTempId] = useState(null)
  const [editingRowId, setEditingRowId] = useState(null)
  const [showRowSearch, setShowRowSearch] = useState(false)
  const liveItemCount = items.filter(i => !i.isDraft).length
  const [lsProvisions, setLsProvisions] = useState([])
  const [additionalItems, setAdditionalItems] = useState([])
  // One dialog at a time: null | { kind, edit } — edit is null for Add,
  // else the row being edited. Delete uses its own alertdialog (ConfirmDialog).
  const [itemDialog, setItemDialog] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Which Part-II/Part-III popup list is open: null | 'additional-item' | 'ls-provision'
  const [openPartList, setOpenPartList] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [pickTerm, setPickTerm] = useState('')
  const [pickResults, setPickResults] = useState([])
  const [pickSearching, setPickSearching] = useState(false)
  const [pickActive, setPickActive] = useState(0)
  const [showPick, setShowPick] = useState(false)
  const [highlightedId, setHighlightedId] = useState(null)
  const [flashIds, setFlashIds] = useState(() => new Set())
  const [expandedDescIds, setExpandedDescIds] = useState(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [workflow, setWorkflow] = useState([])

  const [lookups, setLookups] = useState({
    regions: [], zones: [], divisions: [], circles: [], wards: [],
  })
  const [scopeWardIds, setScopeWardIds] = useState(null) // Set of allowed WardIDs, null = unrestricted
  const [scopeCircleIds, setScopeCircleIds] = useState(null)
  const [scopeInfo, setScopeInfo] = useState(null)

  const readOnly = isEdit && header.Status && !EDITABLE_STATUSES.includes(header.Status)

  const isManagerScope = scopeInfo?.role === 'Manager' && scopeInfo?.scopeType === 'Circle'
  const nodeName = scopeInfo?.node?.nodeName || ''
  const assignedLoc = isManagerScope ? (scopeInfo?.assigned?.location || null) : null

  useEffect(() => {
    Promise.all([
      api.get('/lookups/regions'),
      api.get('/lookups/zones'),
      api.get('/lookups/divisions'),
      api.get('/lookups/circles'),
      api.get('/lookups/wards'),
    ]).then(([reg, zon, div, cir, war]) => {
      const lk = {
        regions: reg.data || [], zones: zon.data || [], divisions: div.data || [],
        circles: cir.data || [], wards: war.data || [],
      }
      setLookups(lk)
    }).catch(() => {})
    // Location-scope officers may only create estimates inside their assigned
    // node; /users/me/scope is the intersection the server will enforce.
    api.get('/users/me/scope').then(r => {
      const s = r.data
      if (s && s.scopeType !== 'All') {
        setScopeWardIds(new Set((s.wards || []).map(w => Number(w.WardID))))
        setScopeCircleIds(new Set((s.circles || []).map(c => Number(c.CircleID || c.ID))))
        const node = s.nodes && s.nodes[0]
        setScopeInfo({
          role: s.role,
          scopeType: s.scopeType,
          node: node || null,
          assigned: s.assignedLocation || null,
        })
        // /estimates/new prefills ONLY the assigned location (the manager's
        // circle chain / DGM's division chain); ward stays unselected.
        if (!isEdit && s.assignedLocation?.location) {
          const loc = s.assignedLocation.location
          setHeader(h => ({
            ...h,
            RegionID: loc.RegionID || '',
            ZoneID: loc.ZoneID || '',
            DivisionID: loc.DivisionID || '',
            CircleID: loc.CircleID || '',
          }))
        }
      }
    }).catch(() => {})
    if (id) loadEstimate()
  }, [id])

  // Options for each level come from the authoritative DB relationships. The
  // user may start at any level; options narrow by the nearest selected
  // ancestor (or the full list if none is chosen yet).
  const locOpts = useMemo(() => {
    const wards = optionsFor(lookups, 'wards', header)
    const scopedWards = scopeWardIds
      ? wards.filter(w => scopeWardIds.has(Number(w.WardID)))
      : wards
    const cur = header.WardID
    const curWard = cur !== '' && Number(cur) && !scopedWards.some(o => String(o.WardID) === String(cur))
      ? lookups.wards.find(x => String(x.WardID) === String(cur))
      : null
    const circles = optionsFor(lookups, 'circles', header)
    const scopedCircles = scopeCircleIds
      ? circles.filter(c => scopeCircleIds.has(Number(c.CircleID)))
      : circles
    const curCircle = header.CircleID !== '' && !scopedCircles.some(c => String(c.CircleID) === String(header.CircleID))
      ? circles.find(c => String(c.CircleID) === String(header.CircleID))
      : null
    return {
      zones: optionsFor(lookups, 'zones', header),
      divisions: optionsFor(lookups, 'divisions', header),
      circles: curCircle ? [...scopedCircles, curCircle] : scopedCircles,
      wards: curWard ? [...scopedWards, curWard] : scopedWards,
    }
  }, [lookups, header.RegionID, header.ZoneID, header.DivisionID, header.CircleID, header.WardID, scopeWardIds, scopeCircleIds])

  // Full "Corp / Zone / Division / Circle / Ward" path for the Location options.
  const wardPath = useCallback((w) => {
    const c = lookups.circles.find(x => Number(x.CircleID) === Number(w.CircleID))
    const d = c ? lookups.divisions.find(x => Number(x.DivisionID) === Number(c.DivisionID)) : null
    const z = d ? lookups.zones.find(x => Number(x.ZoneID) === Number(d.ZoneID)) : null
    const r = z ? lookups.regions.find(x => Number(x.RegionID) === Number(z.RegionID)) : null
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return [r?.Name, z?.Name, d?.Name, c?.Name, w.Name || w.WardName]
      .filter(Boolean)
      .filter((s, i, arr) => i === 0 || norm(s) !== norm(arr[i - 1]))
      .join(' / ')
  }, [lookups])

  const loadEstimate = async () => {
    try {
      const [res, wfRes] = await Promise.all([
        api.get(`/estimates/${id}`),
        api.get(`/workflow/${id}/history`).catch(() => ({ data: [] })),
      ])
      const e = res.data
      setHeader({
        EstimateNo: e.EstimateNo || e.WorkID || '', NameOfWork: e.NameOfWork || '', WorkCategory: e.WorkCategory || '',
        RegionID: e.RegionID || '', ZoneID: e.ZoneID || '', DivisionID: e.DivisionID || '',
        CircleID: e.CircleID || '', WardID: e.WardID || '',
        GSTPercent: e.GSTPercent || 18,
        FinancialYear: e.FinancialYear || currentFY,
        Status: e.Status || 'Draft',
        ActionTakenReport: e.ActionTakenReport || '',
      })
      const lsRows = (e.LSProvisions || []).map(r => ({
        _tempId: r.ID || Date.now() + Math.random(),
        Description: r.Description || '',
        Amount: r.Amount || 0,
      }))
      setLsProvisions(lsRows.length > 0
        ? lsRows
        : (Number(e.LSProvision) > 0
            ? [{ _tempId: Date.now() + Math.random(), Description: 'LS unforeseen items and rounding off', Amount: Number(e.LSProvision) }]
            : []))
      setAdditionalItems((e.AdditionalItems || []).map(r => ({
        _tempId: r.ID || Date.now() + Math.random(),
        Description: r.Description || '',
        Amount: r.Amount || 0,
      })))
      if (e.Items) {
        setItems(e.Items.map(i => ({
          _tempId: i.DetailID || Date.now() + Math.random(),
          ItemID: i.ItemID, ItemCode: i.ItemCode, Description: i.Description,
          Category: i.Category, FormulaType: i.FormulaType, Unit: i.Unit,
          Rate: i.Rate || 0, N: i.N, L: i.L, B: i.B, D: i.D,
          Qty: i.Qty || 0, Amount: i.Amount || 0, Remarks: i.Remarks || '',
        })))
      }
      setWorkflow(wfRes.data || [])
    } catch (_) { toast.error('Failed to load estimate') }
  }

  // /estimates/new must ALWAYS start fresh. Clear any auto-saved draft left
  // by an earlier session so it can never be restored on refresh or re-entry,
  // and reset the scroll position so the new form opens at the top.
  useEffect(() => {
    if (isEdit) return
    sessionStorage.removeItem(SNAP_KEY)
    sessionStorage.removeItem(RESTORE_KEY)
    document.getElementById('app-main')?.scrollTo?.({ top: 0 })
    window.scrollTo(0, 0)
  }, [isEdit])

  useEffect(() => {
    const main = document.getElementById('app-main')
    try {
      const saved = sessionStorage.getItem(RESTORE_KEY)
      if (saved) {
        const { scrollTop } = JSON.parse(saved)
        if (main && scrollTop) main.scrollTop = scrollTop
      }
    } catch (_) {}
    const onUnload = () => {
      if (main) sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ scrollTop: main.scrollTop }))
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // --- unsaved-changes guard (browser refresh) ---
  useEffect(() => {
    const handler = (e) => {
      if (dirty && !readOnly) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, readOnly])

  // --- unsaved-changes guard (in-app route change) ---
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
    if (skipBlockerRef.current) { skipBlockerRef.current = false; return false }
    return dirty && nextLocation.pathname !== currentLocation.pathname
  }, [dirty]))

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const ok = window.confirm('You have unsaved changes. Leave this page?')
      if (ok) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  // Close the Part-II/Part-III popup when clicking anywhere outside of it.
  useEffect(() => {
    if (!openPartList) return
    const onDown = (e) => {
      if (!e.target.closest?.('.ew-partlist')) setOpenPartList(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openPartList])

  // --- auto-save every 60s ---
  useEffect(() => {
    stateRef.current = { header, items, lsProvisions, additionalItems, dirty, isEdit, readOnly, id }
  })
  saveRef.current = (opts) => saveEstimate({ silent: true, skipValidate: true, ...opts })

  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current
      if (s.readOnly || !s.dirty) return
      if (!s.header?.NameOfWork?.trim() && s.items.length === 0) return
      const targetId = draftIdRef.current || s.id
      if (!targetId) return
      saveRef.current({})
    }, 60000)
    return () => clearInterval(t)
  }, [])

  // Selecting any level fills in its parents from the DB and prunes
  // descendants that conflict, so every saved combination stays consistent.
  const handleLocationChange = (field) => (e) => {
    const v = e.target.value
    setHeader(h => applyLocationChange(lookups, h, field, v))
    setDirty(true)
    clearError('WardID')
  }

  const searchItems = useCallback(async (term) => {
    if (!term.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await api.get(`/items?search=${encodeURIComponent(term)}&active=true`)
      const existingIds = new Set(items.map(i => i.ItemID))
      const results = (res.data || []).filter(i => !existingIds.has(i.ItemID))
      // eslint-disable-next-line no-console
      console.log('[EstimateForm] Items Loaded :', res.data?.length || 0,
        '| Civil :', (res.data || []).filter(i => i.Category === 'Civil').length,
        '| Material :', (res.data || []).filter(i => i.Category === 'Material').length)
      // eslint-disable-next-line no-console
      console.log('[EstimateForm] Search Results :', results.length)
      setSearchResults(results)
    } catch (_) { setSearchResults([]) }
    setSearching(false)
  }, [items])

  useEffect(() => {
    const timer = setTimeout(() => { if (searchTerm) searchItems(searchTerm) }, 200)
    return () => clearTimeout(timer)
  }, [searchTerm, searchItems])

  const expandItem = useCallback((tempId) => {
    // Single-open: picking an item opens only its dims editor.
    setExpandedDescIds(new Set([tempId]))
  }, [])

  // Focus the visible estimate-item search box. Each row renders two copies of
  // the input (desktop table cell + mobile card) sharing one ref key; the last
  // mounted — the mobile one, `display:none` on desktop — wins, so a shared
  // ref would target an invisible element and `.focus()` silently no-ops.
  // Target the visible copy directly instead.
  const focusDraftSearch = useCallback(() => {
    const scroller = document.querySelector('.ew-item-scroll')
    const el = scroller && [...scroller.querySelectorAll('input.ew-items-search')].find(c => c.offsetParent !== null)
    if (el) scrollIntoItemPanel(el)
    el?.focus()
    return el
  }, [])

  // Focus a field that may not have mounted yet (e.g. the dims detail row
  // renders only after the item is expanded). Retries briefly.
  const focusFieldRt = useCallback((tempId, field, tries = 6) => {
    const el = [...document.querySelectorAll(`[id="${CSS.escape(`${tempId}_${field}`)}"]`)].find(c => c.offsetParent !== null)
    if (el) {
      scrollIntoItemPanel(el)
      el.focus()
      // Keep the caret at the end of any existing value so keyboard
      // forward/backward navigation never disturbs the entered value.
      if (typeof el.setSelectionRange === 'function' && typeof el.value === 'string') {
        try { el.setSelectionRange(el.value.length, el.value.length) } catch (_) {}
      }
      return
    }
    if (tries > 0) setTimeout(() => focusFieldRt(tempId, field, tries - 1), 50)
  }, [])

  const addDraftRow = useCallback(() => {
    const draft = newDraftRow()
    const tempId = draft._tempId
    setItems(prev => [...prev, draft])
    setDraftTempId(tempId)
    setShowRowSearch(true)
    setSearchTerm('')
    setSearchResults([])
    setActiveResult(0)
    setDirty(true)
    setTimeout(() => { focusDraftSearch() }, 50)
  }, [newDraftRow, focusDraftSearch])

  // Header-level item search: typing shows a compact inline autocomplete
  // directly beneath the input; selecting one adds it as a new item.
  const flashHighlight = useCallback((tempId) => {
    setHighlightedId(tempId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 1200)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pickTerm.trim()) { setPickResults([]); setPickSearching(false); return }
      setPickSearching(true)
      api.get(`/items?search=${encodeURIComponent(pickTerm)}&active=true`)
        .then(res => {
          const existingIds = new Set(items.map(i => i.ItemID))
          setPickResults((res.data || []).filter(i => !existingIds.has(i.ItemID)))
        })
        .catch(() => setPickResults([]))
        .finally(() => setPickSearching(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [pickTerm, items])

  useEffect(() => { setPickActive(0) }, [pickResults])

  useEffect(() => {
    if (!showPick) return
    const el = pickWrapRef.current?.querySelector(`[data-pick-index="${pickActive}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [pickActive, showPick, pickResults])

  useEffect(() => {
    if (!showPick) return
    const onDocMouseDown = (e) => {
      if (pickWrapRef.current && !pickWrapRef.current.contains(e.target)) setShowPick(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [showPick])

  const selectPickItem = useCallback((item) => {
    const row = newDraftRow()
    const tempId = row._tempId
    setItems(prev => [...prev, {
      ...row, ItemID: item.ItemID, ItemCode: item.ItemCode, Description: item.Description,
      Category: item.Category, FormulaType: item.FormulaType, Unit: item.Unit,
      Rate: item.Rate || 0, isDraft: false,
    }])
    setPickTerm('')
    setPickResults([])
    setPickActive(0)
    setShowPick(false)
    setDirty(true)
    expandItem(tempId)
    flashHighlight(tempId)
    toast.success('Item added successfully')
    setTimeout(() => focusFieldRt(tempId, 'N'), 100)
  }, [newDraftRow, expandItem, flashHighlight, focusFieldRt])

  const handlePickKeyDown = (e) => {
    if (e.key === 'Escape') { setShowPick(false); return }
    if (e.key === 'ArrowDown' && pickResults.length) {
      e.preventDefault()
      setPickActive(a => (a + 1) % pickResults.length)
    } else if (e.key === 'ArrowUp' && pickResults.length) {
      e.preventDefault()
      setPickActive(a => (a - 1 + pickResults.length) % pickResults.length)
    } else if (e.key === 'Enter' && pickResults.length) {
      e.preventDefault()
      const item = pickResults[pickActive]
      if (item) selectPickItem(item)
    }
  }

  const openDraftSearch = useCallback(() => {
    setShowRowSearch(true)
  }, [])

  const closeRowSearch = useCallback(() => {
    setShowRowSearch(false)
    setSearchTerm('')
    setSearchResults([])
    setActiveResult(0)
  }, [])

  const handleFocusSearch = useCallback(() => {
    if (draftTempId) {
      setShowRowSearch(true)
      setTimeout(() => { focusDraftSearch() }, 0)
    } else {
      addDraftRow()
    }
  }, [draftTempId, addDraftRow, focusDraftSearch])

  useEffect(() => {
    if (showRowSearch && draftTempId) {
      const t = setTimeout(() => { focusDraftSearch() }, 0)
      return () => clearTimeout(t)
    }
  }, [showRowSearch, draftTempId, focusDraftSearch])

  useEffect(() => {
    if (!showRowSearch) return
    const onDocMouseDown = (e) => {
      if (!e.target.closest?.('.ew-desc-cell, .ew-mobile-item')) closeRowSearch()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [showRowSearch, closeRowSearch])

  useEffect(() => {
    if (!showRowSearch || searchResults.length === 0) return
    const el = document.querySelector(`.ew-item-scroll [data-result-index="${activeResult}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [activeResult, showRowSearch, searchResults])

  useEffect(() => {
    setActiveResult(0)
  }, [searchResults])

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (searchResults.length) setActiveResult(a => (a + 1) % searchResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (searchResults.length) setActiveResult(a => (a - 1 + searchResults.length) % searchResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = searchResults[activeResult]
      if (item) selectRowItem(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeRowSearch()
    }
  }

  const selectRowItem = useCallback((item) => {
    const tempId = draftTempId
    if (!tempId) return
    setItems(prev => prev.map(i => i._tempId === tempId ? {
      ...i,
      ItemID: item.ItemID, ItemCode: item.ItemCode, Description: item.Description,
      Category: item.Category, FormulaType: item.FormulaType, Unit: item.Unit,
      Rate: item.Rate || 0, isDraft: false, N: null, L: null, B: null, D: null, Qty: 0, Amount: 0,
    } : i))
    setDraftTempId(null)
    setEditingRowId(tempId)
    setShowRowSearch(false)
    setSearchTerm('')
    setSearchResults([])
    setActiveResult(0)
    setDirty(true)
    toast.success('Item added successfully')
    flashHighlight(tempId)
    expandItem(tempId)
    setTimeout(() => focusFieldRt(tempId, 'N'), 100)
  }, [draftTempId, flashHighlight, expandItem, focusFieldRt])

  const removeItem = useCallback((tempId) => {
    setItems(prev => prev.filter(i => i._tempId !== tempId))
    if (tempId === draftTempId) {
      setDraftTempId(null)
      setShowRowSearch(false)
      setSearchTerm('')
      setSearchResults([])
      setActiveResult(0)
    }
    setDirty(true)
  }, [draftTempId])

  const duplicateItem = useCallback((item) => {
    const tempId = Date.now() + Math.random()
    const copy = { ...item, _tempId: tempId, Qty: 0, Amount: 0 }
    setItems(prev => [...prev, copy])
    setDirty(true)
    expandItem(tempId)
    flashHighlight(tempId)
    setTimeout(() => focusFieldRt(tempId, 'N'), 100)
  }, [expandItem, flashHighlight, focusFieldRt])

  const updateItem = useCallback((tempId, field, value) => {
    const recalcFields = ['N', 'L', 'B', 'D', 'Rate', 'FormulaType', 'Qty']
    if (recalcFields.includes(field)) {
      setFlashIds(prev => new Set(prev).add(tempId))
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 500)
    }
    setItems(prev => prev.map(item => {
      if (item._tempId !== tempId) return item
      const updated = { ...item, [field]: value }
      if (recalcFields.includes(field)) {
        if (field === 'Qty') {
          const qtyVal = parseFloat(value) || 0
          updated.Qty = qtyVal
          updated.Amount = parseFloat((qtyVal * parseFloat(updated.Rate || 0)).toFixed(2))
        } else {
          let qty = calcQtyByFormula(
            field === 'FormulaType' ? value : updated.FormulaType,
            field === 'N' ? value : updated.N,
            field === 'L' ? value : updated.L,
            field === 'B' ? value : updated.B,
            field === 'D' ? value : updated.D,
          )
          if (qty === 0 && (updated.N != null && updated.N !== '')) {
            qty = parseFloat(updated.N) || 0
          }
          updated.Qty = parseFloat(qty.toFixed(3))
          updated.Amount = parseFloat((qty * parseFloat(field === 'Rate' ? value : updated.Rate || 0)).toFixed(2))
        }
      }
      return updated
    }))
    setDirty(true)
  }, [])

  const toggleDesc = useCallback((tempId) => {
    // Single-open: only the active/edited item shows its dims editor.
    setExpandedDescIds(prev => (prev.has(tempId) ? new Set() : new Set([tempId])))
  }, [])

  const validate = () => {
    const errs = {}
    if (!header.NameOfWork?.trim()) errs.NameOfWork = 'Name of Work is required'
    if (!header.WorkCategory) errs.WorkCategory = 'Select a Work Category'
    if (!header.WardID) errs.WardID = 'Select a Ward'
    if (items.filter(i => !i.isDraft).length === 0) errs.items = 'Add at least one item'
    if (!header.GSTPercent || parseFloat(header.GSTPercent) <= 0) errs.GSTPercent = 'GST percentage is required'
    if (isEdit && header.Status === 'Reverted' && !header.ActionTakenReport?.trim())
      errs.ActionTakenReport = 'Please describe the corrections made before resubmitting'
    setErrors(errs)
    return errs
  }

  const focusFirstError = (errs) => {
    const indices = Object.keys(errs)
      .filter(k => k.startsWith('item_'))
      .map(k => Number(k.split('_')[1]))
      .sort((a, b) => a - b)
    if (!indices.length) return
    const item = items[indices[0]]
    if (!item) return
    const fields = getFormulaFields(item.FormulaType)
    const key = FIELD_ORDER.find(x => fields[x])
    if (key) {
      expandItem(item._tempId)
      setTimeout(() => focusFieldRt(item._tempId, key), 100)
    }
  }

  const clearError = (field) => setErrors(prev => { const { [field]: _, ...rest } = prev; return rest })

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setHeader(prev => ({ ...prev, [field]: val }))
    setDirty(true)
    clearError(field)
  }

  const buildPayload = () => ({
    NameOfWork: header.NameOfWork,
    RegionID: parseInt(header.RegionID) || null,
    ZoneID: parseInt(header.ZoneID) || null,
    DivisionID: parseInt(header.DivisionID) || null,
    CircleID: parseInt(header.CircleID) || null,
    WardID: parseInt(header.WardID) || null,
    FinancialYear: header.FinancialYear || currentFY,
    WorkCategory: header.WorkCategory,
    ActionTakenReport: header.ActionTakenReport || null,
    LSProvisions: lsProvisions.map(r => ({
      Description: r.Description || '',
      Amount: parseFloat(r.Amount) || 0,
    })),
    AdditionalItems: additionalItems.map(r => ({
      Description: r.Description || '',
      Amount: parseFloat(r.Amount) || 0,
    })),
    GSTPercent: parseFloat(header.GSTPercent) || 18,
    Items: items.filter(i => !i.isDraft).map(i => ({
      DetailID: Number.isInteger(i._tempId) ? i._tempId : null,
      ItemID: i.ItemID, Category: i.Category, FormulaType: i.FormulaType,
      Unit: i.Unit, Rate: parseFloat(i.Rate) || 0,
      N: i.N, L: i.L, B: i.B, D: i.D, Remarks: i.Remarks || '',
    })),
  })

  const addLsProvision = () => {
    setItemDialog({ kind: 'ls-provision', edit: null })
  }

  const removeLsProvision = (tempId) => {
    setLsProvisions(prev => prev.filter(r => r._tempId !== tempId))
    setDirty(true)
  }

  const addAdditionalItem = () => {
    setItemDialog({ kind: 'additional-item', edit: null })
  }

  const removeAdditionalItem = (tempId) => {
    setAdditionalItems(prev => prev.filter(r => r._tempId !== tempId))
    setDirty(true)
  }

  const openEditDialog = (kind, row) => {
    setItemDialog({ kind, edit: { _tempId: row._tempId, Description: row.Description, Amount: row.Amount } })
  }

  // Single save path for both dialogs — appends or patches the existing state
  // arrays, which are what the existing whole-estimate save (+ totals) read.
  const saveItemFromDialog = (values) => {
    if (!itemDialog) return
    const { kind, edit } = itemDialog
    const apply = (rows) => {
      if (edit) {
        return rows.map(r => (r._tempId === edit._tempId ? { ...r, Description: values.Description, Amount: values.Amount } : r))
      }
      return [...rows, { _tempId: Date.now() + Math.random(), Description: values.Description, Amount: values.Amount }]
    }
    if (kind === 'additional-item') setAdditionalItems(apply)
    else setLsProvisions(apply)
    setDirty(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'additional-item') removeAdditionalItem(deleteTarget.row._tempId)
    else removeLsProvision(deleteTarget.row._tempId)
    setDeleteTarget(null)
  }

  const saveEstimate = async ({ silent = false, skipValidate = false } = {}) => {
    if (readOnly) return null
    if (!skipValidate) {
      const errs = validate()
      if (Object.keys(errs).length) {
        if (!silent) {
          toast.error('Please fix the highlighted fields')
          focusFirstError(errs)
        }
        return null
      }
    }
    setSaving(true)
    const payload = buildPayload()
    try {
      let targetId = isEdit ? id : draftIdRef.current
      if (!targetId) {
        const createRes = await api.post('/estimates', payload)
        targetId = createRes.data.EstimateID
        draftIdRef.current = targetId
        setHeader(h => ({
          ...h,
          EstimateNo: createRes.data.EstimateNo || h.EstimateNo,
          Status: createRes.data.Status || h.Status || 'Draft',
        }))
      } else {
        await api.put(`/estimates/${targetId}`, payload)
      }

      setDirty(false)
      setLastSaved(new Date())
      setSavedId(Number(targetId))
      sessionStorage.removeItem(SNAP_KEY)
      if (!silent) toast.success('Estimate saved successfully.')
      return targetId
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || 'Failed to save estimate. Please try again.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setHeader(prev => ({
      ...prev,
      NameOfWork: '',
      WorkCategory: '',
      Status: header.Status,
    }))
    setItems([])
    setDraftTempId(null)
    setShowRowSearch(false)
    setLsProvisions([])
    setAdditionalItems([])
    setErrors({})
    setDirty(false)
    setLastSaved(null)
    sessionStorage.removeItem(SNAP_KEY)
    toast.success('Form cleared')
  }

  const goToMyEstimates = () => {
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Leave this page?')
      if (!ok) return
    }
    skipBlockerRef.current = true
    sessionStorage.removeItem(SNAP_KEY)
    navigate('/estimates', {
      state: { highlightEstimateId: draftIdRef.current || (id ? Number(id) : null) },
    })
  }

  const deferredItems = useDeferredValue(items)

  const totals = useMemo(() => {
    const civil = deferredItems.filter(i => i.Category === 'Civil').reduce((s, i) => s + parseFloat(i.Amount || 0), 0)
    const material = deferredItems.filter(i => i.Category === 'Material').reduce((s, i) => s + parseFloat(i.Amount || 0), 0)
    const costOfEst = civil + material
    const gstPct = parseFloat(header.GSTPercent) || 0
    const lsProv = lsProvisions.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0)
    const additional = additionalItems.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0)
    const gst = costOfEst * gstPct / 100
    const subtotal = costOfEst + gst
    const grandTotal = subtotal + additional + lsProv
    const hasMaterial = deferredItems.some(i => i.Category === 'Material')
    return { civil, material, costOfEst, subtotal, gst, lsProv, additional, grandTotal, hasMaterial }
  }, [deferredItems, header.GSTPercent, lsProvisions, additionalItems])

  const gstOptions = useMemo(() => {
    const cur = Number(header.GSTPercent)
    const set = new Set(GST_OPTIONS)
    if (Number.isFinite(cur) && !set.has(cur)) set.add(cur)
    return [...set].sort((a, b) => a - b)
  }, [header.GSTPercent])

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  const selWard = header.WardID && locOpts?.wards
    ? locOpts.wards.find(w => Number(w.WardID) === Number(header.WardID)) : null
  const locationPreview = (selWard && wardPath(selWard)) || (
    [assignedLoc?.RegionName, assignedLoc?.ZoneName, assignedLoc?.DivisionName, assignedLoc?.CircleName || nodeName]
      .filter(Boolean).join(' / ')
  )

  // Opens a dedicated window holding only the rendered preview document, then
  // prints it — the Create Estimate page itself is never printed.
  const handlePreviewPrint = () => {
    const el = document.getElementById('estimate-preview-doc')
    if (!el) return
    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) {
      toast.error('Popup blocked. Please allow popups for this site to print the preview.')
      return
    }
    const inline = [...document.querySelectorAll('style, link[rel="stylesheet"]')]
      .map(s => s.outerHTML).join('\n')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estimate Preview</title>${inline}</head><body>${el.outerHTML}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const renderItemRow = (item, idx, search) => (
    <ItemRow
      key={item._tempId}
      item={item}
      idx={idx}
      disabled={readOnly}
      highlighted={item._tempId === highlightedId}
      flashed={flashIds.has(item._tempId)}
      isEditing={editingRowId === item._tempId}
      onToggleEdit={(id) => setEditingRowId(prev => prev === id ? null : id)}
      onUpdate={updateItem}
      onRemove={removeItem}
      onFocusField={focusFieldRt}
      onFocusSearch={handleFocusSearch}
      fieldRefs={fieldRefs}
      search={search}
    />
  )

  const saved = lastSaved !== null && !dirty && !saving

  // Compact count for Part-II / Part-III columns. Clicking it opens a popup
  // with the full list (edit/delete); the strip itself stays one line.
  const partCount = (kind, rows) => (
    <div className="ew-partlist">
      {readOnly ? (
        <span className="ec-ai-count">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
      ) : (
        <>
          <button type="button" onClick={() => setOpenPartList(openPartList === kind ? null : kind)}
            className="ec-ai-count-btn" aria-expanded={openPartList === kind} aria-haspopup="true">
            <span>{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${openPartList === kind ? 'rotate-180' : ''}`} />
          </button>
          {openPartList === kind && (
            <div className="ew-partlist-pop">{renderPartRows(kind, rows)}</div>
          )}
        </>
      )}
    </div>
  )

  // Compact read-only rows for Part-II / Part-III. Editing happens in the
  // Add/Edit dialog; this only lists results with edit/delete affordances.
  const renderPartRows = (kind, rows) => {
    const label = kind === 'additional-item'
      ? (rows.length === 1 ? 'additional item' : 'additional items')
      : (rows.length === 1 ? 'LS provision' : 'LS provisions')
    if (rows.length === 0) {
      return (
        <p className="ec-ai-empty">
          {kind === 'additional-item' ? 'No additional items added yet' : 'No LS provisions added yet'}
        </p>
      )
    }
    return (
      <div className="ec-ai-list">
        <p className="ec-ai-count">{rows.length} {label}</p>
        {rows.map(r => (
          <div key={r._tempId} className="ec-ai-item">
            <div className="ec-ai-main">
              <p className="ec-ai-desc">{r.Description || '—'}</p>
              <span className="ec-ai-amt">₹{fmt(r.Amount)}</span>
            </div>
            {!readOnly && (
              <div className="ec-ai-actions">
                <button type="button" onClick={() => openEditDialog(kind, r)}
                  className="ec-ai-btn" aria-label={`Edit ${kind === 'additional-item' ? 'additional item' : 'LS provision'}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setDeleteTarget({ kind, row: r })}
                  className="ec-ai-btn ec-ai-btn-danger" aria-label={`Delete ${kind === 'additional-item' ? 'additional item' : 'LS provision'}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  return (
    <div className="min-w-0 h-full min-h-0 flex flex-col">
          {isEdit && header.Status === 'Reverted' && (() => {
            const lastRevert = workflow.filter(w => w.Action === 'Revert').pop()
            return (
              <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg shrink-0">
                <p className="text-sm font-medium text-red-800">This estimate has been reverted for corrections</p>
                <p className="text-xs text-red-600 mt-0.5">Update the items as per the reversion remarks and resubmit.</p>
                {lastRevert && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-red-500 font-medium">Reverted by: </span>
                      <span className="text-red-800 font-semibold">{lastRevert.FromUserName || '—'}</span>
                      {lastRevert.FromDesignation && <span className="text-red-600"> — {lastRevert.FromDesignation}</span>}
                    </div>
                    <div>
                      <span className="text-red-500 font-medium">Reverted on: </span>
                      <span className="text-red-800">{fmtDateTime(lastRevert.DateTime)}</span>
                    </div>
                    {lastRevert.Remarks && (
                      <div className="sm:col-span-3">
                        <span className="text-red-500 font-medium">Reason: </span>
                        <span className="text-red-800 italic">"{lastRevert.Remarks}"</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {readOnly && (
            <div className="mb-2 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-[#166534]">
                <Lock className="w-4 h-4" /> This estimate is {header.Status} and locked for editing
              </div>
              <p className="text-xs text-[#166534]/80 mt-1">
                The estimate has moved forward in the workflow. Use the buttons below to view or print.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link to={`/print/estimate/${id}/civil`} target="_blank" className="ec-btn-outline ec-btn-sm">
                  <Printer className="w-3.5 h-3.5" /> Preview Civil PDF
                </Link>
                {totals.hasMaterial && (
                  <Link to={`/print/estimate/${id}/material`} target="_blank" className="ec-btn-outline ec-btn-sm">
                    <Printer className="w-3.5 h-3.5" /> Download Material PDF
                  </Link>
                )}
                <Link to={`/print/estimate/${id}/abstract`} target="_blank" className="ec-btn-outline ec-btn-sm">
                  <Printer className="w-3.5 h-3.5" /> Print Abstract
                </Link>
                <Link to={`/estimates/${id}`} className="ec-btn-outline ec-btn-sm">
                  <History className="w-3.5 h-3.5" /> Movement History / Track Status
                </Link>
              </div>
            </div>
          )}

          {isEdit && <div className="shrink-0"><WorkflowStepper currentStatus={header.Status || 'Draft'} /></div>}

          {/* ── ONE unified Create-Estimate workspace frame ── */}
          <div className="ew-frame min-h-0" id="estimate-items">
          <div id="loc-details" className="ew-loc-bar bg-white/55 border border-white/55 rounded-xl p-1.5 shrink-0 backdrop-blur-[2px]">
            <fieldset disabled={readOnly} className="min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-start">
                <div className="md:col-span-3">
                  <label className="ew-loc-label block text-[10px] font-semibold uppercase tracking-wide text-slate-700 mb-0.5" htmlFor="loc-ward">Location</label>
                  <select id="loc-ward" name="WardID" value={header.WardID} onChange={handleLocationChange('WardID')}
                    className={`ew-loc-input w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${errors.WardID ? 'border-red-500' : ''}`}>
                    <option value="">Select Location</option>
                    {locOpts.wards.map(w => (
                      <option key={w.WardID} value={w.WardID}>{wardPath(w)}</option>
                    ))}
                  </select>
                  <input type="hidden" id="loc-region" value={assignedLoc?.RegionName || '—'} readOnly />
                  <input type="hidden" id="loc-zone" value={assignedLoc?.ZoneName || '—'} readOnly />
                  <input type="hidden" id="loc-division" value={assignedLoc?.DivisionName || '—'} readOnly />
                  <input type="hidden" id="loc-circle" value={assignedLoc?.CircleName || nodeName || '—'} readOnly />
                  {errors.WardID && <p className="ec-error-text mt-0.5">{errors.WardID}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="ew-loc-label block text-[10px] font-semibold uppercase tracking-wide text-slate-700 mb-0.5" htmlFor="work-category">Work Category <span className="text-[#DC2626]">*</span></label>
                  <select id="work-category" name="WorkCategory" value={header.WorkCategory} onChange={set('WorkCategory')}
                    className={`ew-loc-input w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${errors.WorkCategory ? 'border-red-500' : ''}`}>
                    <option value="">Select</option>
                    {WORK_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.WorkCategory && <p className="ec-error-text mt-0.5">{errors.WorkCategory}</p>}
                </div>
                <div className="md:col-span-7">
                  <label className="ew-loc-label block text-[10px] font-semibold uppercase tracking-wide text-slate-700 mb-0.5" htmlFor="name-of-work">Work Name <span className="text-[#DC2626]">*</span></label>
                  <input id="name-of-work" name="NameOfWork" type="text" value={header.NameOfWork} onChange={set('NameOfWork')}
                    className={`ew-loc-input w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${errors.NameOfWork ? 'border-red-500' : ''}`}
                    placeholder="Enter work name" onFocus={() => clearError('NameOfWork')} />
                  {errors.NameOfWork && <p className="ec-error-text mt-0.5">{errors.NameOfWork}</p>}
                </div>
              </div>
            </fieldset>
          </div>

          {isEdit && header.Status === 'Reverted' && !readOnly && (
            <div className="ec-card ew-atr-card">
              <div className="ec-card-header">
                <span className="ec-card-title">Action Taken Report <span className="text-[#DC2626]">*</span></span>
              </div>
              <div className="ec-card-body">
                <textarea id="atr" name="ActionTakenReport" rows={3} value={header.ActionTakenReport || ''}
                  onChange={set('ActionTakenReport')}
                  className="ec-textarea"
                  placeholder="Describe the corrections made in response to the reversion remarks"
                />
                {errors.ActionTakenReport && <p className="ec-error-text">{errors.ActionTakenReport}</p>}
              </div>
            </div>
          )}

          {/* ── Estimate Editing Workspace: items | summary ── */}
          <div className="ew-workspace min-h-0">

            <div className="ew-items-panel bg-white/70 border border-white/60 rounded-xl shadow-xs flex flex-col">
              <div className="ew-items-headerbar flex items-center justify-between px-3 py-1.5 border-b border-white/70 bg-white/50 shrink-0">
                <div className="flex items-center">
                  <h3 className="text-sm font-bold text-slate-900">Estimate Items</h3>
                  <span className="ew-items-count ml-2 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-medium">
                    {liveItemCount} items
                  </span>
                </div>
              </div>

              {errors.items && <p className="ec-error-text px-5 pt-2">{errors.items}</p>}

              <div className="ew-item-scroll">
                {items.length === 0 ? (
                  <p className="ew-items-empty text-xs text-slate-400 text-center py-5 mx-3 my-1 border border-dashed border-slate-200 rounded-lg">
                    No items added yet. Click '+ Add Estimate Item' below to get started.
                  </p>
                ) : (
                  <div className="ew-item-table">
                    <div className="ew-grid-row ew-grid-head">
                      <div className="ew-grid-cell ew-th ew-cell-sno">S.NO</div>
                      <div className="ew-grid-cell ew-th justify-start">ITEM DESCRIPTION</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">TYPE</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">N</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">L</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">B</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">D</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">QTY</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">UNIT</div>
                      <div className="ew-grid-cell ew-th ew-cell-right">RATE (₹)</div>
                      <div className="ew-grid-cell ew-th ew-cell-right">AMOUNT (₹)</div>
                      <div className="ew-grid-cell ew-th ew-cell-center">ACTIONS</div>
                    </div>
                    {items.map((item, i) => (
                      <Fragment key={item._tempId}>
                        {renderItemRow(item, i, item._tempId === draftTempId ? {
                          open: showRowSearch,
                          term: searchTerm,
                          searching,
                          results: searchResults,
                          activeResult,
                          onTermChange: setSearchTerm,
                          onKeyDown: handleSearchKeyDown,
                          onFocus: openDraftSearch,
                          onSelect: selectRowItem,
                          onMouseEnter: setActiveResult,
                        } : null)}
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>

              {!readOnly && (
                <div className="flex justify-end px-3 pt-1.5 shrink-0">
                  <button type="button"
                    onClick={() => (draftTempId ? handleFocusSearch() : addDraftRow())}
                    className="ew-add-item-btn flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/5 bg-white/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    Add Estimate Item
                  </button>
                </div>
              )}

              <EstimateDocuments ref={docsRef} estimateId={savedId} canEdit={!readOnly && user?.Designation === 'Manager'} />
            </div>

            <div className="ew-summary-panel" id="cost-summary">
                {/* PART-I : WORKING ITEMS */}
                <div className="ew-sum-card bg-[#F0F7FF] border border-[#DBEAFE] rounded-xl p-2 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1D4ED8] uppercase tracking-wide">
                      PART-I : WORKING ITEMS
                    </h4>
                    <div className="space-y-1.5 mt-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Cost of Material</span>
                        <span className="font-semibold text-slate-900 tabular-nums">₹ {fmt(totals.material)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Cost of Civil Work</span>
                        <span className="font-semibold text-slate-900 tabular-nums">₹ {fmt(totals.civil)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[#DBEAFE] pt-1.5 mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Part-I Total</span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">₹ {fmt(totals.costOfEst)}</span>
                  </div>
                </div>

                {/* PART-II : REIMBURSEMENTS */}
                <div className="ew-sum-card bg-[#EDFAF3] border border-[#A7F3D0] rounded-xl p-2 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#059669] uppercase tracking-wide">
                      PART-II : REIMBURSEMENTS
                    </h4>
                    <div className="space-y-1.5 mt-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <label htmlFor="gst" className="text-slate-600">GST (%)</label>
                        <select
                          id="gst"
                          name="GSTPercent"
                          value={header.GSTPercent}
                          onChange={set('GSTPercent')}
                          disabled={readOnly}
                          className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {gstOptions.map(g => <option key={g} value={g}>{g}%</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Items</span>
                        <span className="font-medium text-slate-900">{additionalItems.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Total</span>
                        <span className="font-semibold text-slate-900 tabular-nums">₹ {fmt(totals.additional)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={addAdditionalItem}
                        className="w-full py-1 px-3 bg-white border border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Reimbursement
                      </button>
                    )}
                  </div>
                </div>

                {/* PART-III : LS PROVISIONS */}
                <div className="ew-sum-card bg-[#F5F0FF] border border-[#E9D5FF] rounded-xl p-2 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wide">
                      PART-III : LS PROVISIONS
                    </h4>
                    <div className="space-y-1.5 mt-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Items</span>
                        <span className="font-medium text-slate-900">{lsProvisions.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Total</span>
                        <span className="font-semibold text-slate-900 tabular-nums">₹ {fmt(totals.lsProv)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={addLsProvision}
                        className="w-full py-1 px-3 bg-white border border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add LS Provision
                      </button>
                    )}
                  </div>
                </div>

                {/* GRAND TOTAL */}
                <div className="ew-sum-card ew-sum-grand bg-[#FFFBEA] border border-[#FEF08A] rounded-xl p-2 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">
                      GRAND TOTAL
                    </h4>
                    <div className="space-y-1 mt-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Part-I Total</span>
                        <span className="font-medium text-slate-900 tabular-nums">₹ {fmt(totals.costOfEst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Part-II Total</span>
                        <span className="font-medium text-slate-900 tabular-nums">₹ {fmt(totals.additional)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Part-III Total</span>
                        <span className="font-medium text-slate-900 tabular-nums">₹ {fmt(totals.lsProv)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>GST Amount ({Number(header.GSTPercent) || 0}%)</span>
                        <span className="font-medium text-slate-900 tabular-nums">₹ {fmt(totals.gst)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[#FEF08A] pt-1.5 mt-2 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">GRAND TOTAL</span>
                    <span className="text-base font-extrabold text-[#0F172A] tabular-nums">₹ {fmt(totals.grandTotal)}</span>
                  </div>
                </div>
            </div>
          </div>

          {!readOnly && (
            <div className="ew-action-wrap">
              <div className="flex flex-wrap items-center gap-3 w-full justify-between" id="preview-submit">
                {isEdit && header.Status === 'Reverted' ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => saveEstimate({})} disabled={saving || saved}
                      className={saved ? 'ec-btn ec-btn-success ec-btn-saved' : 'ec-btn ec-btn-primary'}>
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : saved ? (
                        <><Check className="w-4 h-4 ec-btn-saved-icon" /> Saved</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save Changes</>
                      )}
                    </button>
                    <button type="button" onClick={async () => {
                      if (!header.ActionTakenReport?.trim()) {
                        toast.error('Please describe the corrections made before resubmitting.')
                        setErrors(prev => ({ ...prev, ActionTakenReport: 'Action Taken Report is required for resubmission' }))
                        document.getElementById('atr')?.focus()
                        return
                      }
                      const savedId = await saveEstimate({})
                      if (savedId) {
                        skipBlockerRef.current = true
                        navigate(`/estimates/${savedId}`)
                      }
                    }} disabled={saving}
                      className="ec-btn ec-btn-primary">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {saving ? 'Saving...' : 'Submit to DGM'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => saveEstimate({})} disabled={saving || saved}
                      className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors">
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : saved ? (
                        <><Check className="w-4 h-4" /> Saved</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save</>
                      )}
                    </button>
                    <button type="button" onClick={() => setPreviewOpen(true)} className="ew-action-btn">
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button type="button" onClick={() => docsRef.current?.openPicker()} className="ew-action-btn">
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                    {!isEdit && (
                      <button type="button" onClick={handleReset} className="ew-action-btn">
                        <RotateCcw className="w-4 h-4" /> Reset
                      </button>
                    )}
                  </div>
                )}
                <button type="button" onClick={goToMyEstimates} className="ew-action-btn">
                  <ClipboardList className="w-4 h-4" /> My Estimates
                </button>
              </div>
            </div>
          )}
          </div>

          <ItemFormDialog
            open={!!itemDialog}
            data={itemDialog}
            gstPercent={header.GSTPercent}
            onClose={() => setItemDialog(null)}
            onSave={saveItemFromDialog}
          />
          <ConfirmDialog
            open={!!deleteTarget}
            title={deleteTarget ? DELETE_TITLE[deleteTarget.kind] : ''}
            message="This will remove the item from this estimate."
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onClose={() => setDeleteTarget(null)}
          />

          {previewOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/50" role="dialog" aria-modal="true" aria-label="Estimate preview">
              <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white/95 backdrop-blur border-b border-slate-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Estimate Preview</h3>
                  <p className="text-xs text-slate-600">Current estimate in A4 print format</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={handlePreviewPrint} className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button type="button" onClick={() => setPreviewOpen(false)} className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-6">
                <EstimateDraftPrint
                  nameOfWork={header.NameOfWork}
                  workCategory={header.WorkCategory}
                  locationLine={locationPreview}
                  items={items}
                  additionalItems={additionalItems}
                  lsProvisions={lsProvisions}
                  gstPercent={header.GSTPercent}
                />
              </div>
            </div>
          )}
        </div>
  )
}
