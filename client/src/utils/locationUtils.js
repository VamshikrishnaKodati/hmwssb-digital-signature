// Bidirectional hierarchy helpers for the Location Details selector.
// Hierarchy: Region (Corporation) -> Zone -> Division -> Circle -> Ward.
// The user may start at any level; parents resolve upward from the deepest
// selection and descendants are filtered by the nearest selected ancestor.
// All lookups come from the authoritative DB relationships (no guessing).

const locNum = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

const regionOfZone = (lookups, zoneId) => {
  const z = lookups.zones.find(x => x.ZoneID === locNum(zoneId))
  return z ? locNum(z.RegionID) : null
}
const zoneOfDivision = (lookups, divisionId) => {
  const d = lookups.divisions.find(x => x.DivisionID === locNum(divisionId))
  return d ? locNum(d.ZoneID) : null
}
const divisionOfCircle = (lookups, circleId) => {
  const c = lookups.circles.find(x => x.CircleID === locNum(circleId))
  return c ? locNum(c.DivisionID) : null
}
const circleOfWard = (lookups, wardId) => {
  const w = lookups.wards.find(x => x.WardID === locNum(wardId))
  return w ? locNum(w.CircleID) : null
}

// Fill in every parent of the changed field from the DB relationships.
function resolveParentsFrom(next, lookups, field) {
  if (field === 'WardID') {
    const c = circleOfWard(lookups, next.WardID)
    if (c) next.CircleID = c
    field = 'CircleID'
  }
  if (field === 'CircleID') {
    const d = divisionOfCircle(lookups, next.CircleID)
    if (d) next.DivisionID = d
    field = 'DivisionID'
  }
  if (field === 'DivisionID') {
    const z = zoneOfDivision(lookups, next.DivisionID)
    if (z) next.ZoneID = z
    field = 'ZoneID'
  }
  if (field === 'ZoneID') {
    const r = regionOfZone(lookups, next.ZoneID)
    if (r) next.RegionID = r
  }
}

// Clear descendants that are no longer valid under the changed field.
function pruneBelow(next, lookups, field) {
  if (field === 'RegionID') {
    if (next.ZoneID && regionOfZone(lookups, next.ZoneID) !== locNum(next.RegionID)) {
      next.ZoneID = ''
      next.DivisionID = ''
      next.CircleID = ''
      next.WardID = ''
    }
  } else if (field === 'ZoneID') {
    if (next.DivisionID && zoneOfDivision(lookups, next.DivisionID) !== locNum(next.ZoneID)) {
      next.DivisionID = ''
      next.CircleID = ''
      next.WardID = ''
    }
  } else if (field === 'DivisionID') {
    if (next.CircleID && divisionOfCircle(lookups, next.CircleID) !== locNum(next.DivisionID)) {
      next.CircleID = ''
      next.WardID = ''
    }
  } else if (field === 'CircleID') {
    if (next.WardID && circleOfWard(lookups, next.WardID) !== locNum(next.CircleID)) {
      next.WardID = ''
    }
  }
}

// Safety net: reject any chain where a value conflicts with a known parent,
// clearing the offending level and everything below it.
function pruneInvalidChain(next, lookups) {
  const R = locNum(next.RegionID)
  const Z = locNum(next.ZoneID)
  const D = locNum(next.DivisionID)
  const C = locNum(next.CircleID)
  const W = locNum(next.WardID)
  if (Z != null && R != null && regionOfZone(lookups, Z) !== R) {
    next.ZoneID = ''
    next.DivisionID = ''
    next.CircleID = ''
    next.WardID = ''
  } else if (D != null && Z != null && zoneOfDivision(lookups, D) !== Z) {
    next.DivisionID = ''
    next.CircleID = ''
    next.WardID = ''
  } else if (C != null && D != null && divisionOfCircle(lookups, C) !== D) {
    next.CircleID = ''
    next.WardID = ''
  } else if (W != null && C != null && circleOfWard(lookups, W) !== C) {
    next.WardID = ''
  }
  return next
}

// Core handler: apply a single field change and return the next consistent
// selection (parents resolved, invalid descendants cleared).
export function applyLocationChange(lookups, h, field, value) {
  const next = { ...h, [field]: value }
  resolveParentsFrom(next, lookups, field)
  pruneBelow(next, lookups, field)
  return pruneInvalidChain(next, lookups)
}

// Valid options for one level, filtered by the nearest selected ancestor.
// With no ancestor chosen, the full list is offered so the user can start
// anywhere in the hierarchy.
export function optionsFor(lookups, level, h) {
  const R = locNum(h.RegionID)
  const Z = locNum(h.ZoneID)
  const D = locNum(h.DivisionID)
  const C = locNum(h.CircleID)

  if (level === 'zones') {
    return R != null ? lookups.zones.filter(z => z.RegionID === R) : lookups.zones
  }

  if (level === 'divisions') {
    if (Z != null) return lookups.divisions.filter(d => d.ZoneID === Z)
    if (R != null) {
      const zones = new Set(lookups.zones.filter(z => z.RegionID === R).map(z => z.ZoneID))
      return lookups.divisions.filter(d => zones.has(d.ZoneID))
    }
    return lookups.divisions
  }

  if (level === 'circles') {
    if (D != null) return lookups.circles.filter(c => c.DivisionID === D)
    if (Z != null) {
      const divs = new Set(lookups.divisions.filter(d => d.ZoneID === Z).map(d => d.DivisionID))
      return lookups.circles.filter(c => divs.has(c.DivisionID))
    }
    if (R != null) {
      const zones = new Set(lookups.zones.filter(z => z.RegionID === R).map(z => z.ZoneID))
      const divs = new Set(lookups.divisions.filter(d => zones.has(d.ZoneID)).map(d => d.DivisionID))
      return lookups.circles.filter(c => divs.has(c.DivisionID))
    }
    return lookups.circles
  }

  if (C != null) return lookups.wards.filter(w => w.CircleID === C)
  if (D != null) {
    const circles = new Set(lookups.circles.filter(c => c.DivisionID === D).map(c => c.CircleID))
    return lookups.wards.filter(w => circles.has(w.CircleID))
  }
  if (Z != null) {
    const divs = new Set(lookups.divisions.filter(d => d.ZoneID === Z).map(d => d.DivisionID))
    const circles = new Set(lookups.circles.filter(c => divs.has(c.DivisionID)).map(c => c.CircleID))
    return lookups.wards.filter(w => circles.has(w.CircleID))
  }
  if (R != null) {
    const zones = new Set(lookups.zones.filter(z => z.RegionID === R).map(z => z.ZoneID))
    const divs = new Set(lookups.divisions.filter(d => zones.has(d.ZoneID)).map(d => d.DivisionID))
    const circles = new Set(lookups.circles.filter(c => divs.has(c.DivisionID)).map(c => c.CircleID))
    return lookups.wards.filter(w => circles.has(w.CircleID))
  }
  return lookups.wards
}
