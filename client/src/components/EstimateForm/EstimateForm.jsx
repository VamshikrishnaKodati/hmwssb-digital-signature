import { useMemo, useState, useEffect, useCallback } from "react";
import { estimateApi, hierarchyApi } from "../../services/api";

function EstimateForm({ rows, onSaved, form: formProp, setForm: setFormProp, lsAmount = 0 }) {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const [localForm, setLocalForm] = useState({
        estimateId: `EST-${Date.now()}`,
        nameOfWork: "",
        region: user?.region || "",
        zone: user?.zone || "",
        division: user?.division || "",
        circle: user?.circle || "",
        ward: user?.ward || "",
    });
    const form = formProp || localForm;
    const setForm = setFormProp || setLocalForm;
    const [message, setMessage] = useState("");

    const [regions, setRegions] = useState([]);
    const [zones, setZones] = useState([]);
    const [circles, setCircles] = useState([]);
    const [wards, setWards] = useState([]);
    const [loadingHierarchy, setLoadingHierarchy] = useState(true);

    const loadHierarchy = useCallback(async () => {
        setLoadingHierarchy(true);
        try {
            const [regionsRes, zonesRes] = await Promise.all([
                hierarchyApi.getRegions(),
                hierarchyApi.getZones(),
            ]);
            setRegions(Array.isArray(regionsRes.data?.data) ? regionsRes.data.data : []);
            setZones(Array.isArray(zonesRes.data?.data) ? zonesRes.data.data : []);
        } catch (e) {
            console.warn("Failed to load hierarchy", e);
        } finally {
            setLoadingHierarchy(false);
        }
    }, []);

    useEffect(() => { loadHierarchy(); }, [loadHierarchy]);

    useEffect(() => {
        if (!form.zone || zones.length === 0) {
            setCircles([]);
            setWards([]);
            return;
        }
        const match = zones.find((z) => z.name === form.zone);
        if (!match) return;

        hierarchyApi.getCircles(match._id).then((res) => {
            setCircles(Array.isArray(res.data?.data) ? res.data.data : []);
        }).catch(() => setCircles([]));
    }, [form.zone, zones]);

    useEffect(() => {
        if (!form.circle || circles.length === 0) {
            setWards([]);
            return;
        }
        const match = circles.find((c) => `${c.circleNo} - ${c.name}` === form.circle);
        if (!match) return;

        hierarchyApi.getWards(match._id).then((res) => {
            setWards(Array.isArray(res.data?.data) ? res.data.data : []);
        }).catch(() => setWards([]));
    }, [form.circle, circles]);

    const handleZoneChange = (e) => {
        const zoneName = e.target.value;
        setForm({ ...form, zone: zoneName, circle: "", ward: "" });
    };

    const handleCircleChange = (e) => {
        const circleVal = e.target.value;
        setForm({ ...form, circle: circleVal, ward: "" });
    };

    const handleWardChange = (e) => {
        setForm({ ...form, ward: e.target.value });
    };

    const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const validRows = rows.filter((row) => row.material?.trim());
            if (rows.length > 0 && validRows.length === 0) {
                setMessage("Please add at least one item with a material name.");
                return;
            }
            const response = await estimateApi.create({
                ...form,
                lsAmount: Number(lsAmount || 0),
                items: validRows.map((row) => ({
                    material: row.material,
                    description: row.description,
                    category: row.category || "Material",
                    n: Number(row.n || 0),
                    l: Number(row.l || 0),
                    b: Number(row.b || 0),
                    d: Number(row.d || 0),
                    qty: Number(row.qty || 0),
                    rate: Number(row.rate || 0),
                    unit: row.unit,
                    gst: Number(row.gst || 0),
                    amount: Number(row.amount || 0),
                })),
            });

            if (response.data?.success) {
                setMessage("Estimate saved successfully.");
                localStorage.removeItem("hmwssb-estimate-draft");
                onSaved?.();
            } else {
                setMessage(response.data?.message || "Unable to save estimate.");
            }
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save estimate.");
        }
    };

    return (
        <form className="card p-4 mt-3" onSubmit={handleSubmit}>
            <div className="row">
                <div className="col-md-2">
                    <label className="form-label fw-semibold">Region</label>
                    <select className="form-select" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} disabled={loadingHierarchy}>
                        <option value="">{loadingHierarchy ? "Loading..." : "Select Region"}</option>
                        {regions.map((r) => (
                            <option key={r._id} value={r.name}>{r.name}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-2">
                    <label className="form-label fw-semibold">Zone</label>
                    <select className="form-select" value={form.zone} onChange={handleZoneChange} disabled={loadingHierarchy}>
                        <option value="">{loadingHierarchy ? "Loading..." : "Select Zone"}</option>
                        {zones.map((z) => (
                            <option key={z._id} value={z.name}>{z.name}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-2">
                    <label className="form-label fw-semibold">Division</label>
                    <input className="form-control" placeholder="Enter Division" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} />
                </div>
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Circle</label>
                    <select className="form-select" value={form.circle} onChange={handleCircleChange} disabled={!form.zone}>
                        <option value="">{!form.zone ? "Select Zone first" : "Select Circle"}</option>
                        {circles.map((c) => (
                            <option key={c._id} value={`${c.circleNo} - ${c.name}`}>{c.circleNo} - {c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Ward</label>
                    <select className="form-select" value={form.ward} onChange={handleWardChange} disabled={!form.circle}>
                        <option value="">{!form.circle ? "Select Circle first" : "Select Ward"}</option>
                        {wards.map((w) => (
                            <option key={w._id} value={`${w.wardNo} - ${w.name}`}>{w.wardNo} - {w.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="row mt-4">
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Estimate ID</label>
                    <input className="form-control" value={form.estimateId} onChange={(e) => setForm({ ...form, estimateId: e.target.value })} />
                </div>
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Name of Work</label>
                    <input className="form-control" placeholder="Enter Work Name" value={form.nameOfWork} onChange={(e) => setForm({ ...form, nameOfWork: e.target.value })} />
                </div>
                <div className="col-md-3 d-flex align-items-end">
                    <button className="btn btn-success w-100">Save Estimate</button>
                </div>
            </div>

            <div className="mt-3 text-muted">Current total: Rs. {totalAmount.toFixed(2)}</div>
            {message && <div className="alert alert-info mt-3">{message}</div>}
        </form>
    );
}

export default EstimateForm;
