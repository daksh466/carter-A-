import React from "react";

/**
 * Reusable Card component for dashboard stats and info.
 * Props:
 * - title: string (card label)
 * - value: string|number (main value)
 * - icon: optional React node
 * - className: optional Tailwind classes
 */
const Card = ({ title, value, icon, className = "" }) => (
  <div className={`card ${className}`} tabIndex={0} aria-label={title}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 24, color: '#2563EB' }}>{icon}</span>}
      <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: 0.5 }}>{title}</span>
    </div>
    <span style={{ fontSize: 32, fontWeight: 800, color: '#1e2a78', textShadow: '0 2px 12px #6ea8fe22' }}>{value}</span>
  </div>
);

export default Card;
