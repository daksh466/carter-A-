import React, { useState } from "react";
import useApp from "../hooks/useApp";
import "../index.css";

const Header = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { searchQuery, setSearchQuery, currentStore } = useApp();

  return (
    <header className="header">
      <div className="header-left">
        <span className="app-name">Carter A++</span>
        <span style={{ marginLeft: 16, fontSize: 14, color: '#6ea8fe' }}>
          {currentStore ? currentStore.name : 'Loading...'}
        </span>
      </div>
      <div className="header-right">
        <input 
          className="search-bar" 
          type="text" 
          placeholder="Search machines, parts..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="notification-icon" title="Notifications">🔔</span>
        <div className="profile-section" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <img
            src="https://ui-avatars.com/api/?name=User&background=333&color=fff"
            alt="Profile"
            className="avatar"
          />
          <span className="profile-name">Admin</span>
          <span className="dropdown-arrow">▼</span>
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item">Profile</div>
              <div className="dropdown-item">Settings</div>
              <div className="dropdown-item">Logout</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
