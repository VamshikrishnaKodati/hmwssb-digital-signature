import { useState, useEffect } from "react";
import { itemApi } from "../../services/api";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { FaPlus, FaEdit, FaTrash, FaSearch, FaBoxes } from "react-icons/fa";
import { toast } from "react-toastify";
import "./AdminItems.css";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

const emptyItem = { itemCode: "", name: "", description: "", category: "Material", unit: "", rate: 0, gst: 18 };

function AdminItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ...emptyItem });
  const [saving, setSaving] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterCategory) params.category = filterCategory;
      const res = await itemApi.getAll(params);
      const list = res.data?.items || res.data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [filterCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.name || "").toLowerCase().includes(q) || (item.itemCode || "").toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q);
  });

  const openCreate = () => { setEditingItem(null); setForm({ ...emptyItem }); setShowModal(true); };
  const openEdit = (item) => { setEditingItem(item); setForm({ ...item }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.itemCode.trim() || !form.name.trim() || !form.unit.trim()) {
      toast.error("Item Code, Name, and Unit are required");
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await itemApi.update(editingItem._id, form);
        toast.success("Item updated");
      } else {
        await itemApi.create(form);
        toast.success("Item created");
      }
      setShowModal(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete item "${item.name}" (${item.itemCode})?`)) return;
    try {
      await itemApi.delete(item._id);
      toast.success("Item deleted");
      loadItems();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="admin-items-page flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <img src={LOGO_SRC} alt="HMWSSB Official Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain" }} />
            <div>
              <h3 style={{ margin: 0, color: "var(--primary)" }}>Item Master</h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Manage material and civil items</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}><FaPlus className="me-1" /> Add Item</button>
        </div>

        <div className="card p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Search</label>
              <div className="input-group">
                <span className="input-group-text"><FaSearch /></span>
                <input type="text" className="form-control" placeholder="Search by name, code, or description..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Category</label>
              <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All</option>
                <option value="Material">Material</option>
                <option value="Civil">Civil</option>
              </select>
            </div>
            <div className="col-md-2">
              <span className="text-muted" style={{ fontSize: "0.85rem" }}>{filtered.length} items</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4"><div className="spinner-border" style={{ color: "var(--primary)" }} /></div>
        ) : (
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Rate</th>
                    <th>GST %</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item._id}>
                      <td><code>{item.itemCode}</code></td>
                      <td>{item.name}</td>
                      <td><span className={`badge ${item.category === "Material" ? "bg-primary" : "bg-success"}`}>{item.category}</span></td>
                      <td>{item.unit}</td>
                      <td>Rs. {Number(item.rate || 0).toFixed(2)}</td>
                      <td>{item.gst}%</td>
                      <td><span className={`badge ${item.status === "active" ? "bg-success" : "bg-secondary"}`}>{item.status}</span></td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(item)} title="Edit"><FaEdit /></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(item)} title="Delete"><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted py-4"><FaBoxes size={32} className="mb-2 d-block mx-auto" style={{ opacity: 0.3 }} />No items found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingItem ? "Edit Item" : "Create Item"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Item Code *</label>
                    <input type="text" className="form-control" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} placeholder="e.g. MAT-001" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Name *</label>
                    <input type="text" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Category *</label>
                    <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      <option value="Material">Material</option>
                      <option value="Civil">Civil</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Unit *</label>
                    <input type="text" className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. Kg, CUM, Bag" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Rate (Rs.) *</label>
                    <input type="number" className="form-control" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} min="0" step="0.01" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">GST %</label>
                    <select className="form-select" value={form.gst} onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })}>
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Saving...</> : editingItem ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default AdminItems;
