import React, { useState } from "react";
import { addStore } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function AddStore({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    state: "",
    storeHead: "",
    contact: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await addStore(formData);
      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data);
        } else {
          navigate(-1);
        }
      } else {
        setError(result.error || "Failed to add store");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="card" style={{ width: "100%" }}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: "#f8fafc" }}>Add Store</h2>
      </div>
      {error && (
        <div
          className="mb-4 rounded p-3 text-sm"
          style={{ border: "1px solid rgba(248, 113, 113, 0.45)", background: "rgba(127, 29, 29, 0.35)", color: "#fecaca" }}
        >
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>Store Head</label>
          <input
            type="text"
            name="storeHead"
            value={formData.storeHead}
            onChange={handleChange}
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "#cbd5e1" }}>Contact</label>
          <input
            type="text"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: "rgba(148, 163, 184, 0.35)", background: "rgba(15, 23, 42, 0.72)", color: "#e2e8f0" }}
            required
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={handleCancel} className="saas-btn" style={{ padding: "8px 14px" }}>Cancel</button>
          <button type="submit" disabled={loading} className="saas-btn saas-btn-primary" style={{ padding: "8px 14px" }}>{loading ? "Adding..." : "Add Store"}</button>
        </div>
      </form>
    </div>
  );
}
