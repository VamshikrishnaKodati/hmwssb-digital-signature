// Client-side mirror of server/middleware/rbac.js canPerform. Reads the user
// object (login payload, refreshed at runtime via /auth/profile) which carries
// the role's RBAC permission keys and the legacy location scope columns. UI
// actions are shown/hidden with the same rule the API enforces — never
// role-name-only (e.g. `role === 'DGM'`). The server still re-checks everything
// on every request; this only controls visibility, never authorization.

// Permission-only check (mirrors server checkPermission): does the user hold the
// key? Used for workflow actions whose backend gate is permission + owner +
// status (no location scope).
export function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) return false
  if (user.IsActive === false) return false
  return (user.Permissions || []).includes(permissionKey)
}

// Full entity-aware check (mirrors server canPerform): permission + active user
// + location scope + the workflow-state rule for the edit action. This is the
// rule behind the Edit Estimate button and the PUT /estimates/:id authorization.
export function canPerform(user, resource, action, entity) {
  if (!user || !resource || !action) return false
  if (!hasPermission(user, `${resource}.${action}`)) return false
  if (resource !== 'estimate' || !entity) return true
  // Creators are always in scope (a reassignment must never hide historical work).
  if (entity.CreatedBy !== user.UserID && !entityInScope(user, entity)) return false
  // Workflow-state rule: the only statuses the edit APIs accept.
  if (action === 'edit' && !['Draft', 'Reverted'].includes(entity.Status)) return false
  return true
}

// Location roles hold a single active assignment (assignUserScope deactivates
// the previous row), mirrored into the legacy Users.*ID columns, so one ID
// comparison per role is an exact scope check. Unknown location roles are board-wide.
function entityInScope(user, entity) {
  let userNode, entityNode
  switch (user.Designation) {
    case 'Manager': userNode = user.CircleID; entityNode = entity.CircleID; break
    case 'DGM': userNode = user.DivisionID; entityNode = entity.DivisionID; break
    case 'GM': userNode = user.ZoneID; entityNode = entity.ZoneID; break
    case 'CGM': userNode = user.RegionID; entityNode = entity.RegionID; break
    default: return true
  }
  return userNode != null && Number(entityNode) === Number(userNode)
}

export default canPerform