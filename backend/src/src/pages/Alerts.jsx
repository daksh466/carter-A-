import React, { useEffect, useState } from "react";
import api from "../services/api";

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get("/inventory/alerts")
      .then(res => {
        setAlerts(res.data);
        setError(null);
      })
      .catch(err => {
        setError("Failed to load alerts.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 32 }}>
      <h2>Alerts</h2>
      <ul style={{ marginTop: 16 }}>
        {alerts.length === 0 && <li>No alerts.</li>}
        {alerts.map((alert, idx) => (
          <li key={idx}>{alert.message || JSON.stringify(alert)}</li>
        ))}
      </ul>
    </div>
  );
};

// File deleted - moved to frontend/src/pages/Alerts.jsx
