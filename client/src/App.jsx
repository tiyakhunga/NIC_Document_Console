import React, { useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Project from "./pages/Project";

function App() {
  // Global identity state
  const [username, setUsername] = useState("");
  const [projectName, setProjectName] = useState("");

  // Screens
  const [screen, setScreen] = useState("login"); // login | dashboard | project
  const [projects, setProjects] = useState([]);

  // Global messages (Project page renders these; Login/Dashboard will show via toast here)
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const resetWorkspaceState = () => {
    // Pages manage their own internal state now.
    // Keep this for clearing global messages when switching screens/projects.
    setStatus("");
    setError("");
  };

  const Toast = () => {
    if (!status && !error) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          width: "min(720px, 92vw)",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #ffd2e2",
            borderRadius: 12,
            boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            {status && <div className="status" style={{ marginTop: 0 }}>{status}</div>}
            {error && <div className="error" style={{ marginTop: status ? 6 : 0 }}>{error}</div>}
          </div>

          <button
            className="btn secondary tiny"
            style={{ width: "auto", marginTop: 0 }}
            onClick={() => {
              setStatus("");
              setError("");
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  let content = null;

  if (screen === "login") {
    content = (
      <Login
        username={username}
        setUsername={setUsername}
        setScreen={setScreen}
        setProjects={setProjects}
        resetWorkspaceState={resetWorkspaceState}
        setStatus={setStatus}
        setError={setError}
      />
    );
  } else if (screen === "dashboard") {
    content = (
      <Dashboard
        username={username}
        setScreen={setScreen}
        projects={projects}
        setProjects={setProjects}
        setProjectName={setProjectName}
        resetWorkspaceState={resetWorkspaceState}
        setStatus={setStatus}
        setError={setError}
      />
    );
  } else {
    content = (
      <Project
        username={username}
        projectName={projectName}
        setScreen={setScreen}
        setProjectName={setProjectName}
        resetWorkspaceState={resetWorkspaceState}
        setStatus={setStatus}
        setError={setError}
        status={status}
        error={error}
      />
    );
  }

  return (
    <>
      <Toast />
      {content}
    </>
  );
}

export default App;
