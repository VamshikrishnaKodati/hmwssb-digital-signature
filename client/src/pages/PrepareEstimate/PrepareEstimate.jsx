import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import EstimateForm from "../../components/EstimateForm/EstimateForm";
import MaterialTable from "../../components/MaterialTable/MaterialTable";
const LOGO_SRC = "/assets/logo/hmwssb-logo.png";
const DRAFT_KEY = "hmwssb-estimate-draft";

function PrepareEstimate() {
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [lsAmount, setLsAmount] = useState(0);
  const [form, setForm] = useState({
    estimateId: `EST-${Date.now()}`,
    nameOfWork: "",
    region: "HMC",
    zone: "",
    division: "",
    circle: "",
    ward: "",
    managerName: "",
    managerDesignation: "",
    documentNo: "",
    version: "V1.0",
    status: "Draft",
  });

  useEffect(() => {
    if (location.state?.edit) {
      setForm(location.state.form || form);
      setRows(location.state.items || []);
      setLsAmount(location.state.lsAmount || 0);
      return;
    }

    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft);
      setForm(parsed.form || form);
      setRows(parsed.rows || []);
      setLsAmount(parsed.lsAmount || 0);
    } catch (error) {
      console.warn("Failed to restore estimate draft", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const payload = { form, rows, lsAmount };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  }, [form, rows, lsAmount]);

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
          <h3 style={{ margin: 0, color: "var(--primary)" }}>Prepare Estimate</h3>
        </div>

        <EstimateForm rows={rows} form={form} setForm={setForm} lsAmount={lsAmount} onSaved={() => setRows([])} />

        <MaterialTable rows={rows} setRows={setRows} form={form} lsAmount={lsAmount} setLsAmount={setLsAmount} />
      </div>
      <Footer />
    </div>
  );
}

export default PrepareEstimate;
