import React from "react";

export default function Sidebar({ onLogout }) {
  return (
    <div className="sidebar">
      <button className="btn secondary full" disabled>
        Profile
      </button>
      <button className="btn secondary full" disabled>
        Settings
      </button>
      <button className="btn secondary full" onClick={onLogout}>
        Logout
      </button>
    </div>
  );
}
