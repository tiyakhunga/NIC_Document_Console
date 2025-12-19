import React, { useState } from "react";

const API_BASE = "";

export default function Dashboard({
  username,
  setScreen,
  projects,
  setProjects,
  setProjectName,
  resetWorkspaceState,
  setStatus,
  setError,
}) {
  const [newProjectName, setNewProjectName] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  const refreshUserProjects = async () => {
    const u = (username || "").trim();
    if (!u) throw new Error("Missing username.");
    const res = await fetch(`${API_BASE}/api/user?username=${encodeURIComponent(u)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to fetch user.");
    setProjects(data.projects || []);
    return data;
  };

  const handleCreateProject = async () => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    const p = (newProjectName || "").trim();
    if (!u) return setError("Username is required.");
    if (!p) return setError("Please enter a new project name.");

    try {
      setLocalLoading(true);

      const res = await fetch(`${API_BASE}/api/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, projectName: p }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create project.");

      setStatus("✅ Project created.");
      setNewProjectName("");
      await refreshUserProjects();

      // open the new project
      setProjectName(p);
      resetWorkspaceState();
      setScreen("project");
    } catch (e) {
      setError(e.message || "Server error!");
    } finally {
      setLocalLoading(false);
    }
  };

  const openProject = async (pname) => {
    setStatus("");
    setError("");
    if (!pname) return;

    setProjectName(pname);
    resetWorkspaceState();
    setScreen("project");
  };

  const handleLogout = () => {
    setStatus("");
    setError("");
    setProjects([]);
    setProjectName("");
    resetWorkspaceState();
    setScreen("login");
  };

  return (
    <div className="page">
      <div className="login-box">
        <div className="dashboard-root">
          <div className="dashboard-header">
            <div>
              <h2 className="title">Dashboard</h2>
              <p className="subtitle">User: {username}</p>
            </div>

            <div className="top-actions">
              <input
                className="input small"
                type="text"
                placeholder="New Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={localLoading}
              />
              <button className="btn" onClick={handleCreateProject} disabled={localLoading}>
                + New Project
              </button>
            </div>
          </div>

          <div className="dashboard-body">
            <div className="sidebar">
              <button className="btn secondary full" disabled>
                Profile
              </button>
              <button className="btn secondary full" disabled>
                Settings
              </button>
              <button className="btn secondary full" onClick={handleLogout} disabled={localLoading}>
                Logout
              </button>
            </div>

            <div className="tiles">
              {projects.length === 0 ? (
                <div className="empty-state">
                  <p className="subtitle">
                    No projects yet. Create one using “+ New Project”.
                  </p>
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p}
                    className="tile"
                    onClick={() => openProject(p)}
                    disabled={localLoading}
                  >
                    <div className="tile-name">{p}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              className="btn secondary"
              style={{ width: "auto" }}
              onClick={async () => {
                setStatus("");
                setError("");
                try {
                  setLocalLoading(true);
                  await refreshUserProjects();
                  setStatus("✅ Refreshed.");
                } catch (e) {
                  setError(e.message || "Server error!");
                } finally {
                  setLocalLoading(false);
                }
              }}
              disabled={localLoading}
            >
              Refresh Projects
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
