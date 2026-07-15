import { useEffect, useState } from "react";
import { reportApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaSearch } from "react-icons/fa";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function Reports() {
  const [filters, setFilters] = useState({ regions: [], zones: [], divisions: [], statuses: [] });
  const [selectedFilters, setSelectedFilters] = useState({ region: "", zone: "", division: "", status: "" });
  const [reportData, setReportData] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    reportApi.getFilters().then((r) => { if (r.data?.filters) setFilters(r.data.filters); }).catch((err) => { console.error("Failed to load report filters:", err); });
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFilters.region) params.region = selectedFilters.region;
      if (selectedFilters.zone) params.zone = selectedFilters.zone;
      if (selectedFilters.division) params.division = selectedFilters.division;
      if (selectedFilters.status) params.status = selectedFilters.status;
      const response = await reportApi.getReports(params);
      if (response.data?.estimates) {
        setReportData(response.data.summary);
        setEstimates(response.data.estimates);
      }
    } catch (error) {
      console.error("Failed to load reports", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="container mt-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-4">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: "contain" }}
          />
          <div>
            <h3 style={{ margin: 0, color: "var(--primary)" }}>Reports</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Government Records</p>
          </div>
        </div>

        <div className="card p-3 mb-3">
          <div className="row">
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Region</label>
              <select className="form-select" value={selectedFilters.region} onChange={(e) => setSelectedFilters((p) => ({ ...p, region: e.target.value }))}>
                <option value="">All</option>
                {filters.regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Zone</label>
              <select className="form-select" value={selectedFilters.zone} onChange={(e) => setSelectedFilters((p) => ({ ...p, zone: e.target.value }))}>
                <option value="">All</option>
                {filters.zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Division</label>
              <select className="form-select" value={selectedFilters.division} onChange={(e) => setSelectedFilters((p) => ({ ...p, division: e.target.value }))}>
                <option value="">All</option>
                {filters.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Status</label>
              <select className="form-select" value={selectedFilters.status} onChange={(e) => setSelectedFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">All</option>
                {filters.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "Loading..." : <><FaSearch style={{ marginRight: 6 }} /> Search</>}
            </button>
          </div>
        </div>

        {loading && <div className="text-center"><div className="spinner-border" /></div>}

        {reportData && (
          <div className="card p-3 mb-3">
            <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Summary</h5>
            <div className="row">
              <div className="col-md-3"><strong>Total Estimates:</strong> {reportData.totalEstimates}</div>
              <div className="col-md-3"><strong>Subtotal:</strong> Rs. {(reportData.totalSubtotal || 0).toFixed(2)}</div>
              <div className="col-md-3"><strong>Grand Total:</strong> Rs. {(reportData.totalGrandTotal || 0).toFixed(2)}</div>
              <div className="col-md-3">
                <strong>By Status:</strong>
                <ul className="mb-0">
                  {Object.entries(reportData.byStatus || {}).map(([s, c]) => <li key={s}>{s}: {c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {estimates.length > 0 && (
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Estimate ID</th>
                <th>Work Name</th>
                <th>Status</th>
                <th>Subtotal</th>
                <th>Grand Total</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est) => (
                <tr key={est._id}>
                  <td>{est.estimateId}</td>
                  <td>{est.nameOfWork}</td>
                  <td><span className="badge bg-info">{est.status}</span></td>
                  <td>Rs. {(est.subtotal || 0).toFixed(2)}</td>
                  <td>Rs. {(est.grandTotal || 0).toFixed(2)}</td>
                  <td>{new Date(est.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Reports;
