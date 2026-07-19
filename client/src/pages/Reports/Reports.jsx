import { useEffect, useState, useMemo, useCallback } from "react";
import { reportApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaSearch, FaFileCsv, FaFileExcel, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function Reports() {
  const [filters, setFilters] = useState({ regions: [], zones: [], divisions: [], statuses: [] });
  const [selectedFilters, setSelectedFilters] = useState({ region: "", zone: "", division: "", status: "" });
  const [reportData, setReportData] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    reportApi.getFilters().then((r) => { if (r.data?.filters) setFilters(r.data.filters); }).catch(() => {});
  }, []);

  const filteredZones = useMemo(() => {
    if (!selectedFilters.region) return filters.zones;
    return filters.zones;
  }, [filters.zones, selectedFilters.region]);

  const filteredDivisions = useMemo(() => {
    if (!selectedFilters.zone) return filters.divisions;
    return filters.divisions;
  }, [filters.divisions, selectedFilters.zone]);

  const handleFilterChange = useCallback((key, value) => {
    setSelectedFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "region") { next.zone = ""; next.division = ""; }
      if (key === "zone") { next.division = ""; }
      return next;
    });
  }, []);

  const buildParams = useCallback(() => {
    const params = {};
    if (selectedFilters.region) params.region = selectedFilters.region;
    if (selectedFilters.zone) params.zone = selectedFilters.zone;
    if (selectedFilters.division) params.division = selectedFilters.division;
    if (selectedFilters.status) params.status = selectedFilters.status;
    return params;
  }, [selectedFilters]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await reportApi.getReports(buildParams());
      if (response.data?.estimates) {
        setReportData(response.data.summary);
        setEstimates(response.data.estimates);
      }
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const response = await reportApi.exportCsv(buildParams());
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimates_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await reportApi.exportExcel(buildParams());
      const blob = new Blob([response.data], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimates_report_${new Date().toISOString().slice(0, 10)}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exported successfully");
    } catch {
      toast.error("Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSelectedFilters({ region: "", zone: "", division: "", status: "" });
  };

  const hasActiveFilters = Object.values(selectedFilters).some(Boolean);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="container mt-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-4">
          <img src={LOGO_SRC} alt="HMWSSB Official Logo" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: "contain" }} />
          <div>
            <h3 style={{ margin: 0, color: "var(--primary)" }}>Reports</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Government Records & Analytics</p>
          </div>
        </div>

        <div className="card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex align-items-center gap-2">
              <FaFilter style={{ color: "var(--primary)" }} />
              <span className="fw-semibold" style={{ fontSize: "0.9rem" }}>Filters</span>
            </div>
            {hasActiveFilters && (
              <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>Clear All</button>
            )}
          </div>
          <div className="row">
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Region</label>
              <select className="form-select" value={selectedFilters.region} onChange={(e) => handleFilterChange("region", e.target.value)}>
                <option value="">All Regions</option>
                {filters.regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Zone</label>
              <select className="form-select" value={selectedFilters.zone} onChange={(e) => handleFilterChange("zone", e.target.value)}>
                <option value="">All Zones</option>
                {filteredZones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Division</label>
              <select className="form-select" value={selectedFilters.division} onChange={(e) => handleFilterChange("division", e.target.value)}>
                <option value="">All Divisions</option>
                {filteredDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Status</label>
              <select className="form-select" value={selectedFilters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
                <option value="">All Statuses</option>
                {filters.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 d-flex gap-2">
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "Loading..." : <><FaSearch style={{ marginRight: 6 }} /> Search</>}
            </button>
            {estimates.length > 0 && (
              <>
                <button className="btn btn-outline-success" onClick={handleExportCsv} disabled={exporting}>
                  {exporting ? <><span className="spinner-border spinner-border-sm me-1" /> Exporting...</> : <><FaFileCsv className="me-1" /> Export CSV</>}
                </button>
                <button className="btn btn-outline-success" onClick={handleExportExcel} disabled={exporting}>
                  {exporting ? <><span className="spinner-border spinner-border-sm me-1" /> Exporting...</> : <><FaFileExcel className="me-1" /> Export Excel</>}
                </button>
              </>
            )}
          </div>
        </div>

        {loading && <div className="text-center"><div className="spinner-border" /></div>}

        {reportData && (
          <div className="card p-3 mb-3">
            <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Summary</h5>
            <div className="row">
              <div className="col-md-3"><strong>Total Estimates:</strong> {reportData.totalEstimates}</div>
              <div className="col-md-3"><strong>Subtotal:</strong> Rs. {(reportData.totalSubtotal || 0).toLocaleString("en-IN")}</div>
              <div className="col-md-3"><strong>Grand Total:</strong> Rs. {(reportData.totalGrandTotal || 0).toLocaleString("en-IN")}</div>
              <div className="col-md-3">
                <strong>By Status:</strong>
                <ul className="mb-0" style={{ fontSize: "0.85rem" }}>
                  {Object.entries(reportData.byStatus || {}).map(([s, c]) => <li key={s}>{s}: {c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {estimates.length > 0 && (
          <div className="card">
            <div className="table-responsive">
              <table className="table table-bordered table-hover mb-0">
                <thead>
                  <tr>
                    <th>Estimate ID</th>
                    <th>Work Name</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Subtotal</th>
                    <th>Grand Total</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => (
                    <tr key={est._id}>
                      <td><code>{est.estimateId}</code></td>
                      <td>{est.nameOfWork}</td>
                      <td>{est.region || "-"}</td>
                      <td><span className="badge bg-info">{est.status}</span></td>
                      <td>Rs. {(est.subtotal || 0).toLocaleString("en-IN")}</td>
                      <td>Rs. {(est.grandTotal || 0).toLocaleString("en-IN")}</td>
                      <td>{new Date(est.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !reportData && (
          <div className="text-center py-5 text-muted">
            <FaFilter size={40} className="mb-3" style={{ opacity: 0.3 }} />
            <p>Select filters and click Search to generate reports.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Reports;
