import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pdfApi, estimateApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import OTPModal from "../../components/OTP/OTPModal";
import { FaArrowLeft, FaFilePdf, FaDownload, FaPaperPlane, FaEdit, FaCheck, FaUndo, FaPenFancy, FaStamp } from "react-icons/fa";
import { toast } from "react-toastify";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function AbstractWorkspace() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;

  const [estimate, setEstimate] = useState(state?.form || null);
  const [items, setItems] = useState(state?.items || []);
  const [lsAmount, setLsAmount] = useState(Number(state?.lsAmount || 0));
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [movements, setMovements] = useState([]);

  const estimateId = estimate?.estimateId || state?.estimateId;

  const fetchEstimate = useCallback(async (id) => {
    try {
      const res = await estimateApi.getById(id);
      if (res.data?.success) {
        const d = res.data.data || res.data;
        setEstimate(d.estimate);
        setItems(d.items || []);
        setLsAmount(Number((d.estimate || d)?.lsAmount || 0));
      }
    } catch (err) {
      console.error("Failed to fetch estimate:", err);
    }
  }, []);

  const fetchMovements = useCallback(async (id) => {
    try {
      const res = await estimateApi.getMovements(id);
      if (res.data?.success) {
        const d = res.data.data || res.data;
        setMovements(d.movements || []);
      }
    } catch (err) {
      console.error("Failed to fetch movements:", err);
    }
  }, []);

  useEffect(() => {
    const id = state?.estimateId;
    if (id) {
      fetchEstimate(id);
      fetchMovements(id);
    } else if (estimateId) {
      fetchEstimate(estimateId);
      fetchMovements(estimateId);
    }
  }, [state?.estimateId, estimateId, fetchEstimate, fetchMovements]);

  const data = estimate || {};
  const itemList = items.length > 0 ? items : (state?.items || []);

  const materialRows = items.filter((i) => (i.category || "").toLowerCase() === "material");
  const civilRows = items.filter((i) => (i.category || "").toLowerCase() === "civil");
  const unclassifiedRows = items.filter((i) => {
    const cat = (i.category || "").toLowerCase();
    return cat !== "material" && cat !== "civil";
  });

  const materialTotal = materialRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const civilTotal = civilRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const subtotal = materialTotal + civilTotal;
  const gst = items.reduce((s, r) => s + ((Number(r.amount) || 0) * (Number(r.gst || 0) / 100)), 0);
  const grandTotal = subtotal + gst + lsAmount;

  const formatINR = (n) => {
    const num = Number(n || 0);
    return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const numberToWords = (num) => {
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
      if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + inWords(n % 100) : "");
      if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
      return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
    };
    const n = Math.floor(Number(num) || 0);
    const paise = Math.round((Number(num) - n) * 100);
    let words = "Rupees ";
    if (n === 0) words += "Zero";
    else words += inWords(n);
    if (paise) words += ` and ${inWords(paise)} Paise`;
    words += " Only";
    return words;
  };

  const getErrorMessage = async (error) => {
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        return json.message || json.error || error.message;
      } catch {
        return error.message;
      }
    }
    return error.response?.data?.message || error.message;
  };

  const getPdfBlob = async () => {
    if (!estimateId) throw new Error("Estimate ID is missing.");
    const response = await pdfApi.generateAbstract({ estimate: data, items: itemList });
    if (!(response.data instanceof Blob)) throw new Error("Unexpected response format");
    if (response.data.type && response.data.type !== "application/pdf") {
      const text = await response.data.text();
      const json = JSON.parse(text);
      throw new Error(json.message || "PDF generation failed");
    }
    return new Blob([response.data], { type: "application/pdf" });
  };

  const downloadPdf = async () => {
    setLoading(true);
    try {
      const pdfBlob = await getPdfBlob();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${estimateId}_abstract.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const msg = await getErrorMessage(error);
      toast.error("Download failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const previewPdf = async () => {
    setLoading(true);
    try {
      const pdfBlob = await getPdfBlob();
      const url = window.URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");
    } catch (error) {
      const msg = await getErrorMessage(error);
      toast.error("Preview failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus, comment = "") => {
    if (!estimateId) { toast.error("Missing estimate ID."); return; }
    setLoading(true);
    try {
      const response = await estimateApi.updateStatus(estimateId, { status: newStatus, comments: comment });
      if (response.data?.success) {
        toast.success(`Status updated to "${newStatus}"`);
        await fetchEstimate(estimateId);
        await fetchMovements(estimateId);
      }
    } catch (error) {
      const msg = await getErrorMessage(error);
      toast.error("Failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSuccess = async () => {
    setOtpOpen(false);
    await fetchEstimate(estimateId);
    await fetchMovements(estimateId);
  };

  const status = data.status || "Draft";
  const isLocked = data.locked;
  const isOwner = role === "manager" && data.managerId === user.id;

  const canGenerateAbstract = status === "Draft" && isOwner;
  const canSubmit = (status === "Draft" || status === "Abstract Generated") && isOwner;
  const canEdit = (status === "Draft" || status === "Reverted") && isOwner;
  const canResubmit = status === "Reverted" && isOwner;
  const canDgmReview = (status === "Submitted" && (role === "dgm" || role === "ce"));
  const canDgmAct = (status === "DGM Review" && (role === "dgm" || role === "ce"));
  const canGmAct = (status === "GM Review" && (role === "gm" || role === "ce"));
  const canSendOtp = status === "OTP Pending" && (isOwner || role === "ce" || role === "admin");
  const canMarkComplete = status === "Digitally Signed" && role === "admin";

  const statusColor = {
    Draft: "secondary",
    "Abstract Generated": "info",
    Submitted: "primary",
    "DGM Review": "warning",
    "GM Review": "warning",
    "OTP Pending": "danger",
    "Digitally Signed": "success",
    Completed: "success",
    Reverted: "danger",
  };

  if (!estimate && !state?.form && !state?.estimateId) {
    return (
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <div className="container mt-4 flex-grow-1">
          <h4>No estimate selected</h4>
          <p className="text-muted">Your abstract preview was not found.</p>
          <div className="d-flex gap-2">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}><FaArrowLeft style={{ marginRight: 6 }} /> Back</button>
            <button className="btn btn-primary" onClick={() => navigate("/prepare-estimate")}>Open Prepare Estimate</button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="container mt-4 flex-grow-1">
        {/* Official Header */}
        <div className="text-center mb-3">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            style={{ width: 64, height: 64, borderRadius: 10, objectFit: "contain", marginBottom: 8 }}
          />
          <h4 style={{ margin: 0, color: "var(--primary)", fontWeight: 800, letterSpacing: "0.06em" }}>HMWSSB</h4>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Works Management System</p>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--primary-dark)", marginTop: 4 }}>Estimate Abstract</p>
        </div>

        <div className="d-flex align-items-center justify-content-between mb-3">
          <span className={`badge bg-${statusColor[status] || "secondary"}`} style={{ fontSize: "0.8rem", padding: "6px 14px" }}>
            {status}
          </span>
        </div>

        {isLocked && (
          <div className="alert alert-warning">This estimate is locked (Digitally Signed). It is read-only.</div>
        )}

        <div className="card p-3 mb-3">
          <div className="row">
            <div className="col-md-8">
              <div><strong>Estimate ID:</strong> {data.estimateId}</div>
              <div><strong>Work Name:</strong> {data.nameOfWork}</div>
              <div><strong>Officer:</strong> {data.managerName || "-"}</div>
              {data.signedBy?.name && (
                <div><strong>Signed by:</strong> {data.signedBy.name} ({data.signedBy.role}){data.signedAt ? ` on ${new Date(data.signedAt).toLocaleDateString()}` : ''}</div>
              )}
            </div>
            <div className="col-md-4 text-end">
              <div><strong>Document No:</strong> {data.documentNo || `${data.estimateId}-DOC`}</div>
              <div><strong>Version:</strong> {data.version || data.currentVersion || 'V1.0'}</div>
              <div><strong>Date:</strong> {new Date(data.createdAt || Date.now()).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div className="card p-3 mb-3">
          <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Material Works</h5>
          {materialRows.length === 0 ? <p className="text-muted">None</p> : (
            <ul>{materialRows.map((r, i) => <li key={i}>{r.material} - {r.qty} {r.unit} - Rs. {Number(r.amount || 0).toFixed(2)}</li>)}</ul>
          )}
          <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Civil Works</h5>
          {civilRows.length === 0 ? <p className="text-muted">None</p> : (
            <ul>{civilRows.map((r, i) => <li key={i}>{r.material} - {r.qty} {r.unit} - Rs. {Number(r.amount || 0).toFixed(2)}</li>)}</ul>
          )}
          {unclassifiedRows.length > 0 && (
            <>
              <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Other Items</h5>
              <ul>{unclassifiedRows.map((r, i) => <li key={i}>{r.material} - {r.qty} {r.unit} - Rs. {Number(r.amount || 0).toFixed(2)}</li>)}</ul>
            </>
          )}
          <div><strong>Material Cost:</strong> {formatINR(materialTotal)}</div>
          <div><strong>Civil Cost:</strong> {formatINR(civilTotal)}</div>
          <div><strong>Subtotal:</strong> {formatINR(subtotal)}</div>
          <div><strong>GST:</strong> {formatINR(gst)}</div>
          <div><strong>LS Amount:</strong> {formatINR(lsAmount)}</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary)", marginTop: 8 }}><strong>Grand Total:</strong> {formatINR(grandTotal)}</div>
          <div><strong>Amount (in words):</strong> {numberToWords(grandTotal)}</div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}><FaArrowLeft style={{ marginRight: 6 }} /> Back</button>

          {canGenerateAbstract && (
            <button className="btn btn-outline-primary" onClick={async () => { await handleStatusChange("Abstract Generated"); }} disabled={loading}>
              Generate Abstract
            </button>
          )}

          {canEdit && (
            <button className="btn btn-warning" onClick={() => navigate("/prepare-estimate", { state: { edit: true, form: data, items: itemList, lsAmount } })}>
              <FaEdit style={{ marginRight: 6 }} /> Edit Estimate
            </button>
          )}

          <button className="btn btn-info" onClick={previewPdf} disabled={loading}><FaFilePdf style={{ marginRight: 6 }} /> Preview PDF</button>
          <button className="btn btn-primary" onClick={downloadPdf} disabled={loading}><FaDownload style={{ marginRight: 6 }} /> Download PDF</button>

          {canSubmit && (
            <button className="btn btn-success" onClick={() => handleStatusChange("Submitted", "Estimate submitted for DGM review.")} disabled={loading}>
              <FaPaperPlane style={{ marginRight: 6 }} /> Submit to DGM
            </button>
          )}

          {canResubmit && (
            <button className="btn btn-success" onClick={() => handleStatusChange("Submitted", "Resubmitted after revision.")} disabled={loading}>
              <FaPaperPlane style={{ marginRight: 6 }} /> Resubmit to DGM
            </button>
          )}

          {canDgmReview && (
            <button className="btn btn-outline-dark" onClick={() => handleStatusChange("DGM Review", "Taken up for review.")} disabled={loading}>
              <FaCheck style={{ marginRight: 6 }} /> Take for Review
            </button>
          )}

          {canDgmAct && (
            <>
              <button className="btn btn-outline-success" onClick={() => handleStatusChange("GM Review", "Approved by DGM.")} disabled={loading}>
                <FaCheck style={{ marginRight: 6 }} /> Approve - Send to GM
              </button>
              <button className="btn btn-success" onClick={() => setOtpOpen(true)} disabled={loading}>
                <FaPenFancy style={{ marginRight: 6 }} /> Sign Digitally (OTP)
              </button>
              <button className="btn btn-danger" onClick={() => handleStatusChange("Reverted", "Reverted by DGM.")} disabled={loading}>
                <FaUndo style={{ marginRight: 6 }} /> Revert to Manager
              </button>
            </>
          )}

          {canGmAct && (
            <>
              <button className="btn btn-outline-success" onClick={() => handleStatusChange("OTP Pending", "Approved by GM, OTP required.")} disabled={loading}>
                <FaCheck style={{ marginRight: 6 }} /> Approve - Send for OTP
              </button>
              <button className="btn btn-success" onClick={() => setOtpOpen(true)} disabled={loading}>
                <FaPenFancy style={{ marginRight: 6 }} /> Sign Digitally (OTP)
              </button>
              <button className="btn btn-danger" onClick={() => handleStatusChange("Reverted", "Reverted by GM.")} disabled={loading}>
                <FaUndo style={{ marginRight: 6 }} /> Revert to DGM
              </button>
            </>
          )}

          {canSendOtp && (
            <button className="btn btn-success" onClick={() => setOtpOpen(true)} disabled={loading}>
              <FaStamp style={{ marginRight: 6 }} /> Generate Digital Signature
            </button>
          )}

          {canMarkComplete && (
            <button className="btn btn-secondary" onClick={() => handleStatusChange("Completed", "Estimate marked complete by admin.")} disabled={loading}>
              <FaCheck style={{ marginRight: 6 }} /> Mark Complete
            </button>
          )}
        </div>

        {movements.length > 0 && (
          <div className="card p-3 mt-4">
            <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Status History</h5>
            <div className="table-responsive">
              <table className="table table-sm table-bordered mt-2">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Actor</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m._id}>
                      <td>{new Date(m.createdAt).toLocaleString()}</td>
                      <td>{m.fromStatus}</td>
                      <td>{m.toStatus}</td>
                      <td>{m.actorName} ({m.actorRole})</td>
                      <td>{m.comments || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {movements.length === 0 && (
          <div className="card p-3 mt-4">
            <h5 style={{ color: "var(--primary)", fontWeight: 700 }}>Status History</h5>
            <p className="text-muted">No movements recorded yet.</p>
          </div>
        )}
      </div>
      <Footer />

      {otpOpen && estimateId && (
        <OTPModal
          isOpen={otpOpen}
          onClose={() => setOtpOpen(false)}
          estimateId={estimateId}
          managerName={data.managerName || user.name}
          email={user.email || data.managerEmail || ""}
          mobile={user.mobile || data.managerMobile || ""}
          onSuccess={handleOtpSuccess}
        />
      )}
    </div>
  );
}

export default AbstractWorkspace;
