import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemApi, estimateApi } from "../../services/api";
import { calculateAmount, calculateGrandTotal, calculateQty } from "../../utils/estimateUtils";

function MaterialTable({ rows, setRows, form, lsAmount, setLsAmount }) {
  const navigate = useNavigate();
  const [itemMaster, setItemMaster] = useState([]);
  const [localRows, setLocalRows] = useState([
    { material: "", description: "", n: "", l: "", b: "", d: "", qty: 0, rate: "", unit: "Nos", gst: 18, amount: 0 },
  ]);
  const activeRows = rows?.length ? rows : localRows;
  const updateRows = (nextRows) => {
    if (setRows) setRows(nextRows);
    else setLocalRows(nextRows);
  };
  const [search, setSearch] = useState("");

  useEffect(() => {
    itemApi.getAll().then((r) => { if (r.data?.success) setItemMaster(r.data.data || r.data.items || []); }).catch((err) => { console.error("Failed to load item master:", err); });
  }, []);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return itemMaster;
    return itemMaster.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, itemMaster]);

  const [isSaving, setIsSaving] = useState(false);

  const buildPayload = () => ({
    ...form,
    lsAmount: Number(lsAmount || 0),
    items: activeRows.map((row) => ({
      material: row.material,
      description: row.description,
      category: row.description,
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

  const saveEstimate = async () => {
    if (!form?.estimateId || !form?.nameOfWork) {
      alert('Please fill in Estimate ID and Name of Work before saving.');
      return false;
    }
    if (activeRows.length === 0 || activeRows.some((r) => !r.material?.trim())) {
      alert('Please fill in the material name for all items before saving.');
      return false;
    }
    setIsSaving(true);
    try {
      await estimateApi.create(buildPayload());
      return true;
    } catch (err) {
      if (err.response?.status === 409) {
        try {
          await estimateApi.update(form.estimateId, buildPayload());
          return true;
        } catch (updateErr) {
          alert(updateErr.response?.data?.message || 'Failed to update estimate.');
          return false;
        }
      }
      alert(err.response?.data?.message || err.message || 'Failed to save estimate.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    await saveEstimate();
  };

  const handleFinalize = async () => {
    const saved = await saveEstimate();
    if (saved) {
      navigate("/abstract", { state: { form, items: activeRows, lsAmount, grandTotal } });
    }
  };

  const handlePreview = async () => {
    const saved = await saveEstimate();
    if (saved) {
      const previewState = { form, items: activeRows, lsAmount, grandTotal };
      sessionStorage.setItem("hmwssb-abstract-preview", JSON.stringify(previewState));
      navigate("/abstract", { state: previewState });
    }
  };

  const addRow = () => {
    updateRows([...activeRows, { material: "", description: "", n: "", l: "", b: "", d: "", qty: 0, rate: "", unit: "Nos", gst: 18, amount: 0 }]);
  };

  const deleteRow = (index) => {
    const data = [...activeRows];
    data.splice(index, 1);
    updateRows(data);
  };

  const handleChange = (index, field, value) => {
    const data = [...activeRows];
    data[index][field] = value;
    const qty = calculateQty({ n: data[index].n, l: data[index].l, b: data[index].b, d: data[index].d });
    data[index].qty = qty;
    data[index].amount = calculateAmount({ qty, rate: data[index].rate, gstPercent: data[index].gst });
    updateRows(data);
  };

  const handleSelectItem = (index, itemName) => {
    const selectedItem = itemMaster.find((item) => item.name === itemName);
    if (!selectedItem) return;
    const data = [...activeRows];
    data[index].material = selectedItem.name;
    data[index].unit = selectedItem.unit;
    data[index].rate = selectedItem.rate;
    data[index].gst = selectedItem.gst;
    data[index].description = selectedItem.category;
    const qty = calculateQty({ n: data[index].n, l: data[index].l, b: data[index].b, d: data[index].d });
    data[index].qty = qty;
    data[index].amount = calculateAmount({ qty, rate: selectedItem.rate, gstPercent: selectedItem.gst });
    updateRows(data);
  };

  const grandTotal = calculateGrandTotal(activeRows, lsAmount);

  return (
    <div className="card mt-4 shadow">
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="table-primary">
            <tr>
              <th>S.No</th>
              <th>Material</th>
              <th>Category</th>
              <th>N</th><th>L</th><th>B</th><th>D</th>
              <th>Qty</th><th>Rate</th><th>Unit</th><th>GST</th><th>Amount</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>
                  <input type="text" className="form-control" placeholder="Search item master"
                    value={row.material}
                    onChange={(e) => { handleChange(index, "material", e.target.value); setSearch(e.target.value); }} />
                  {row.material && filteredItems.length > 0 && (
                    <div className="small text-muted mt-1">
                      {filteredItems.slice(0, 5).map((item) => (
                        <div key={item.name} role="button" tabIndex={0}
                          onClick={() => handleSelectItem(index, item.name)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSelectItem(index, item.name); }}>
                          {item.name}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <select className="form-select" value={row.description}
                    onChange={(e) => handleChange(index, "description", e.target.value)}>
                    <option value="Material">Material</option>
                    <option value="Civil">Civil</option>
                  </select>
                </td>
                <td><input type="number" className="form-control" value={row.n} onChange={(e) => handleChange(index, "n", e.target.value)} /></td>
                <td><input type="number" className="form-control" value={row.l} onChange={(e) => handleChange(index, "l", e.target.value)} /></td>
                <td><input type="number" className="form-control" value={row.b} onChange={(e) => handleChange(index, "b", e.target.value)} /></td>
                <td><input type="number" className="form-control" value={row.d} onChange={(e) => handleChange(index, "d", e.target.value)} /></td>
                <td>{row.qty}</td>
                <td><input type="number" className="form-control" value={row.rate} onChange={(e) => handleChange(index, "rate", e.target.value)} /></td>
                <td><input className="form-control" value={row.unit} onChange={(e) => handleChange(index, "unit", e.target.value)} /></td>
                <td>
                  <select className="form-select" value={row.gst} onChange={(e) => handleChange(index, "gst", Number(e.target.value))}>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </td>
                <td>Rs. {row.amount.toFixed(2)}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => deleteRow(index)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center p-3 flex-wrap gap-2">
        <button className="btn btn-success" onClick={addRow}>+ Add Row</button>
        <div className="d-flex align-items-center gap-2">
          <label className="fw-bold">LS Amount</label>
          <input type="number" className="form-control" style={{ width: "140px" }} value={lsAmount}
            onChange={(e) => setLsAmount(Number(e.target.value || 0))} />
        </div>
        <h4>Grand Total : Rs. {grandTotal.toFixed(2)}</h4>
      </div>

      <div className="d-flex justify-content-end gap-2 p-3">
        <button className="btn btn-warning" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-primary" onClick={handlePreview} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Generate Abstract'}
        </button>
        <button className="btn btn-danger" onClick={handleFinalize} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Finalize Estimate'}
        </button>
      </div>
    </div>
  );
}

export default MaterialTable;
