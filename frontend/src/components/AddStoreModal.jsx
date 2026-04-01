import React, { useState } from "react";
import { addStore } from "../services/api";

export default function AddStoreModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    state: "",
    district: "",
    address: "",
    storeName: "",
    ownerName: "",
    ownerContact: "",
    storeGmail: "",
    connectedThrough: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors duration-300 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await addStore(formData);
    setLoading(false);
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setError(result.error || "Failed to add store");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Add New Store</h2>
        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
            <input type="text" name="state" value={formData.state} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">District</label>
            <input type="text" name="district" value={formData.district} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Store Name</label>
            <input type="text" name="storeName" value={formData.storeName} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Owner Name</label>
            <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Owner Contact</label>
            <input type="text" name="ownerContact" value={formData.ownerContact} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Store Gmail</label>
            <input type="email" name="storeGmail" value={formData.storeGmail} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Connected Through</label>
            <input type="text" name="connectedThrough" value={formData.connectedThrough} onChange={handleChange} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-60">{loading ? "Adding..." : "Add Store"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
