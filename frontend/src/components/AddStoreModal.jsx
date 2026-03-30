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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Add New Store</h2>
        {error && <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
            <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">District</label>
            <input type="text" name="district" value={formData.district} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Store Name</label>
            <input type="text" name="storeName" value={formData.storeName} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Owner Name</label>
            <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Owner Contact</label>
            <input type="text" name="ownerContact" value={formData.ownerContact} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Store Gmail</label>
            <input type="email" name="storeGmail" value={formData.storeGmail} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Connected Through</label>
            <input type="text" name="connectedThrough" value={formData.connectedThrough} onChange={handleChange} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-60">{loading ? "Adding..." : "Add Store"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
