import { navItems, isPathActive } from '../config/navConfig'

const detailTitles = [
  { match: /^\/estimates\/\d+\/abstract$/, label: 'Abstract Preview' },
  { match: /^\/estimates\/\d+\/edit$/, label: 'Edit Estimate' },
  { match: /^\/estimates\/\d+$/, label: 'Estimate Details' },
  { match: /^\/estimates\/new$/, label: 'Prepare Estimate' },
  { match: /^\/estimates$/, label: 'My Estimates' },
  { match: /^\/items$/, label: 'Item Master', admin: true },
  { match: /^\/users$/, label: 'User Management', admin: true },
  { match: /^\/audit-logs$/, label: 'Audit Logs', admin: true },
  { match: /^\/approvals$/, label: 'My Queue' },
  { match: /^\/notifications$/, label: 'Notifications' },
  { match: /^\/tenders$/, label: 'Tenders' },
  { match: /^\/agencies$/, label: 'Agencies' },
  { match: /^\/progress$/, label: 'Work Progress' },
  { match: /^\/billing$/, label: 'Billing' },
  { match: /^\/reports$/, label: 'Reports' },
  { match: /^\/dashboard$/, label: 'Dashboard' },
]

export function buildBreadcrumbs(pathname) {
  if (!pathname || pathname === '/login') return []

  if (pathname === '/dashboard') return [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Home' },
  ]

  if (pathname === '/estimates/new') return [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Estimates', to: '/estimates' },
    { label: 'Create Estimate' },
  ]

  const crumbs = [{ label: 'Dashboard', to: '/dashboard' }]

  const nav = navItems.find(i => isPathActive(i.path, pathname))

  if (nav && nav.path === pathname) {
    if (nav.group === 'admin') crumbs.push({ label: 'Administration' })
    crumbs.push({ label: nav.label })
    return crumbs
  }

  const crumb = detailTitles.find(({ match }) => match.test(pathname))
  if (crumb) {
    if (crumb.admin || (nav && nav.group === 'admin')) crumbs.push({ label: 'Administration' })
    if (nav) crumbs.push({ label: nav.label, to: nav.path })
    crumbs.push({ label: crumb.label })
  }

  return crumbs
}
