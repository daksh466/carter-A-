import React, { useState } from "react";

/**
 * Add Product page: form for adding a new product.
 */
const AddProduct = () => {
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    quantity: "",
    supplier: "",
    image: null,
  });

  const handleChange = e => {
    const { name, value, files } = e.target;
    setForm(f => ({
      ...f,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    // TODO: Integrate with backend
    alert("Product added!");
  };

  return (
    <div className="w-full max-w-xl mx-auto py-8 px-2">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Add Product</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-card p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Name</label>
          <input name="name" value={form.name} onChange={handleChange} required className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Category</label>
          <input name="category" value={form.category} onChange={handleChange} required className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Price</label>
          <input name="price" value={form.price} onChange={handleChange} required type="number" min="0" step="0.01" className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Quantity</label>
          <input name="quantity" value={form.quantity} onChange={handleChange} required type="number" min="0" className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Supplier</label>
          <input name="supplier" value={form.supplier} onChange={handleChange} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm">Image</label>
          <input name="image" type="file" accept="image/*" onChange={handleChange} className="file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-semibold file:cursor-pointer" />
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition">Save</button>
          <button type="button" className="bg-gray-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default AddProduct;
