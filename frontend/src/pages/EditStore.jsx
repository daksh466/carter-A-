import React, { useState } from "react";
import { updateStore } from "../services/api";

export default function EditStore({ store, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    state: store.state || store.address || "",
    storeHead: store.storeHead || store.name || "",
    contact: store.contact || store.phone || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const storeId = store._id || store.id;
      const res = await updateStore(storeId, form);
      if (res.success) {
        onSuccess && onSuccess();
      } else {
        setError(res.error || "Failed to update store");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card" style={{ marginBottom: 16 }}>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>State</label>
        <input
          name="state"
          value={form.state}
          onChange={handleChange}
          placeholder="State"
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>Store Head</label>
        <input
          name="storeHead"
          value={form.storeHead}
          onChange={handleChange}
          placeholder="Store Head"
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>Contact</label>
        <input
          name="contact"
          value={form.contact}
          onChange={handleChange}
          placeholder="Contact"
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="saas-btn saas-btn-primary" style={{ padding: "8px 14px" }}>{loading ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onCancel} className="saas-btn" style={{ padding: "8px 14px" }}>Cancel</button>
      </div>
      {error && <div style={{ color: "#fecaca" }}>{error}</div>}
    </form>
  );
}
