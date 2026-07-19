import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen/LoadingScreen";

const Login = lazy(() => import("./pages/Login/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const PrepareEstimate = lazy(() => import("./pages/PrepareEstimate/PrepareEstimate"));
const EstimateList = lazy(() => import("./pages/EstimateList/EstimateList"));
const Reports = lazy(() => import("./pages/Reports/Reports"));
const AbstractWorkspace = lazy(() => import("./pages/AbstractWorkspace/AbstractWorkspace"));
const PendingApprovals = lazy(() => import("./pages/PendingApprovals/PendingApprovals"));
const VerifySignature = lazy(() => import("./pages/VerifySignature/VerifySignature"));
const AdminItems = lazy(() => import("./pages/AdminItems/AdminItems"));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/prepare-estimate" element={<ProtectedRoute><PrepareEstimate /></ProtectedRoute>} />
      <Route path="/abstract" element={<ProtectedRoute><AbstractWorkspace /></ProtectedRoute>} />
      <Route path="/estimates" element={<ProtectedRoute><EstimateList /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/pending-approvals" element={<ProtectedRoute><PendingApprovals /></ProtectedRoute>} />
      <Route path="/verify-signature" element={<ProtectedRoute><VerifySignature /></ProtectedRoute>} />
      <Route path="/admin/items" element={<ProtectedRoute><AdminItems /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
          <Suspense fallback={<LoadingScreen />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
