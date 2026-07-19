import { NavLink, useNavigate } from "react-router-dom";
import { FaTachometerAlt, FaFileAlt, FaCheckDouble, FaClipboardList, FaChartBar, FaBoxes, FaSignOutAlt, FaShieldAlt } from "react-icons/fa";
import "./Navbar.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = user?.role || "viewer";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const roleLabel = {
    admin: "Administrator",
    manager: "Manager",
    dgm: "Deputy General Manager",
    gm: "General Manager",
    ce: "Chief Engineer",
    viewer: "Viewer",
  };

  return (
    <nav className="app-navbar navbar navbar-expand-lg">
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/dashboard">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            className="navbar-logo"
          />
          <div className="navbar-brand-text">
            <span className="brand-name">HMWSSB</span>
            <small className="brand-subtitle">Hyderabad Metropolitan<br/>Water Supply &amp; Sewerage Board</small>
          </div>
        </NavLink>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav mx-auto">
            <li className="nav-item">
              <NavLink className="nav-link" to="/dashboard">
                <FaTachometerAlt className="nav-icon" /> Dashboard
              </NavLink>
            </li>
            {(role === 'manager' || role === 'admin') && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/prepare-estimate">
                  <FaFileAlt className="nav-icon" /> Prepare Estimate
                </NavLink>
              </li>
            )}
            <li className="nav-item">
              <NavLink className="nav-link" to="/estimates">
                <FaClipboardList className="nav-icon" /> All Estimates
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/reports">
                <FaChartBar className="nav-icon" /> Reports
              </NavLink>
            </li>
            {(role === 'dgm' || role === 'gm' || role === 'ce' || role === 'admin') && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/pending-approvals">
                  <FaCheckDouble className="nav-icon" /> Approvals
                </NavLink>
              </li>
            )}
            {role === 'admin' && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/admin/items">
                  <FaBoxes className="nav-icon" /> Item Master
                </NavLink>
              </li>
            )}
            <li className="nav-item">
              <NavLink className="nav-link" to="/verify-signature">
                <FaShieldAlt className="nav-icon" /> Verify
              </NavLink>
            </li>
          </ul>

          <div className="user-info">
            <div className="user-avatar">{getInitials(user?.name)}</div>
            <div className="user-details d-none d-md-block">
              <div className="user-name">{user?.name || "User"}</div>
              <div className="user-role">{roleLabel[role] || role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <FaSignOutAlt />
              <span className="d-none d-lg-inline ms-1">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
