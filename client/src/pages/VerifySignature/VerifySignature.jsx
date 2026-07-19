import { useState } from "react";
import { signatureApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaSearch, FaCheckCircle, FaTimesCircle, FaShieldAlt, FaCertificate, FaFileAlt, FaUser, FaClock, FaStamp } from "react-icons/fa";
import "./VerifySignature.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function VerifySignature() {
  const [estimateId, setEstimateId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!estimateId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await signatureApi.verify(estimateId.trim());
      if (response.data) {
        setResult(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. No signature found for this estimate.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="verify-page flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-4">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: "contain" }}
          />
          <div>
            <h3 style={{ margin: 0, color: "var(--primary)" }}>Signature Verification</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Verify digital signature authenticity</p>
          </div>
        </div>

        <div className="card p-4 mb-4">
          <form onSubmit={handleVerify}>
            <div className="input-group">
              <span className="input-group-text" style={{ background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }}>
                <FaSearch />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Estimate ID (e.g., EST-2024-001)"
                value={estimateId}
                onChange={(e) => setEstimateId(e.target.value)}
                style={{ fontSize: "0.95rem" }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !estimateId.trim()}
                style={{ minWidth: 140 }}
              >
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2" /> Verifying...</>
                ) : (
                  <><FaShieldAlt className="me-2" /> Verify</>
                )}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2">
            <FaTimesCircle /> {error}
          </div>
        )}

        {result && (
          <div className="verify-result">
            <div className={`verify-status-card ${result.valid ? "valid" : "invalid"}`}>
              <div className="verify-status-icon">
                {result.valid ? <FaCheckCircle size={48} /> : <FaTimesCircle size={48} />}
              </div>
              <div>
                <h2>{result.valid ? "Signature Verified" : "Signature Invalid"}</h2>
                <p>{result.valid ? "This document's digital signature is authentic and has not been tampered with." : "This signature could not be verified. The document may have been altered or the certificate is invalid."}</p>
              </div>
            </div>

            <div className="row g-3 mt-2">
              <div className="col-md-6">
                <div className="card p-3 h-100">
                  <h6 className="text-primary mb-3"><FaUser className="me-2" />Signer Information</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr><td className="fw-semibold">Name</td><td>{result.signer?.name || "N/A"}</td></tr>
                      <tr><td className="fw-semibold">Role</td><td>{result.signer?.role || "N/A"}</td></tr>
                      <tr><td className="fw-semibold">Designation</td><td>{result.signer?.designation || "N/A"}</td></tr>
                      <tr><td className="fw-semibold">Signed At</td><td>{formatDate(result.signedAt)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card p-3 h-100">
                  <h6 className="text-primary mb-3"><FaCertificate className="me-2" />Certificate Details</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-semibold">Status</td>
                        <td>
                          <span className={`badge ${result.certificate?.valid ? "bg-success" : "bg-danger"}`}>
                            {result.certificate?.valid ? "Valid" : result.certificate?.revoked ? "Revoked" : "Expired"}
                          </span>
                        </td>
                      </tr>
                      <tr><td className="fw-semibold">Serial</td><td style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{result.certificate?.serial || "N/A"}</td></tr>
                      <tr><td className="fw-semibold">Algorithm</td><td>{result.certificate?.algorithm || "N/A"}</td></tr>
                      <tr><td className="fw-semibold">Valid From</td><td>{formatDate(result.certificate?.notBefore)}</td></tr>
                      <tr><td className="fw-semibold">Valid Until</td><td>{formatDate(result.certificate?.notAfter)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card p-3 h-100">
                  <h6 className="text-primary mb-3"><FaFileAlt className="me-2" />Document Integrity</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-semibold">Hash Match</td>
                        <td>
                          <span className={`badge ${result.document?.hashValid ? "bg-success" : "bg-warning"}`}>
                            {result.document?.hashValid ? "Valid" : "Not Verified"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-semibold">Crypto Verified</td>
                        <td>
                          <span className={`badge ${result.document?.cryptoValid ? "bg-success" : "bg-secondary"}`}>
                            {result.document?.cryptoValid ? "Verified" : "N/A"}
                          </span>
                        </td>
                      </tr>
                      <tr><td className="fw-semibold">Document Hash</td><td style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{result.document?.hash || "N/A"}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card p-3 h-100">
                  <h6 className="text-primary mb-3"><FaStamp className="me-2" />Timestamp & Revocation</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-semibold">Timestamp</td>
                        <td>
                          {result.timestamp?.present ? (
                            <span className="badge bg-success"><FaClock className="me-1" /> Timestamped</span>
                          ) : (
                            <span className="badge bg-secondary">None</span>
                          )}
                        </td>
                      </tr>
                      {result.timestamp?.timestampedAt && (
                        <tr><td className="fw-semibold">Timestamped At</td><td>{formatDate(result.timestamp.timestampedAt)}</td></tr>
                      )}
                      {result.timestamp?.authority && (
                        <tr><td className="fw-semibold">TSA</td><td>{result.timestamp.authority}</td></tr>
                      )}
                      <tr>
                        <td className="fw-semibold">Revocation</td>
                        <td>
                          {result.revocation?.revoked ? (
                            <span className="badge bg-danger">Revoked</span>
                          ) : (
                            <span className="badge bg-success">Not Revoked</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="text-center py-5 text-muted">
            <FaShieldAlt size={48} className="mb-3" style={{ opacity: 0.3 }} />
            <p>Enter an Estimate ID above to verify its digital signature.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default VerifySignature;
