import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Route, Navigate, createRoutesFromElements, useParams } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { getRouteRoles } from './config/navConfig'
import Layout from './components/Layout'
import Login from './pages/Login'
import Logo from './components/Logo'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminItems = lazy(() => import('./pages/AdminItems'))
const EstimateForm = lazy(() => import('./pages/EstimateForm'))
const EstimateList = lazy(() => import('./pages/EstimateList'))
const EstimateDetail = lazy(() => import('./pages/EstimateDetail'))
const EstimatePreview = lazy(() => import('./pages/EstimatePreview'))
const EstimatePrint = lazy(() => import('./pages/EstimatePrint'))
const AbstractWorkspace = lazy(() => import('./pages/AbstractWorkspace'))
const PendingApprovals = lazy(() => import('./pages/PendingApprovals'))
const Notifications = lazy(() => import('./pages/Notifications'))
const TenderList = lazy(() => import('./pages/TenderList'))
const TenderDetail = lazy(() => import('./pages/TenderDetail'))
const TenderForm = lazy(() => import('./pages/TenderForm'))
const TenderPreview = lazy(() => import('./pages/TenderPreview'))
const AgencyList = lazy(() => import('./pages/AgencyList'))
const ProgressList = lazy(() => import('./pages/ProgressList'))
const MeasurementList = lazy(() => import('./pages/MeasurementList'))
const BillingList = lazy(() => import('./pages/BillingList'))
const BillDetail = lazy(() => import('./pages/BillDetail'))
const FinanceList = lazy(() => import('./pages/FinanceList'))
const Reports = lazy(() => import('./pages/Reports'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const DeletedEstimates = lazy(() => import('./pages/DeletedEstimates'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-2 text-sm text-[#475569]">
        <div className="w-4 h-4 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  )
}

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.Designation)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Layout>{children}</Layout>
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

// Distinct keys force React to REMOUNT EstimateForm per route, so a never
// leak stale create/edit state between the two views:
//   /estimates/new  -> always a fresh create form
//   /estimates/:id/edit -> always loads that estimate
function NewEstimatePage() {
  return <EstimateForm key="new" />
}
function EditEstimatePage() {
  const { id } = useParams()
  return <EstimateForm key={`edit-${id || 'none'}`} />
}

function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to="/dashboard" replace /> : <Login />
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/dashboard" element={<ProtectedRoute><LazyPage><Dashboard /></LazyPage></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute roles={getRouteRoles('/items')}><LazyPage><AdminItems /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/new" element={<ProtectedRoute><LazyPage><NewEstimatePage /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/:id/edit" element={<ProtectedRoute><LazyPage><EditEstimatePage /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/:id/view" element={<ProtectedRoute><LazyPage><EstimateDetail /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/:id/preview" element={<ProtectedRoute><LazyPage><EstimatePreview /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/:id" element={<ProtectedRoute><LazyPage><EstimateDetail /></LazyPage></ProtectedRoute>} />
      <Route path="/print/estimate/:id/:type" element={<ProtectedRoute><LazyPage><EstimatePrint /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates/:id/abstract" element={<ProtectedRoute><LazyPage><AbstractWorkspace /></LazyPage></ProtectedRoute>} />
      <Route path="/abstract/:id" element={<ProtectedRoute><LazyPage><AbstractWorkspace /></LazyPage></ProtectedRoute>} />
      <Route path="/estimates" element={<ProtectedRoute><LazyPage><EstimateList /></LazyPage></ProtectedRoute>} />
      <Route path="/deleted-estimates" element={<ProtectedRoute><LazyPage><DeletedEstimates /></LazyPage></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute roles={getRouteRoles('/approvals')}><LazyPage><PendingApprovals /></LazyPage></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><LazyPage><Notifications /></LazyPage></ProtectedRoute>} />
      <Route path="/tenders" element={<ProtectedRoute><LazyPage><TenderList /></LazyPage></ProtectedRoute>} />
      <Route path="/tenders/new" element={<ProtectedRoute roles={['TenderOfficer']}><LazyPage><TenderForm /></LazyPage></ProtectedRoute>} />
      <Route path="/tenders/:id/edit" element={<ProtectedRoute roles={['TenderOfficer']}><LazyPage><TenderForm /></LazyPage></ProtectedRoute>} />
      <Route path="/tenders/:id/preview" element={<ProtectedRoute roles={['TenderOfficer']}><LazyPage><TenderPreview /></LazyPage></ProtectedRoute>} />
      <Route path="/tenders/:id" element={<ProtectedRoute><LazyPage><TenderDetail /></LazyPage></ProtectedRoute>} />
      <Route path="/agencies" element={<ProtectedRoute><LazyPage><AgencyList /></LazyPage></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><LazyPage><ProgressList /></LazyPage></ProtectedRoute>} />
      <Route path="/measurements" element={<ProtectedRoute><LazyPage><MeasurementList /></LazyPage></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><LazyPage><BillingList /></LazyPage></ProtectedRoute>} />
      <Route path="/billing/:id" element={<ProtectedRoute><LazyPage><BillDetail /></LazyPage></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><LazyPage><FinanceList /></LazyPage></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><LazyPage><Reports /></LazyPage></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={getRouteRoles('/users')}><LazyPage><UserManagement /></LazyPage></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute roles={getRouteRoles('/audit-logs')}><LazyPage><AuditLogs /></LazyPage></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </>
  )
)

export default function App() {
  const { loading } = useAuth()

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-white to-[#F1F5F9] gap-4">
      <Logo size={56} />
      <div className="flex items-center gap-2 text-sm text-[#475569]">
        <div className="w-4 h-4 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  )

  return <RouterProvider router={router} />
}
