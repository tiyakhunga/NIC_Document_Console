import React, { useState } from "react";

const API_BASE = "";

export default function Login({
  username,
  setUsername,
  setScreen,
  setProjects,
  resetWorkspaceState,
  setStatus,
  setError,
}) {
  const [localLoading, setLocalLoading] = useState(false);

  const refreshUserProjects = async (u) => {
    const res = await fetch(`${API_BASE}/api/user?username=${encodeURIComponent(u)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to fetch user.");
    return data;
  };

  const handleContinue = async () => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    if (!u) return setError("Please enter username.");

    try {
      setLocalLoading(true);
      const data = await refreshUserProjects(u);

      if (data.exists) {
        setProjects(data.projects || []);
        resetWorkspaceState();
        setScreen("dashboard");
        setStatus("✅ User found. Opening dashboard...");
      } else {
        setError("Username not found. Please create a new username.");
      }
    } catch (e) {
      setError(e.message || "Server error!");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    if (!u) return setError("Please enter username.");

    try {
      setLocalLoading(true);
      const res = await fetch(`${API_BASE}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create user.");

      setProjects([]);
      resetWorkspaceState();
      setScreen("dashboard");
      setStatus("✅ User created. Welcome!");
    } catch (e) {
      setError(e.message || "Server error!");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="login-box">
        <h2 className="title">NIC Document Console</h2>
        <p className="subtitle">Enter your username to continue</p>

        <input
          className="input"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={localLoading}
        />

        <div className="btn-row">
          <button className="btn" onClick={handleContinue} disabled={localLoading}>
            {localLoading ? "Please wait..." : "Continue"}
          </button>
        </div>

        <div className="btn-row">
          <button className="btn secondary" onClick={handleCreateUser} disabled={localLoading}>
            Create New Username
          </button>
        </div>
      </div>
    </div>
  );
}
