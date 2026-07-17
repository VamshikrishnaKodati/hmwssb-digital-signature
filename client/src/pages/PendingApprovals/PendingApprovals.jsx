import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { estimateApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaCheckDouble, FaEye, FaCheck, FaUndo } from "react-icons/fa";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function PendingApprovals() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = user?.role || "viewer";
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const statuses = useMemo(() => role === "admin"
    ? ["Submitted", "DGM Review", "GM Review", "OTP Pending"]
    : role === "dgm" ? ["Submitted", "DGM Review"]
    : role === "gm" ? ["GM Review"]
    : role === "ce" ? ["Submitted", "DGM Review", "GM Review"]
    : [], [role]);

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    setActionMsg("");
    setActionError("");
    const all = [];
    try {
      for (const s of statuses) {
        const res = await estimateApi.getByStatus(s);
        if (res.data?.success) {
          const estimates = res.data.estimates || res.data.data?.estimates || [];
          all.push(...(Array.isArray(estimates) ? estimates : []));
        }
      }
    } catch (err) {
      setActionError("Failed to load estimates: " + (err.response?.data?.message || err.message));
    } finally {
      setEstimates(all);
      setLoading(false);
    }
  }, [statuses]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const handleAction = async (estimateId, status, comments = "") => {
    setActionMsg("");
    setActionError("");
    try {
      const res = await estimateApi.updateStatus(estimateId, { status, comments });
      if (res.data?.success) {
        const label = status === "Submitted" ? "Reverted to Submitted"
          : status === "DGM Review" ? "Moved to DGM Review"
          : status === "GM Review" ? "Approved - moved to GM Review"
          : status === "OTP Pending" ? "Approved - moved to OTP"
          : status === "Reverted" ? "Reverted"
          : `Status changed to ${status}`;
        setActionMsg(`Estimate ${estimateId}: ${label}`);
        loadEstimates();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    }
  };

  const getActions = (est) => {
    if (role === "admin") {
      if (est.status === "Submitted") {
        return [
          { label: "Take for DGM Review", status: "DGM Review", color: "btn-primary", icon: <FaCheckDouble /> },
        ];
      }
      if (est.status === "DGM Review") {
        return [
          { label: "Approve to GM", status: "GM Review", color: "btn-success", icon: <FaCheck /> },
          { label: "Revert", status: "Reverted", color: "btn-danger", icon: <FaUndo /> },
        ];
      }
      if (est.status === "GM Review") {
        return [
          { label: "Approve to OTP", status: "OTP Pending", color: "btn-success", icon: <FaCheck /> },
          { label: "Revert", status: "Reverted", color: "btn-danger", icon: <FaUndo /> },
        ];
      }
    }
    if (role === "dgm") {
      if (est.status === "Submitted") {
        return [
          { label: "Start Review", status: "DGM Review", color: "btn-primary", icon: <FaCheckDouble /> },
        ];
      }
      if (est.status === "DGM Review") {
        return [
          { label: "Approve", status: "GM Review", color: "btn-success", icon: <FaCheck /> },
          { label: "Revert", status: "Reverted", color: "btn-danger", icon: <FaUndo /> },
        ];
      }
    }
    if (role === "gm") {
      if (est.status === "GM Review") {
        return [
          { label: "Approve", status: "OTP Pending", color: "btn-success", icon: <FaCheck /> },
          { label: "Revert", status: "Reverted", color: "btn-danger", icon: <FaUndo /> },
        ];
      }
    }
    return [];
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="container mt-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: "contain" }}
          />
          <h3 style={{ margin: 0, color: "var(--primary)" }}>Pending Approvals</h3>
        </div>

        {actionMsg && <div className="alert alert-success mt-2">{actionMsg}</div>}
        {actionError && <div className="alert alert-danger mt-2">{actionError}</div>}

        {loading ? (
          <div className="text-center mt-4"><div className="spinner-border" role="status" /></div>
        ) : estimates.length === 0 ? (
          <div className="alert alert-info mt-3">No pending estimates for review.</div>
        ) : (
          <div className="table-responsive mt-3">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Estimate ID</th>
                  <th>Work Name</th>
                  <th>Current Status</th>
                  <th>Manager</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => (
                  <tr key={est._id}>
                    <td>{est.estimateId}</td>
                    <td>{est.nameOfWork}</td>
                    <td><span className="badge bg-info">{est.status}</span></td>
                    <td>{est.managerName || "-"}</td>
                    <td>Rs. {Number(est.grandTotal || 0).toLocaleString("en-IN")}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/abstract`, { state: { estimateId: est.estimateId } })}>
                          <FaEye style={{ marginRight: 4 }} /> View
                        </button>
                        {getActions(est).map((act, i) => (
                          <button key={i} className={`btn btn-sm ${act.color}`} onClick={() => handleAction(est.estimateId, act.status)}>
                            {act.icon} {act.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default PendingApprovals;
