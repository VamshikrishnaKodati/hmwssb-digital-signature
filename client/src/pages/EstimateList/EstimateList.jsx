import { useEffect, useState } from "react";
import { estimateApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function EstimateList() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await estimateApi.getAll();
        if (response.data?.success) {
          const d = response.data.data;
          setEstimates(Array.isArray(d) ? d : d?.estimates || []);
        }
      } catch (error) {
        console.error("Failed to load estimates", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
          <h3 style={{ margin: 0, color: "var(--primary)" }}>All Estimates</h3>
        </div>

        {loading ? (
          <div className="text-center mt-4"><div className="spinner-border" role="status" /></div>
        ) : estimates.length === 0 ? (
          <div className="alert alert-info mt-3">No estimates found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered mt-3">
              <thead>
                <tr>
                  <th>Estimate ID</th>
                  <th>Name of Work</th>
                  <th>Status</th>
                  <th>Subtotal</th>
                  <th>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate) => (
                  <tr key={estimate._id}>
                    <td>{estimate.estimateId}</td>
                    <td>{estimate.nameOfWork}</td>
                    <td><span className="badge bg-info">{estimate.status}</span></td>
                    <td>Rs. {Number(estimate.subtotal || 0).toFixed(2)}</td>
                    <td>Rs. {Number(estimate.grandTotal || 0).toFixed(2)}</td>
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

export default EstimateList;
