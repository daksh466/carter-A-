import React from "react";
import { Link } from "react-router-dom";

const Home = () => (
  <div style={{ padding: 32 }}>
    <h2>Dashboard</h2>
    <div style={{ margin: '24px 0' }}>
      <Link to="/inventory"><button>Inventory</button></Link>
      <Link to="/alerts" style={{ marginLeft: 16 }}><button>Alerts</button></Link>
    </div>
    <p>Welcome to Carter++ ERP. Use the navigation above.</p>
  </div>
);

// File deleted - moved to frontend/src/pages/Home.jsx
