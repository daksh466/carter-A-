import React, { useState } from "react";
import api from "../services/api";

const ApiStatusChecker = () => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const checkApi = async () => {
    setStatus("loading");
    setError(null);
    setData(null);
    try {
      const res = await api.get("/machines");
      if (!res?.data) {
        setStatus("fail");
        setError("Empty response from backend");
        return;
      }
      setData(res.data);
      setStatus("ok");
    } catch (err) {
      setStatus("fail");
      const message = err?.response?.data?.message || err?.message || "Request failed";
      console.error("API status check failed", err);
      setError(message);
    }
  };

  return (
    <div style={{ background: "#23284a", color: "#fff", borderRadius: 12, padding: 24, maxWidth: 400, margin: "40px auto", boxShadow: "0 2px 12px #0005" }}>
      <h2 style={{ marginBottom: 16 }}>API Status Checker</h2>
      <button onClick={checkApi} style={{ padding: "10px 28px", borderRadius: 8, background: "#6ea8fe", color: "#fff", border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer", marginBottom: 18 }}>
        Test Backend Connection
      </button>
      {status === "ok" && <div style={{ color: "#4caf50", fontWeight: 600, marginBottom: 8 }}>Backend Connected ✅</div>}
      {status === "fail" && <div style={{ color: "#e74c3c", fontWeight: 600, marginBottom: 8 }}>Backend Not Connected ❌</div>}
      {status === "loading" && <div style={{ color: "#f1c40f", fontWeight: 600, marginBottom: 8 }}>Checking...</div>}
      {data && (
        <pre style={{ background: "#181c2f", color: "#b3c6ff", padding: 12, borderRadius: 8, fontSize: 13, marginTop: 8, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(data, null, 2)}</pre>
      )}
      {error && (
        <div style={{ color: "#ffb300", marginTop: 8, fontSize: 14 }}>Error: {error}</div>
      )}
    </div>
  );
};

export default ApiStatusChecker;
