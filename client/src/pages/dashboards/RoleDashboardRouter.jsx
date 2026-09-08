import { lazy } from 'react'

const ManagerDashboard = lazy(() => import('./ManagerDashboard'))
const DGMDashboard = lazy(() => import('./DGMDashboard'))
const GMDashboard = lazy(() => import('./GMDashboard'))
const CGMDashboard = lazy(() => import('./CGMDashboard'))
const DOPDashboard = lazy(() => import('./DOPDashboard'))
const EDDashboard = lazy(() => import('./EDDashboard'))
const MDDashboard = lazy(() => import('./MDDashboard'))
const TenderOfficerDashboard = lazy(() => import('./TenderOfficerDashboard'))
const SiteEngineerDashboard = lazy(() => import('./SiteEngineerDashboard'))
const BillingDashboard = lazy(() => import('./BillingDashboard'))
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const SoRAdminDashboard = lazy(() => import('./SoRAdminDashboard'))
const FinanceClerkDashboard = lazy(() => import('./FinanceClerkDashboard'))
const FinanceManagerDashboard = lazy(() => import('./FinanceManagerDashboard'))
const FinanceHeadDashboard = lazy(() => import('./FinanceHeadDashboard'))
const DirectorDashboard = lazy(() => import('./DirectorDashboard'))

const ROLE_DASHBOARD_MAP = {
  Manager: ManagerDashboard,
  DGM: DGMDashboard,
  GM: GMDashboard,
  CGM: CGMDashboard,
  DOP: DOPDashboard,
  ED: EDDashboard,
  MD: MDDashboard,
  TenderOfficer: TenderOfficerDashboard,
  SiteEngineer: SiteEngineerDashboard,
  BillingOfficer: BillingDashboard,
  Administrator: AdminDashboard,
  SoRAdmin: SoRAdminDashboard,
  FinanceClerk: FinanceClerkDashboard,
  FinanceManager: FinanceManagerDashboard,
  FinanceHead: FinanceHeadDashboard,
  DirectorOfAdministration: DirectorDashboard,
}

// Roles whose dashboards consume a single `dashboardData` prop instead of a
// role-named key; map their backend payload key onto it.
const DASHBOARD_DATA_KEYS = {
  CGM: 'cgmDashboard',
  DOP: 'dopDashboard',
  ED: 'edDashboard',
  MD: 'mdDashboard',
  SoRAdmin: 'soRAdminDashboard',
}

export default function RoleDashboardRouter({ role, props }) {
  const Component = ROLE_DASHBOARD_MAP[role]
  if (!Component) {
    const GenericDashboard = lazy(() => import('../../components/dashboard/GenericDashboard'))
    return <GenericDashboard user={props.user} role={role} />
  }
  const dataKey = DASHBOARD_DATA_KEYS[role]
  return <Component {...props} {...(dataKey ? { dashboardData: props[dataKey] || {} } : {})} />
}
