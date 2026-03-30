import React from "react";

/**
 * Responsive, minimal top navigation bar for the dashboard.
 * Includes search, notifications, and profile dropdown.
 */
const Navbar = () => {
  return (
    <nav className="navbar">
      {/* Logo/Brand */}
      <div className="navbar-title">Carter A++</div>
      <div className="navbar-search">
        <input
          type="text"
          placeholder="Search..."
          className="navbar-input"
        />
      </div>
      <div className="navbar-right">
        {/* Notification Icon */}
        <button className="relative p-2 rounded-full hover:bg-primary/10 transition" aria-label="Notifications">
          <svg width="22" height="22" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        {/* Profile Dropdown (dummy) */}
        <div className="relative group">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary font-bold text-lg"
            style={{
              background: "linear-gradient(135deg, #6ea8fe 0%, #1e2a78 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(110,168,254,0.15)",
              border: "2px solid #fff"
            }}
          >
            D
          </button>
          {/* Dropdown (hidden by default) */}
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg py-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-30">
            <a href="#profile" className="block px-4 py-2 text-sm hover:bg-gray-100">Profile</a>
            <a href="#settings" className="block px-4 py-2 text-sm hover:bg-gray-100">Settings</a>
            <a href="#logout" className="block px-4 py-2 text-sm hover:bg-gray-100">Logout</a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
