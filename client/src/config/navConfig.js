import {
  LayoutDashboard, FileEdit, FileText, Bell, Briefcase, Building2,
  Hammer, DollarSign, BarChart3, CheckSquare, FileSpreadsheet, LogOut,
  Users, ScrollText, Ruler, Trash2, ShieldCheck
} from 'lucide-react'

export const DRAWER_WIDTH = 260
export const DRAWER_RAIL_WIDTH = 72
export const DRAWER_TRANSITION = 280

export const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'main', roles: ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead', 'DirectorOfAdministration'] },
  { label: 'Estimates', path: '/estimates', icon: FileText, group: 'main', roles: ['SoRAdmin', 'DGM', 'GM', 'Administrator'] },
  { label: 'Prepare Estimate', path: '/estimates/new', icon: FileEdit, group: 'main', roles: ['Manager'] },
  { label: 'My Estimates', path: '/estimates', icon: FileText, group: 'main', roles: ['Manager'] },
  { label: 'Deleted Estimates', path: '/deleted-estimates', icon: Trash2, group: 'main', roles: ['Manager', 'Administrator'] },
  { label: 'My Queue', path: '/approvals', icon: CheckSquare, group: 'workflow', roles: ['DGM', 'GM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, group: 'workflow', roles: ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead', 'DirectorOfAdministration'] },
  { label: 'Tenders', path: '/tenders', icon: Briefcase, group: 'workflow', roles: ['TenderOfficer', 'Manager', 'DGM', 'GM'] },
  { label: 'Agencies', path: '/agencies', icon: Building2, group: 'workflow', roles: ['DirectorOfAdministration', 'Manager', 'DGM', 'GM'] },
  { label: 'Work Progress', path: '/progress', icon: Hammer, group: 'workflow', roles: ['SiteEngineer', 'Manager', 'DGM', 'GM'] },
  { label: 'Measurement Book', path: '/measurements', icon: Ruler, group: 'workflow', roles: ['SiteEngineer', 'BillingOfficer', 'Manager', 'DGM', 'GM'] },
  { label: 'Billing', path: '/billing', icon: DollarSign, group: 'workflow', roles: ['BillingOfficer', 'Manager', 'DGM', 'GM'] },
  { label: 'Finance', path: '/finance', icon: DollarSign, group: 'workflow', roles: ['FinanceClerk', 'FinanceManager', 'FinanceHead'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, group: 'workflow', roles: ['SoRAdmin', 'Manager', 'DGM', 'GM', 'Administrator'] },
  { label: 'Item Master', path: '/items', icon: FileSpreadsheet, group: 'admin', roles: ['SoRAdmin'] },
  { label: 'Role & Permissions', path: '/roles', icon: ShieldCheck, group: 'admin', roles: ['SoRAdmin'] },
  { label: 'User Management', path: '/users', icon: Users, group: 'admin', roles: ['Administrator', 'SoRAdmin'] },
  { label: 'Audit Logs', path: '/audit-logs', icon: ScrollText, group: 'admin', roles: ['Administrator', 'GM', 'DGM', 'DirectorOfAdministration'] },
  { label: 'Logout', path: '/logout', icon: LogOut, group: 'logout', roles: ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead', 'DirectorOfAdministration'], isLogout: true },
]

export const groupLabels = {
  main: 'Main',
  workflow: 'Workspace',
  admin: 'Administration',
}

export const roleLabel = (d) => {
  switch (d) {
    case 'SoRAdmin': return 'SoR Admin'
    case 'Manager': return 'Manager'
    case 'DGM': return 'DGM'
    case 'GM': return 'GM'
    case 'CGM': return 'CGM'
    case 'DOP': return 'DOP'
    case 'ED': return 'ED'
    case 'MD': return 'MD'
    case 'TenderOfficer': return 'Tender Officer'
    case 'DirectorOfAdministration': return 'Director of Administration'
    case 'SiteEngineer': return 'Site Engineer'
    case 'BillingOfficer': return 'Billing Officer'
    case 'Administrator': return 'Administrator'
    case 'FinanceClerk': return 'Finance Clerk'
    case 'FinanceManager': return 'Finance Manager'
    case 'FinanceHead': return 'Finance Head'
    default: return d
  }
}

export const getVisibleNavItems = (designation) =>
  navItems.filter(item => item.roles.includes(designation))

export const getRouteRoles = (path) =>
  navItems.find(i => i.path === path)?.roles

export const isPathActive = (path, pathname) => {
  if (path === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(path)
}
