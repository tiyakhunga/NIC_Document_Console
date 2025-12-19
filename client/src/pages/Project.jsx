import React, { useEffect, useState } from "react";

const API_BASE = "";

export default function Project({
  username,
  projectName,
  setScreen,
  setProjectName,
  resetWorkspaceState,
  setStatus,
  setError,
  status,
  error,
}) {
  const [selectedFile, setSelectedFile] = useState(null);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [markedFiles, setMarkedFiles] = useState([]);
  const [embeddedFiles, setEmbeddedFiles] = useState([]);

  const [hasUploaded, setHasUploaded] = useState(false);
  const [hasMarkers, setHasMarkers] = useState(false);

  const [loading, setLoading] = useState({
    upload: false,
    marker: false,
    embed: false,
  });

  const [operation, setOperation] = useState("");

  const [viewer, setViewer] = useState({
    open: false,
    title: "",
    content: "",
  });

  const fetchProjectState = async () => {
    const u = (username || "").trim();
    const p = (projectName || "").trim();

    if (!u || !p) {
      setError("Username & project name are required.");
      return;
    }

    try {
      const params = new URLSearchParams({ username: u, projectName: p });
      const res = await fetch(`${API_BASE}/api/files?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Failed to load project.");

      const up = data.uploadedFiles || [];
      const mk = data.markedFiles || [];
      const em = data.embeddedFiles || [];

      setUploadedFiles(up);
      setMarkedFiles(mk);
      setEmbeddedFiles(em);

      setHasUploaded(up.length > 0);
      setHasMarkers(mk.length > 0);
    } catch (e) {
      setError(e.message || "Server error! Please try again later.");
    }
  };

  useEffect(() => {
    // load when page opens
    setStatus("");
    setError("");
    setViewer({ open: false, title: "", content: "" });
    fetchProjectState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  const runOperation = async () => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    const p = (projectName || "").trim();

    if (!u || !p) return setError("Username & project name required.");
    if (!operation) return setError("Please select an operation.");

    try {
      if (operation === "upload") {
        if (!selectedFile) return setError("Please choose a file to upload.");

        setLoading((prev) => ({ ...prev, upload: true }));

        const formData = new FormData();
        formData.append("username", u);
        formData.append("projectName", p);
        formData.append("operation", "upload");
        formData.append("file", selectedFile);

        const res = await fetch(`${API_BASE}/api/submit-all`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Upload failed.");

        setStatus(data.message || "File uploaded.");
        setSelectedFile(null);
        await fetchProjectState();
      }

      if (operation === "marker") {
        setLoading((prev) => ({ ...prev, marker: true }));

        const res = await fetch(`${API_BASE}/api/submit-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, projectName: p, operation: "marker" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Marker creation failed.");

        setStatus(data.message || "Markers created.");
        await fetchProjectState();
      }

      if (operation === "embed") {
        setLoading((prev) => ({ ...prev, embed: true }));

        const res = await fetch(`${API_BASE}/api/submit-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, projectName: p, operation: "embed" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Embedding failed.");

        setStatus(data.message || "Embeddings created.");
        await fetchProjectState();
      }
    } catch (e) {
      setError(e.message || "Server error! Please try again later.");
    } finally {
      setLoading({ upload: false, marker: false, embed: false });
    }
  };

  const handleDelete = async (type, filename) => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    const p = (projectName || "").trim();

    if (!u || !p) return setError("Username & project name required.");

    try {
      const res = await fetch(`${API_BASE}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filename, username: u, projectName: p }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed.");

      setStatus("✅ Deleted.");
      await fetchProjectState();
    } catch (e) {
      setError(e.message || "Server error!");
    }
  };

  const viewArtifact = async (type, filename) => {
    setStatus("");
    setError("");

    const u = (username || "").trim();
    const p = (projectName || "").trim();
    if (!u || !p) return setError("Username & project name required.");

    try {
      const params = new URLSearchParams({ username: u, projectName: p, filename });

      let url = "";
      if (type === "upload") url = `${API_BASE}/api/view/upload?${params.toString()}`;
      if (type === "marker") url = `${API_BASE}/api/view/marker?${params.toString()}`;
      if (type === "embed") url = `${API_BASE}/api/view/embed?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to view.");

      if (type === "upload") {
        setViewer({
          open: true,
          title: `📄 Preview: ${data.filename}`,
          content: data.content || "",
        });
      } else {
        setViewer({
          open: true,
          title: `🧾 ${type.toUpperCase()} JSON: ${data.filename}`,
          content: JSON.stringify(data.json ?? data, null, 2),
        });
      }
    } catch (e) {
      setError(e.message || "Server error!");
    }
  };

  const goBack = () => {
    setStatus("");
    setError("");
    setProjectName("");
    resetWorkspaceState();
    setScreen("dashboard");
  };

  return (
    <div className="page">
      <div className="login-box">
        <div className="project-top">
          <button className="btn secondary" style={{ width: "auto" }} onClick={goBack}>
            ← Back
          </button>
          <div className="project-meta">
            <div className="subtitle" style={{ margin: 0, textAlign: "right" }}>
              User: <b>{username}</b>
            </div>
            <div className="subtitle" style={{ margin: 0, textAlign: "right" }}>
              Project: <b>{projectName}</b>
            </div>
          </div>
        </div>

        <h2 className="title">Project Console</h2>
        <p className="subtitle">Upload → Marker → Embedding</p>

        <select
          className="dropdown"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="">-- Select Operation --</option>
          <option value="upload">Upload</option>
          <option value="marker" disabled={!hasUploaded}>
            Create Marker
          </option>
          <option value="embed" disabled={!hasMarkers}>
            Create Embeddings
          </option>
        </select>

        {operation === "upload" && (
          <input
            className="file-input"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />
        )}

        <button
          className="btn"
          onClick={runOperation}
          disabled={
            (operation === "upload" && loading.upload) ||
            (operation === "marker" && loading.marker) ||
            (operation === "embed" && loading.embed)
          }
        >
          {loading.upload || loading.marker || loading.embed ? "Processing..." : "Run"}
        </button>

        {status && <p className="status">{status}</p>}
        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 8 }}>
          <button
            className="btn secondary"
            style={{ width: "auto" }}
            onClick={fetchProjectState}
          >
            Refresh Project State
          </button>
        </div>

        <div className="file-section">
          <div className="file-box">
            <h4>📂 Uploaded Files</h4>
            {uploadedFiles.length === 0 ? (
              <p className="subtitle">No uploads yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {uploadedFiles.map((f) => (
                  <li key={f} className="file-row">
                    <span className="file-name">{f}</span>
                    <div className="file-actions">
                      <button className="btn tiny" onClick={() => viewArtifact("upload", f)}>
                        View
                      </button>
                      <button className="btn tiny danger" onClick={() => handleDelete("upload", f)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="file-box">
            <h4>🧾 Marker JSONs</h4>
            {markedFiles.length === 0 ? (
              <p className="subtitle">No markers yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {markedFiles.map((f) => (
                  <li key={f} className="file-row">
                    <span className="file-name">{f}</span>
                    <div className="file-actions">
                      <button className="btn tiny" onClick={() => viewArtifact("marker", f)}>
                        View
                      </button>
                      <button className="btn tiny danger" onClick={() => handleDelete("marker", f)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="file-box">
            <h4>🧠 Embedding JSONs</h4>
            {embeddedFiles.length === 0 ? (
              <p className="subtitle">No embeddings yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {embeddedFiles.map((f) => (
                  <li key={f} className="file-row">
                    <span className="file-name">{f}</span>
                    <div className="file-actions">
                      <button className="btn tiny" onClick={() => viewArtifact("embed", f)}>
                        View
                      </button>
                      <button className="btn tiny danger" onClick={() => handleDelete("embed", f)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {viewer.open && (
          <div className="viewer">
            <div className="viewer-head">
              <div className="viewer-title">{viewer.title}</div>
              <button
                className="btn secondary tiny"
                onClick={() => setViewer({ open: false, title: "", content: "" })}
              >
                Close
              </button>
            </div>
            <pre className="viewer-pre">{viewer.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
