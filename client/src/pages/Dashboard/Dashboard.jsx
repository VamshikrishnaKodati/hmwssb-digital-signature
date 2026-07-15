import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaFileAlt, FaClipboardList, FaChartBar, FaCogs, FaBoxes, FaCheckDouble } from "react-icons/fa";
import "./Dashboard.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = user?.role || "viewer";
  const userName = user?.name || "User";

  const roleLabel = {
    admin: "Administrator",
    manager: "Manager",
    dgm: "Deputy General Manager",
    gm: "General Manager",
    viewer: "Viewer",
  };

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
    { title: "Settings", desc: "System configuration", icon: <FaCogs />, color: "#21B6D7", path: "/admin/settings" },
  ];

  const viewerCards = [
    { title: "All Estimates", desc: "Browse estimates (read-only)", icon: <FaClipboardList />, color: "#0B5CAD", path: "/estimates" },
    { title: "Reports", desc: "View reports", icon: <FaChartBar />, color: "#f0932b", path: "/reports" },
  ];

  const getCards = () => {
    switch (role) {
      case 'admin': return adminCards;
      case 'manager': return managerCards;
      case 'dgm': return dgmCards;
      case 'gm': return gmCards;
      case 'viewer': return viewerCards;
      default: return managerCards;
    }
  };

  const cards = getCards();

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
