import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, Fragment } from 'react'
import { useParams, useNavigate, useBlocker, Link } from 'react-router-dom'
import {
  Search, X, Save, RotateCcw, Send,
  Briefcase, Package,
  Clock, Lock, Printer, History, ClipboardList, Plus, Trash2, Check, Loader2
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { calcQtyByFormula, getFormulaFields } from '../utils/estimateUtils'
import { applyLocationChange, optionsFor } from '../utils/locationUtils'
import WorkflowStepper from '../components/shared/WorkflowStepper'
import ItemRow from '../components/estimate/ItemRow'

const WORK_CATEGORIES = ['Water Supply', 'Sewerage', 'EAM']
const FIELD_ORDER = ['N', 'L', 'B', 'D']
const SNAP_KEY = 'est_form_snapshot'
const RESTORE_KEY = 'est_form_scroll'
const EDITABLE_STATUSES = ['Draft', 'Reverted']
const GST_OPTIONS = [0, 5, 12, 18]

export default function EstimateForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const searchRowRef = useRef(null)
  const fieldRefs = useRef({})
  const draftIdRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const flashTimerRef = useRef(null)
  const skipBlockerRef = useRef(false)
  const stateRef = useRef({ header: null, items: [], dirty: false, isEdit, readOnly: false })
  const saveRef = useRef(() => {})

  const currentFY = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 4 ? `${y}-${(y + 1).toString().slice(-2)}` : `${y - 1}-${y.toString().slice(-2)}`
  })()
  const [header, setHeader] = useState({
    EstimateNo: '', NameOfWork: '', WorkCategory: '',
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

  // A new estimate opens with exactly one empty (draft) row so the Manager can
  // select the first item immediately; saved estimates load their own items.
  const seedRow = isEdit ? null : newDraftRow()
  const [items, setItems] = useState(() => (seedRow ? [seedRow] : []))
  const [draftTempId, setDraftTempId] = useState(seedRow ? seedRow._tempId : null)
  const [showRowSearch, setShowRowSearch] = useState(!!seedRow)
  const [lsProvisions, setLsProvisions] = useState([])
  const [additionalItems, setAdditionalItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [highlightedId, setHighlightedId] = useState(null)
  const [flashIds, setFlashIds] = useState(() => new Set())
  const [expandedDescIds, setExpandedDescIds] = useState(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [workflow, setWorkflow] = useState([])

  const [lookups, setLookups] = useState({
    regions: [], zones: [], divisions: [], circles: [], wards: [],
  })
  const [wardQuery, setWardQuery] = useState('')
  const [wardResults, setWardResults] = useState([])
  const [wardSearching, setWardSearching] = useState(false)
  const [showWardSearch, setShowWardSearch] = useState(false)
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
      setLookups({
        regions: reg.data || [], zones: zon.data || [], divisions: div.data || [],
        circles: cir.data || [], wards: war.data || [],
      })
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
      setWardQuery(e.WardName || '')
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

  // --- sessionStorage restore (feature: scroll/expansion/focus restoration on reload) ---
  useEffect(() => {
    if (isEdit) return
    try {
      const snap = sessionStorage.getItem(SNAP_KEY)
      if (snap) {
        const s = JSON.parse(snap)
        if (s?.header && s?.items?.length) {
          setHeader(h => ({ ...h, ...s.header }))
          setItems((s.items || []).filter(i => !i.isDraft))
          setDraftTempId(null)
          setShowRowSearch(false)
          setLsProvisions(s.lsProvisions || [])
          setAdditionalItems(s.additionalItems || [])
          setExpandedDescIds(new Set(s.expandedIds || []))
        }
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!dirty || readOnly) return
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SNAP_KEY, JSON.stringify({
          header, items, lsProvisions, additionalItems, expandedIds: [...expandedDescIds],
        }))
      } catch (_) {}
    }, 600)
    return () => clearTimeout(t)
  }, [dirty, header, items, lsProvisions, expandedDescIds, readOnly])

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

  const searchWards = useCallback(async (term) => {
    if (!term.trim()) { setWardResults([]); return }
    setWardSearching(true)
    try {
      const res = await api.get('/lookups/wards/search', { params: { q: term } })
      const rows = res.data || []
      setWardResults(scopeWardIds ? rows.filter(w => scopeWardIds.has(Number(w.WardID))) : rows)
    } catch (_) { setWardResults([]) }
    setWardSearching(false)
  }, [scopeWardIds])

  useEffect(() => {
    const timer = setTimeout(() => { if (wardQuery) searchWards(wardQuery) }, 300)
    return () => clearTimeout(timer)
  }, [wardQuery, searchWards])

  const selectWard = (w) => {
    setHeader(h => ({
      ...h,
      RegionID: w.RegionID, ZoneID: w.ZoneID, DivisionID: w.DivisionID,
      CircleID: w.CircleID, WardID: w.WardID,
    }))
    setWardQuery(w.WardName)
    setWardResults([])
    setShowWardSearch(false)
    setDirty(true)
    clearError('WardID')
  }

  // Selecting any level fills in its parents from the DB and prunes
  // descendants that conflict, so every saved combination stays consistent.
  const handleLocationChange = (field) => (e) => {
    const v = e.target.value
    setHeader(h => applyLocationChange(lookups, h, field, v))
    setWardQuery(field === 'WardID' && v
      ? (lookups.wards.find(w => String(w.WardID) === String(v))?.Name || '')
      : '')
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

  const focusField = useCallback((tempId, field) => {
    const el = fieldRefs.current[`${tempId}_${field}`]
    if (el) {
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      el.focus()
    }
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
    setTimeout(() => {
      const el = fieldRefs.current[`${tempId}_DESC`]
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      el?.focus()
    }, 50)
  }, [newDraftRow])

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
      setTimeout(() => fieldRefs.current[`${draftTempId}_DESC`]?.focus(), 0)
    } else {
      addDraftRow()
    }
  }, [draftTempId, addDraftRow])

  useEffect(() => {
    if (showRowSearch && draftTempId) {
      const t = setTimeout(() => fieldRefs.current[`${draftTempId}_DESC`]?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [showRowSearch, draftTempId])

  useEffect(() => {
    if (!showRowSearch) return
    const onDocMouseDown = (e) => {
      if (searchRowRef.current && !searchRowRef.current.contains(e.target)) closeRowSearch()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [showRowSearch, closeRowSearch])

  useEffect(() => {
    if (!showRowSearch || searchResults.length === 0) return
    const el = searchRowRef.current?.querySelector(`[data-result-index="${activeResult}"]`)
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

  const flashHighlight = useCallback((tempId) => {
    setHighlightedId(tempId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 1200)
  }, [])

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
    setShowRowSearch(false)
    setSearchTerm('')
    setSearchResults([])
    setActiveResult(0)
    setDirty(true)
    toast.success('Item added successfully')
    flashHighlight(tempId)
    setTimeout(() => focusField(tempId, 'N'), 60)
  }, [draftTempId, flashHighlight, focusField])

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
    flashHighlight(tempId)
    setTimeout(() => focusField(tempId, 'N'), 50)
  }, [flashHighlight, focusField])

  const updateItem = useCallback((tempId, field, value) => {
    const recalcFields = ['N', 'L', 'B', 'D', 'Rate', 'FormulaType']
    if (recalcFields.includes(field)) {
      setFlashIds(prev => new Set(prev).add(tempId))
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 500)
    }
    setItems(prev => prev.map(item => {
      if (item._tempId !== tempId) return item
      const updated = { ...item, [field]: value }
      if (recalcFields.includes(field)) {
        const qty = calcQtyByFormula(
          field === 'FormulaType' ? value : updated.FormulaType,
          field === 'N' ? value : updated.N,
          field === 'L' ? value : updated.L,
          field === 'B' ? value : updated.B,
          field === 'D' ? value : updated.D,
        )
        updated.Qty = parseFloat(qty.toFixed(3))
        updated.Amount = parseFloat((qty * parseFloat(field === 'Rate' ? value : updated.Rate || 0)).toFixed(2))
      }
      return updated
    }))
    setDirty(true)
  }, [])

  const toggleDesc = useCallback((tempId) => {
    setExpandedDescIds(prev => {
      const next = new Set(prev)
      if (next.has(tempId)) next.delete(tempId)
      else next.add(tempId)
      return next
    })
  }, [])

  const validate = () => {
    const errs = {}
    if (!header.NameOfWork?.trim()) errs.NameOfWork = 'Name of Work is required'
    if (!header.WorkCategory) errs.WorkCategory = 'Select a Work Category'
    if (!header.WardID) errs.WardID = 'Select a Ward'
    if (items.length === 0) errs.items = 'Add at least one item'
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
    if (key) focusField(item._tempId, key)
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
    const tempId = Date.now() + Math.random()
    setLsProvisions(prev => [...prev, { _tempId: tempId, Description: '', Amount: 0 }])
    setDirty(true)
    requestAnimationFrame(() => {
      const el = document.getElementById(`ls-desc-${tempId}`)
      if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }) }
    })
  }

  const updateLsProvision = (tempId, field, value) => {
    setLsProvisions(prev => prev.map(r => (r._tempId === tempId ? { ...r, [field]: value } : r)))
    setDirty(true)
  }

  const removeLsProvision = (tempId) => {
    setLsProvisions(prev => prev.filter(r => r._tempId !== tempId))
    setDirty(true)
  }

  const addAdditionalItem = () => {
    const tempId = Date.now() + Math.random()
    setAdditionalItems(prev => [...prev, { _tempId: tempId, Description: '', Amount: 0 }])
    setDirty(true)
    requestAnimationFrame(() => {
      const el = document.getElementById(`ai-desc-${tempId}`)
      if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }) }
    })
  }

  const updateAdditionalItem = (tempId, field, value) => {
    setAdditionalItems(prev => prev.map(r => (r._tempId === tempId ? { ...r, [field]: value } : r)))
    setDirty(true)
  }

  const removeAdditionalItem = (tempId) => {
    setAdditionalItems(prev => prev.filter(r => r._tempId !== tempId))
    setDirty(true)
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
    setHeader(prev => ({ ...prev, NameOfWork: '', Status: header.Status }))
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

  const handleCancel = () => {
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Leave this page?')
      if (!ok) return
    }
    skipBlockerRef.current = true
    sessionStorage.removeItem(SNAP_KEY)
    navigate(-1)
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

  const renderItemRow = (item, idx, search) => (
    <ItemRow
      key={item._tempId}
      item={item}
      idx={idx}
      highlighted={item._tempId === highlightedId}
      flashed={flashIds.has(item._tempId)}
      expanded={expandedDescIds.has(item._tempId)}
      disabled={readOnly}
      errorN={errors[`item_${idx}_N`]}
      errorL={errors[`item_${idx}_L`]}
      errorB={errors[`item_${idx}_B`]}
      errorD={errors[`item_${idx}_D`]}
      onUpdate={updateItem}
      onRemove={removeItem}
      onDuplicate={duplicateItem}
      onToggleDesc={toggleDesc}
      onFocusField={focusField}
      onFocusSearch={handleFocusSearch}
      fieldRefs={fieldRefs}
      search={search}
    />
  )

  const lastSavedLabel = lastSaved
    ? lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null
  const saved = lastSaved !== null && !dirty && !saving

  if (loading) return <div className="ec-loader"><div className="ec-spinner" /></div>

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="ec-page-title">{isEdit ? `Edit Estimate: ${header.EstimateNo}` : 'Create Estimate'}</h1>
              <p className="ec-page-subtitle">
                {isEdit ? `Estimate No: ${header.EstimateNo}` : 'Prepare a new estimate for your assigned works'}
              </p>
            </div>
            {(isEdit || draftIdRef.current) && lastSavedLabel && (
              <span className="flex items-center gap-1.5 text-[11px] text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5">
                <Clock className="w-3.5 h-3.5 text-[#94A3B8]" /> Last saved: {lastSavedLabel}
              </span>
            )}
          </div>

          {isEdit && header.Status === 'Reverted' && (() => {
            const lastRevert = workflow.filter(w => w.Action === 'Revert').pop()
            return (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
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
            <div className="mb-5 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
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

          {isEdit && <WorkflowStepper currentStatus={header.Status || 'Draft'} />}

          <div id="loc-details" className="mb-5">
            <h3 className="text-xs font-semibold text-[#475569] mb-2">Location</h3>
            <fieldset disabled={readOnly} className="min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {isManagerScope ? (
                  <>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-region">Corp</label>
                      <input id="loc-region" type="text" readOnly tabIndex={-1}
                        className="ef-loc-input"
                        value={assignedLoc?.RegionName || '—'} />
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-zone">Zone</label>
                      <input id="loc-zone" type="text" readOnly tabIndex={-1}
                        className="ef-loc-input"
                        value={assignedLoc?.ZoneName || '—'} />
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-division">Division</label>
                      <input id="loc-division" type="text" readOnly tabIndex={-1}
                        className="ef-loc-input"
                        value={assignedLoc?.DivisionName || '—'} />
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-circle">Circle</label>
                      <input id="loc-circle" type="text" readOnly tabIndex={-1}
                        className="ef-loc-input"
                        value={assignedLoc?.CircleName || nodeName || '—'} />
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-ward">Ward <span className="text-[#DC2626]">*</span></label>
                      <select id="loc-ward" name="WardID" value={header.WardID} onChange={handleLocationChange('WardID')}
                        className={`ef-loc-input ${errors.WardID ? 'ec-input-error' : ''}`}>
                        <option value="">Select Ward</option>
                        {locOpts.wards.map(w => (
                          <option key={w.WardID} value={w.WardID}>{w.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="ward-search">Search</label>
                      <div className="relative">
                        <input id="ward-search" name="wardSearch" type="text"
                          placeholder={nodeName ? `Search ${nodeName}...` : 'Search ward...'}
                          value={wardQuery}
                          onChange={e => { setWardQuery(e.target.value); setShowWardSearch(true) }}
                          onFocus={() => setShowWardSearch(true)}
                          className={`ef-loc-input ${errors.WardID ? 'ec-input-error' : ''}`}
                        />
                        {wardSearching && <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><div className="ec-spinner w-3.5 h-3.5" /></div>}
                        {showWardSearch && wardResults.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-md max-h-56 overflow-y-auto">
                            {wardResults.map(w => (
                              <button key={w.WardID} type="button" onClick={() => selectWard(w)}
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0">
                                <span className="font-medium text-[#1E3A5F]">{w.WardName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showWardSearch && wardQuery && wardResults.length === 0 && !wardSearching && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-md p-3">
                            <p className="text-xs text-[#94A3B8] text-center">No wards found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-region">Corp</label>
                      <select id="loc-region" name="RegionID" value={header.RegionID} onChange={handleLocationChange('RegionID')}
                        className="ef-loc-input">
                        <option value="">Select Corp</option>
                        {lookups.regions.map(r => (
                          <option key={r.RegionID} value={r.RegionID}>{r.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-zone">Zone</label>
                      <select id="loc-zone" name="ZoneID" value={header.ZoneID} onChange={handleLocationChange('ZoneID')}
                        className="ef-loc-input">
                        <option value="">Select Zone</option>
                        {locOpts.zones.map(z => (
                          <option key={z.ZoneID} value={z.ZoneID}>{z.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-division">Division</label>
                      <select id="loc-division" name="DivisionID" value={header.DivisionID} onChange={handleLocationChange('DivisionID')}
                        className="ef-loc-input">
                        <option value="">Select Division</option>
                        {locOpts.divisions.map(d => (
                          <option key={d.DivisionID} value={d.DivisionID}>{d.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-circle">Circle</label>
                      <select id="loc-circle" name="CircleID" value={header.CircleID} onChange={handleLocationChange('CircleID')}
                        className="ef-loc-input">
                        <option value="">Select Circle</option>
                        {locOpts.circles.map(c => (
                          <option key={c.CircleID} value={c.CircleID}>{c.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="loc-ward">Ward <span className="text-[#DC2626]">*</span></label>
                      <select id="loc-ward" name="WardID" value={header.WardID} onChange={handleLocationChange('WardID')}
                        className={`ef-loc-input ${errors.WardID ? 'ec-input-error' : ''}`}>
                        <option value="">Select Ward</option>
                        {locOpts.wards.map(w => (
                          <option key={w.WardID} value={w.WardID}>{w.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ef-loc-field">
                      <label className="ef-loc-label" htmlFor="ward-search">Search</label>
                      <div className="relative">
                        <input id="ward-search" name="wardSearch" type="text"
                          placeholder="Search ward name..."
                          value={wardQuery}
                          onChange={e => { setWardQuery(e.target.value); setShowWardSearch(true) }}
                          onFocus={() => setShowWardSearch(true)}
                          className={`ef-loc-input ${errors.WardID ? 'ec-input-error' : ''}`}
                        />
                        {wardSearching && <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><div className="ec-spinner w-3.5 h-3.5" /></div>}
                        {showWardSearch && wardResults.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-md max-h-56 overflow-y-auto">
                            {wardResults.map(w => (
                              <button key={w.WardID} type="button" onClick={() => selectWard(w)}
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0">
                                <span className="font-medium text-[#1E3A5F]">{w.WardName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showWardSearch && wardQuery && wardResults.length === 0 && !wardSearching && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-md p-3">
                            <p className="text-xs text-[#94A3B8] text-center">No wards found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {errors.WardID && <p className="ec-error-text mt-2">{errors.WardID}</p>}
            </fieldset>
          </div>

          <div id="work-details" className="mb-5">
            <h3 className="text-xs font-semibold text-[#475569] mb-2">Work Details</h3>
            <fieldset disabled={readOnly} className="min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="ef-loc-label" htmlFor="work-category">Work Category <span className="text-[#DC2626]">*</span></label>
                  <select id="work-category" name="WorkCategory" value={header.WorkCategory} onChange={set('WorkCategory')}
                    className={`ef-loc-input ${errors.WorkCategory ? 'ec-input-error' : ''}`}>
                    <option value="">Select</option>
                    {WORK_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.WorkCategory && <p className="ec-error-text">{errors.WorkCategory}</p>}
                </div>
                <div className="sm:col-span-3">
                  <label className="ef-loc-label" htmlFor="name-of-work">Work Name <span className="text-[#DC2626]">*</span></label>
                  <input id="name-of-work" name="NameOfWork" type="text" value={header.NameOfWork} onChange={set('NameOfWork')}
                    className={`ef-loc-input ${errors.NameOfWork ? 'ec-input-error' : ''}`}
                    placeholder="Enter work name" onFocus={() => clearError('NameOfWork')} />
                  {errors.NameOfWork && <p className="ec-error-text">{errors.NameOfWork}</p>}
                </div>
              </div>
            </fieldset>
          </div>

          <div className="ec-card mb-5" id="estimate-items">
            <div className="ec-card-header">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1E3A5F]" />
                <span className="ec-card-title">Estimate Items</span>
              </div>
              <span className="text-xs text-[#64748B]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="ec-card-body">
              {errors.items && <p className="ec-error-text mb-3">{errors.items}</p>}

              {items.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-3 border border-dashed border-[#E2E8F0] rounded-lg">
                  No items added yet. Click '+ Add New Estimate Item' below to add one.
                </p>
              ) : (
                <div className={`ec-grid-scroll ${showRowSearch ? 'ec-grid-scroll-adding' : ''}`}>
                  <div className="ec-item-grid">
                    <div className="ec-grid-row ec-grid-head">
                      <div className="ec-grid-cell ec-th justify-center">S.No</div>
                      <div className="ec-grid-cell ec-th justify-start">Item Description</div>
                      <div className="ec-grid-cell ec-th justify-center">Is Material</div>
                      <div className="ec-grid-cell ec-th justify-center">N</div>
                      <div className="ec-grid-cell ec-th justify-center">L</div>
                      <div className="ec-grid-cell ec-th justify-center">B</div>
                      <div className="ec-grid-cell ec-th justify-center">D</div>
                      <div className="ec-grid-cell ec-th justify-center">Qty</div>
                      <div className="ec-grid-cell ec-th justify-center">Unit</div>
                      <div className="ec-grid-cell ec-th justify-end">Rate (₹)</div>
                      <div className="ec-grid-cell ec-th justify-end">Amount (₹)</div>
                      <div className="ec-grid-cell ec-th justify-center">Actions</div>
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
                          cellRef: searchRowRef,
                        } : null)}
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}

              {!readOnly && (
                <button type="button"
                  onClick={() => (draftTempId ? handleFocusSearch() : addDraftRow())}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Add New Estimate Item
                </button>
              )}
            </div>
          </div>

          <div className="ec-card mb-5" id="cost-summary">
            <div className="ec-card-header">
              <span className="ec-card-title">Estimate Summary</span>
              <span className="text-[11px] text-[#94A3B8]">All amounts are in Indian Rupees (₹)</span>
            </div>
            <div className="ec-card-body">
              <div className="ec-sum2-grid">

                <div className="ec-sum2-card" aria-label="Part-I and Part-II summary">
                  <section className="ec-sum2-section ec-sum2-part-i" aria-label="Part-I Working Items">
                    <h4 className="ec-sum2-title">PART-I</h4>
                    <p className="ec-sum2-subtitle">Working Items</p>
                    <div className="ec-ga-row">
                      <span className="ec-ga-label">Cost of Material</span>
                      <span className="ec-ga-value">₹{fmt(totals.material)}</span>
                    </div>
                    <div className="ec-ga-row">
                      <span className="ec-ga-label">Cost of Civil Work</span>
                      <span className="ec-ga-value">₹{fmt(totals.civil)}</span>
                    </div>
                    <div className="ec-ga-dotted" />
                    <div className="ec-ga-row ec-ga-row-total">
                      <span className="ec-ga-label ec-ga-label-total">Cost of Estimate : Part-I</span>
                      <span className="ec-ga-value ec-ga-value-total">₹{fmt(totals.costOfEst)}</span>
                    </div>
                  </section>

                  <div className="ec-sum2-divider" />

                  <section className="ec-sum2-section ec-sum2-part-ii" aria-label="Part-II Additional Items">
                    <h4 className="ec-sum2-title">PART-II</h4>
                    <p className="ec-sum2-subtitle">Additional Items</p>
                    <p className="ec-sum2-note">Add non-schedule items, contingencies etc.</p>
                    <fieldset disabled={readOnly} className="min-w-0">
                      <div className="ec-sum2-gst-row">
                        <label htmlFor="gst" className="ec-ga-label">GST (%)</label>
                        <select id="gst" name="GSTPercent" value={header.GSTPercent} onChange={set('GSTPercent')}
                          className={`ec-ga-select ${errors.GSTPercent ? 'ec-input-error' : ''}`}>
                          {gstOptions.map(g => <option key={g} value={g}>{g}%</option>)}
                        </select>
                      </div>
                      {errors.GSTPercent && <p className="ec-error-text">{errors.GSTPercent}</p>}
                      <div className="ec-ga-ls-table-wrap ec-sum2-ls-scroll mt-2">
                        <table className="ec-ga-ls-table">
                          <colgroup>
                            <col className="ec-ga-ls-col-desc" />
                            <col className="ec-ga-ls-col-amt" />
                            <col className="ec-ga-ls-col-act" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="ec-ga-ls-th">Description</th>
                              <th className="ec-ga-ls-th ec-ga-ls-th-amt">Amount (₹)</th>
                              <th className="ec-ga-ls-th ec-ga-ls-th-act">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {additionalItems.length === 0 && (
                              <tr>
                                <td colSpan="3" className="ec-ga-ls-empty-cell">No additional items added yet</td>
                              </tr>
                            )}
                            {additionalItems.map(r => (
                              <tr key={r._tempId}>
                                <td className="ec-ga-ls-td">
                                  <textarea id={`ai-desc-${r._tempId}`} rows={2} value={r.Description}
                                    placeholder="Enter Description..."
                                    onChange={e => updateAdditionalItem(r._tempId, 'Description', e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        document.getElementById(`ai-amt-${r._tempId}`)?.focus()
                                      }
                                    }}
                                    className="ec-sum2-desc-textarea" />
                                </td>
                                <td className="ec-ga-ls-td">
                                  <input id={`ai-amt-${r._tempId}`} type="number" step="0.01" min="0" value={r.Amount}
                                    placeholder="0.00"
                                    onChange={e => updateAdditionalItem(r._tempId, 'Amount', e.target.value)}
                                    className="ec-ga-ls-input ec-ga-ls-input-amt" />
                                </td>
                                <td className="ec-ga-ls-td ec-ga-ls-td-act">
                                  <button type="button" onClick={() => removeAdditionalItem(r._tempId)}
                                    className="ec-ga-ls-remove" aria-label="Remove additional item">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="ec-ga-ls-actions">
                        <button type="button" onClick={addAdditionalItem} className="ec-ga-ls-add">
                          <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                      </div>
                      <div className="ec-sum2-total">
                        <span className="ec-sum2-total-label">Additional Items Total</span>
                        <span className="ec-sum2-total-value">₹{fmt(totals.additional)}</span>
                      </div>
                    </fieldset>
                  </section>
                </div>

                <div className="ec-sum2-card" aria-label="Part-III and Grand Total summary">
                  <section className="ec-sum2-section ec-sum2-part-iii" aria-label="Part-III LS Provisions">
                    <h4 className="ec-sum2-title">PART-III</h4>
                    <p className="ec-sum2-subtitle">LS Provisions</p>
                    <p className="ec-sum2-note">LS Unforeseen Items &amp; Rounding Off</p>
                    <fieldset disabled={readOnly} className="min-w-0">
                      <div className="ec-ga-ls-table-wrap ec-sum2-ls-scroll">
                        <table className="ec-ga-ls-table">
                          <colgroup>
                            <col className="ec-ga-ls-col-desc" />
                            <col className="ec-ga-ls-col-amt" />
                            <col className="ec-ga-ls-col-act" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="ec-ga-ls-th">Description</th>
                              <th className="ec-ga-ls-th ec-ga-ls-th-amt">Amount (₹)</th>
                              <th className="ec-ga-ls-th ec-ga-ls-th-act">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lsProvisions.length === 0 && (
                              <tr>
                                <td colSpan="3" className="ec-ga-ls-empty-cell">No LS provisions added yet</td>
                              </tr>
                            )}
                            {lsProvisions.map(r => (
                              <tr key={r._tempId}>
                                <td className="ec-ga-ls-td">
                                  <textarea id={`ls-desc-${r._tempId}`} rows={2} value={r.Description}
                                    placeholder="LS unforeseen items and rounding off..."
                                    onChange={e => updateLsProvision(r._tempId, 'Description', e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        document.getElementById(`ls-amt-${r._tempId}`)?.focus()
                                      }
                                    }}
                                    className="ec-sum2-desc-textarea" />
                                </td>
                                <td className="ec-ga-ls-td">
                                  <input id={`ls-amt-${r._tempId}`} type="number" step="0.01" min="0" value={r.Amount}
                                    placeholder="0.00"
                                    onChange={e => updateLsProvision(r._tempId, 'Amount', e.target.value)}
                                    className="ec-ga-ls-input ec-ga-ls-input-amt" />
                                </td>
                                <td className="ec-ga-ls-td ec-ga-ls-td-act">
                                  <button type="button" onClick={() => removeLsProvision(r._tempId)}
                                    className="ec-ga-ls-remove" aria-label="Remove LS provision">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="ec-ga-ls-actions">
                        <button type="button" onClick={addLsProvision} className="ec-ga-ls-add">
                          <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                      </div>
                      <div className="ec-sum2-total">
                        <span className="ec-sum2-total-label">LS Provision Total</span>
                        <span className="ec-sum2-total-value">₹{fmt(totals.lsProv)}</span>
                      </div>
                    </fieldset>
                  </section>

                  <div className="ec-sum2-divider" />

                  <section className="ec-sum2-section ec-sum2-grand" aria-label="Grand Total">
                    <h4 className="ec-sum2-title">GRAND TOTAL</h4>
                    <p className="ec-sum2-subtitle">Part-I + Part-II + Part-III</p>
                    <div className="ec-sum2-breakdown">
                      <div className="ec-sum2-bd-row">
                        <span className="ec-sum2-bd-label">Part-I (Working Items)</span>
                        <span className="ec-sum2-bd-value">₹{fmt(totals.costOfEst)}</span>
                      </div>
                      <div className="ec-sum2-bd-row">
                        <span className="ec-sum2-bd-label">Part-II (Additional Items)</span>
                        <span className="ec-sum2-bd-value">₹{fmt(totals.additional)}</span>
                      </div>
                      <div className="ec-sum2-bd-row">
                        <span className="ec-sum2-bd-label">GST @ {Number(header.GSTPercent) || 0}%</span>
                        <span className="ec-sum2-bd-value">₹{fmt(totals.gst)}</span>
                      </div>
                      <div className="ec-sum2-bd-row">
                        <span className="ec-sum2-bd-label">Part-III (LS Provisions)</span>
                        <span className="ec-sum2-bd-value">₹{fmt(totals.lsProv)}</span>
                      </div>
                    </div>
                    <div className="ec-sum2-grand-total">
                      <div className="flex items-center justify-between gap-2">
                        <span className="ec-sum2-grand-total-label">Grand Total</span>
                        <span className="ec-sum2-grand-total-value">₹{fmt(totals.grandTotal)}</span>
                      </div>
                    </div>
                  </section>
                </div>

              </div>
            </div>
          </div>

          {isEdit && header.Status === 'Reverted' && !readOnly && (
            <div className="ec-card mb-5">
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

          {!readOnly && (
            <div className="ef-action-bar flex-wrap gap-3" id="preview-submit">
              <div className="flex flex-wrap items-center gap-3">
                {isEdit && header.Status === 'Reverted' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => saveEstimate({})} disabled={saving || saved}
                      className={saved ? 'ec-btn ec-btn-success ec-btn-saved' : 'ec-btn ec-btn-primary'}>
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : saved ? (
                        <><Check className="w-4 h-4 ec-btn-saved-icon" /> Saved</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save</>
                      )}
                    </button>
                    <button type="button" onClick={goToMyEstimates} className="ec-btn-ghost">
                      <ClipboardList className="w-4 h-4" /> My Estimates
                    </button>
                    {!isEdit && (
                      <button type="button" onClick={handleReset} className="ec-btn-ghost">
                        <RotateCcw className="w-4 h-4" /> Reset
                      </button>
                    )}
                  </>
                )}
                <button type="button" onClick={handleCancel} className="ec-btn-ghost">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
