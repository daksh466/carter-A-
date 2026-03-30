import React from "react";
import { useNavigate } from "react-router-dom";
import "../index.css";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a23 0%, #1e2a78 100%)",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "rgba(34, 40, 70, 0.72)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.18)",
          borderRadius: "24px",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "720px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "#fff",
            marginBottom: 12,
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          Welcome to Carter A++
        </h1>
        <h2
          style={{
            fontSize: "1.2rem",
            color: "#b3c6ff",
            fontWeight: 500,
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          Smart Inventory and Business Management
        </h2>
        <p
          style={{
            fontSize: "1rem",
            color: "#e0e6f7",
            marginBottom: 28,
            textAlign: "center",
            maxWidth: "540px",
          }}
        >
          Carter A++ gives your team one place to manage machines, spare parts,
          orders, and alerts in real time.
        </p>

        <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            style={{
              padding: "12px 28px",
              borderRadius: "999px",
              fontSize: "1rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 12px 0 rgba(0,0,0,0.10)",
              background: "linear-gradient(90deg, #6ea8fe 0%, #1e2a78 100%)",
              color: "#fff",
            }}
            onClick={() => navigate("/dashboard", { state: { fromWelcome: true } })}
          >
            Get Started
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          margin: "36px auto 0 auto",
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: "900px",
          width: "100%",
        }}
      >
        {[
          {
            title: "Inventory Tracking",
            desc: "Real-time stock levels and live alert visibility.",
          },
          {
            title: "Order Management",
            desc: "End-to-end order processing with clear status flow.",
          },
          {
            title: "Analytics Dashboard",
            desc: "Operational insights that help teams act faster.",
          },
        ].map((f, i) => (
          <div
            key={i}
            style={{
              background: "rgba(34, 40, 70, 0.55)",
              borderRadius: "16px",
              boxShadow: "0 2px 12px 0 rgba(0,0,0,0.10)",
              padding: "22px 24px",
              minWidth: "220px",
              maxWidth: "270px",
              margin: "0 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#6ea8fe",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {f.title}
            </div>
            <div style={{ fontSize: "0.96rem", color: "#e0e6f7", textAlign: "center" }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Welcome;
