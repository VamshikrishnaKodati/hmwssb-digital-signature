import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { reportApi } from "../../services/api";
import { FaFileAlt, FaClipboardList, FaChartBar, FaBoxes, FaCheckDouble, FaFileSignature, FaCheckCircle, FaClock, FaExclamationTriangle, FaShieldAlt } from "react-icons/fa";
import "./Dashboard.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

const formatCurrency = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} L`;
  return `Rs. ${num.toLocaleString("en-IN")}`;
};

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = user?.role || "viewer";
  const userName = user?.name || "User";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const roleLabel = {
    admin: "Administrator",
    manager: "Manager",
    dgm: "Deputy General Manager",
    gm: "General Manager",
    ce: "Chief Engineer",
    viewer: "Viewer",
  };

  useEffect(() => {
    reportApi.getDashboardStats()
      .then((r) => { if (r.data) setStats(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const managerCards = [
    { title: "Prepare Estimate", desc: "Create new work estimate", icon: <FaFileAlt />, color: "#36A852", path: "/prepare-estimate" },
    { title: "My Estimates", desc: "View and manage your estimates", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "Generate reports and analytics", icon: <FaChartBar />, color: "#f0932b", path: "/reports" },
  ];

  const dgmCards = [
    { title: "Pending Approvals", desc: "Review estimates assigned to you", icon: <FaCheckDouble />, color: "#f0932b", path: "/pending-approvals" },
    { title: "All Estimates", desc: "Browse all estimates", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "Generate reports and analytics", icon: <FaChartBar />, color: "#21B6D7", path: "/reports" },
  ];

  const gmCards = [
    { title: "Pending Approvals", desc: "Final approval pending estimates", icon: <FaCheckDouble />, color: "#dc3545", path: "/pending-approvals" },
    { title: "All Estimates", desc: "Browse all estimates", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "Generate reports and analytics", icon: <FaChartBar />, color: "#21B6D7", path: "/reports" },
  ];

  const adminCards = [
    { title: "Prepare Estimate", desc: "Create new work estimate", icon: <FaFileAlt />, color: "#36A852", path: "/prepare-estimate" },
    { title: "Item Master", desc: "Manage item catalog", icon: <FaBoxes />, color: "#7c3aed", path: "/admin/items" },
    { title: "All Estimates", desc: "Browse all estimates", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "Generate reports and analytics", icon: <FaChartBar />, color: "#f0932b", path: "/reports" },
  ];

  const viewerCards = [
    { title: "All Estimates", desc: "Browse estimates (read-only)", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "View reports", icon: <FaChartBar />, color: "#f0932b", path: "/reports" },
  ];

  const ceCards = [
    { title: "Pending Approvals", desc: "Review and approve estimates", icon: <FaCheckDouble />, color: "#f0932b", path: "/pending-approvals" },
    { title: "All Estimates", desc: "Browse all estimates", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "Generate reports and analytics", icon: <FaChartBar />, color: "#21B6D7", path: "/reports" },
    { title: "Verify Signature", desc: "Verify digital signatures", icon: <FaShieldAlt />, color: "#36A852", path: "/verify-signature" },
  ];

  const getCards = () => {
    switch (role) {
      case 'admin': return adminCards;
      case 'manager': return managerCards;
      case 'dgm': return dgmCards;
      case 'gm': return gmCards;
      case 'ce': return ceCards;
      case 'viewer': return viewerCards;
      default: return managerCards;
    }
  };

  const cards = getCards();

  const statItems = stats ? [
    { label: "Total Estimates", value: stats.totalEstimates, icon: <FaClipboardList />, color: "#0B5CAD" },
    { label: "Pending Approvals", value: stats.pendingApprovals, icon: <FaClock />, color: "#f0932b" },
    { label: "Digitally Signed", value: stats.signedCount, icon: <FaFileSignature />, color: "#36A852" },
    { label: "Completed", value: stats.completedCount, icon: <FaCheckCircle />, color: "#21B6D7" },
    { label: "Draft", value: stats.draftCount, icon: <FaExclamationTriangle />, color: "#6c757d" },
    { label: "Reverted", value: stats.revertedCount, icon: <FaExclamationTriangle />, color: "#dc3545" },
  ] : [];

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="dashboard-page flex-grow-1">
        <div className="dashboard-greeting">
          <div className="d-flex align-items-center gap-3">
            <img
              src={LOGO_SRC}
              alt="HMWSSB Official Logo"
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                boxShadow: "0 4px 12px rgba(11,92,173,0.12)",
                flexShrink: 0,
                objectFit: "contain",
              }}
            />
            <div>
              <h1>Welcome, {userName}</h1>
              <p>{roleLabel[role] || role} Dashboard</p>
            </div>
          </div>
        </div>

        {!loading && stats && (
          <div className="dashboard-stats">
            {statItems.map((item, i) => (
              <div key={i} className="stat-card">
                <div style={{ fontSize: "1.2rem", color: item.color, marginBottom: 8 }}>{item.icon}</div>
                <div className="stat-value" style={{ color: item.color }}>{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
            {stats.totalGrandTotal > 0 && (
              <div className="stat-card">
                <div style={{ fontSize: "1.2rem", color: "#7c3aed", marginBottom: 8 }}><FaChartBar /></div>
                <div className="stat-value" style={{ color: "#7c3aed", fontSize: "1.2rem" }}>{formatCurrency(stats.totalGrandTotal)}</div>
                <div className="stat-label">Total Estimate Value</div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-4"><div className="spinner-border" style={{ color: "var(--primary)" }} /></div>
        )}

        <div className="dashboard-cards">
          {cards.map((card, index) => (
            <div
              key={index}
              className="dashboard-card"
              onClick={() => navigate(card.path)}
            >
              <div
                className="dashboard-card-icon"
                style={{ background: `${card.color}15`, color: card.color }}
              >
                {card.icon}
              </div>
              <div className="dashboard-card-body">
                <h5>{card.title}</h5>
                <p>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Dashboard;
