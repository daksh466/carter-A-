import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";

const readToken = () => {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem("token") || "").trim();
};

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    businessName: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordMismatch = useMemo(() => {
    if (!form.confirmPassword) return false;
    return form.password !== form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  if (readToken()) {
    return <Navigate to="/dashboard/welcome" replace />;
  }

  const setField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await registerUser({
      username: form.username,
      password: form.password,
      businessName: form.businessName,
      phone: form.phone,
    });
    setLoading(false);

    if (result?.success) {
      navigate("/login", {
        replace: true,
        state: { registered: true, username: form.username },
      });
      return;
    }

    setError(result?.error || result?.message || "Registration failed");
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
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.14)",
          padding: "28px",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "1.8rem", color: "#0f172a" }}>Create account</h1>
        <p style={{ margin: "0 0 20px", color: "#475569" }}>Set up your access in a minute.</p>

        <label htmlFor="username" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Username
        </label>
        <input
          id="username"
          value={form.username}
          onChange={setField("username")}
          autoComplete="username"
          minLength={3}
          maxLength={50}
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

        <label htmlFor="businessName" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Business name
        </label>
        <input
          id="businessName"
          value={form.businessName}
          onChange={setField("businessName")}
          autoComplete="organization"
          minLength={2}
          maxLength={100}
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

        <label htmlFor="phone" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={setField("phone")}
          autoComplete="tel"
          minLength={10}
          maxLength={15}
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
          value={form.password}
          onChange={setField("password")}
          autoComplete="new-password"
          minLength={8}
          maxLength={100}
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

        <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={setField("confirmPassword")}
          autoComplete="new-password"
          minLength={8}
          maxLength={100}
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
          disabled={loading || passwordMismatch}
          style={{
            width: "100%",
            border: "none",
            borderRadius: "10px",
            padding: "12px 14px",
            background: "#0f172a",
            color: "#ffffff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading || passwordMismatch ? 0.7 : 1,
          }}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p style={{ margin: "16px 0 0", textAlign: "center", color: "#334155" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
