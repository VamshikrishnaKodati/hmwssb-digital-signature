import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { estimateApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaEye, FaSearch, FaFilter, FaClipboardList } from "react-icons/fa";
import { toast } from "react-toastify";
import "./EstimateList.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

const STATUS_OPTIONS = [
  "Draft", "Abstract Generated", "Submitted", "DGM Review",
  "Reverted", "GM Review", "OTP Pending", "Digitally Signed", "Hash Signed", "Completed",
];

const STATUS_COLORS = {
  Draft: "secondary",
  "Abstract Generated": "info",
  Submitted: "primary",
  "DGM Review": "warning",
  "GM Review": "warning",
  Reverted: "danger",
  "OTP Pending": "danger",
  "Digitally Signed": "success",
  "Hash Signed": "success",
  Completed: "success",
};

function EstimateList() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterZone) params.zone = filterZone;
      if (search) params.search = search;
      const response = await estimateApi.getAll(params);
      const data = response.data;
      if (data) {
        const list = data.data || data.estimates || [];
        setEstimates(Array.isArray(list) ? list : []);
        if (data.meta) setTotalPages(data.meta.totalPages || 1);
      }
    } catch {
      toast.error("Failed to load estimates");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterZone, search]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadEstimates();
  };

  const openEstimate = (est) => {
    navigate("/abstract", { state: { estimateId: est.estimateId, form: est } });
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="estimate-list-page flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-4">
          <img src={LOGO_SRC} alt="HMWSSB Official Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain" }} />
          <div>
            <h3 style={{ margin: 0, color: "var(--primary)" }}>All Estimates</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Browse and manage estimates</p>
          </div>
        </div>

        <div className="card p-3 mb-3">
          <form onSubmit={handleSearch}>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Search</label>
                <div className="input-group">
                  <span className="input-group-text"><FaSearch /></span>
                  <input type="text" className="form-control" placeholder="Estimate ID or work name..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Status</label>
                <select className="form-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Zone</label>
                <input type="text" className="form-control" placeholder="Filter by zone..." value={filterZone} onChange={(e) => { setFilterZone(e.target.value); setPage(1); }} />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary w-100"><FaFilter className="me-1" /> Filter</button>
              </div>
            </div>
          </form>
        </div>

        {loading ? (
          <div className="text-center py-4"><div className="spinner-border" style={{ color: "var(--primary)" }} /></div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <FaClipboardList size={40} className="mb-3" style={{ opacity: 0.3 }} />
            <p>No estimates found.</p>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Estimate ID</th>
                      <th>Name of Work</th>
                      <th>Zone</th>
                      <th>Manager</th>
                      <th>Status</th>
                      <th>Grand Total</th>
                      <th>Created</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((est) => (
                      <tr key={est._id} style={{ cursor: "pointer" }} onClick={() => openEstimate(est)}>
                        <td><code>{est.estimateId}</code></td>
                        <td>{est.nameOfWork}</td>
                        <td>{est.zone || "-"}</td>
                        <td>{est.managerName || "-"}</td>
                        <td><span className={`badge bg-${STATUS_COLORS[est.status] || "secondary"}`}>{est.status}</span></td>
                        <td>Rs. {Number(est.grandTotal || 0).toLocaleString("en-IN")}</td>
                        <td>{new Date(est.createdAt).toLocaleDateString("en-IN")}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); openEstimate(est); }} title="View">
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="d-flex justify-content-center gap-2 mt-3">
                <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="align-self-center text-muted" style={{ fontSize: "0.85rem" }}>Page {page} of {totalPages}</span>
                <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default EstimateList;
