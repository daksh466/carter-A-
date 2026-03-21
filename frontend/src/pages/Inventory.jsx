import React, { useEffect, useState } from "react";
import api from "../services/api";

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get("/inventory")
      .then(res => {
        setItems(res.data);
        setError(null);
      })
      .catch(err => {
        setError("Failed to load inventory.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 32 }}>
      <h2>Inventory</h2>
      <table border="1" cellPadding="8" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Stock Quantity</th>
            <th>Item Code</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.itemCode}>
              <td>{item.itemName}</td>
              <td>{item.stockQuantity}</td>
              <td>{item.itemCode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventory;
