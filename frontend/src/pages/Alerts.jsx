import React, { useEffect, useState } from "react";
import { getAlerts } from "../services/api";

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAlerts()
      .then((res) => {
        setAlerts(Array.isArray(res?.data) ? res.data : []);
        setError(null);
      })
      .catch(() => {
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

export default Alerts;
