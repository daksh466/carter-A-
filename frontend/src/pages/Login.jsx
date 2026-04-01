import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

const readToken = () => {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem("token") || "").trim();
};

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (readToken()) {
    return <Navigate to="/dashboard/welcome" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await loginUser({ username, password });
    setLoading(false);

    if (result?.success) {
      navigate("/dashboard/welcome", { replace: true });
      return;
    }

    setError(result?.error || result?.message || "Login failed");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.14)",
          padding: "28px",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "1.8rem", color: "#0f172a" }}>Sign in</h1>
        <p style={{ margin: "0 0 20px", color: "#475569" }}>Use your account to continue.</p>

        <label htmlFor="username" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
          style={{
            width: "100%",
            marginBottom: "14px",
            padding: "12px 13px",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            fontSize: "1rem",
          }}
        />

        <label htmlFor="password" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          style={{
            width: "100%",
            marginBottom: "14px",
            padding: "12px 13px",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            fontSize: "1rem",
          }}
        />

        {error ? (
          <div
            role="alert"
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: "10px",
            padding: "12px 14px",
            background: "#0f172a",
            color: "#ffffff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p style={{ margin: "16px 0 0", textAlign: "center", color: "#334155" }}>
          New here?{" "}
          <Link
            to="/register"
            style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}
          >
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
