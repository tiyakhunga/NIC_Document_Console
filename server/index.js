// Steps: UPLOAD → MARKER → EMBED
// + User Dashboard + Project Registry (db.json)
// + View endpoints + Cascade delete
// + Local embeddings (Transformers.js if installed; deterministic fallback otherwise)

process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT ERROR:", err);
});

const { getEmbeddingVector } = require("./utils/embed");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const xlsx = require("xlsx");
const csv = require("csv-parser");
require("dotenv").config();


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 📁 Directories
const uploadDir = path.join(__dirname, "uploads");
const markerDir = path.join(__dirname, "markers");
const embedDir = path.join(__dirname, "embeds");
const outputDir = path.join(__dirname, "outputs"); // cached extracted text/markdown
const uploadsJsonPath =
  process.env.UPLOADS_JSON_PATH || path.join(__dirname, "uploads.json");

const dbJsonPath =
  process.env.DB_JSON_PATH || path.join(__dirname, "db.json");

const ensureDirForFile = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// ensure dirs exist
[uploadDir, markerDir, embedDir, outputDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ------------------------------
// Helpers: safe segments (avoid path traversal via username/projectName)
// ------------------------------
const isSafeSegment = (s) =>
  typeof s === "string" &&
  s.length > 0 &&
  !s.includes("..") &&
  !s.includes("/") &&
  !s.includes("\\") &&
  !s.includes("\0");

const assertSafeSegments = (username, projectName) => {
  if (!isSafeSegment(username) || !isSafeSegment(projectName)) {
    const err = new Error("Invalid username/projectName.");
    err.statusCode = 400;
    throw err;
  }
};

// ------------------------------
// JSON helpers (atomic write)
// ------------------------------
const readJsonFile = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJsonFileAtomic = (filePath, data) => {
  ensureDirForFile(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
};

// ------------------------------
// Upload records (existing)
// ------------------------------
const saveUploadRecord = (username, projectName, filename) => {
  const records = readJsonFile(uploadsJsonPath, []);
  records.push({ username, projectName, filename });
  writeJsonFileAtomic(uploadsJsonPath, records);
};

// ------------------------------
// db.json (new): users + projects registry
// ------------------------------
const ensureUser = (db, username) => {
  db.users ||= {};
  if (!db.users[username]) {
    db.users[username] = { createdAt: new Date().toISOString(), projects: {} };
  }
};

const ensureProject = (db, username, projectName) => {
  ensureUser(db, username);
  db.users[username].projects ||= {};
  if (!db.users[username].projects[projectName]) {
    db.users[username].projects[projectName] = {
      createdAt: new Date().toISOString(),
    };
  }
};

const migrateUploadsIntoDB = (db) => {
  const uploads = readJsonFile(uploadsJsonPath, []);
  for (const r of uploads) {
    if (!r?.username || !r?.projectName) continue;
    ensureProject(db, r.username, r.projectName);
  }
};

const readDB = () => {
  const db = readJsonFile(dbJsonPath, { users: {} });
  // one-way migration from uploads.json so older data shows up on dashboard
  migrateUploadsIntoDB(db);
  // ensure file exists
  writeJsonFileAtomic(dbJsonPath, db);
  return db;
};

const writeDB = (db) => writeJsonFileAtomic(dbJsonPath, db);

const listProjects = (db, username) => {
  const u = db?.users?.[username];
  if (!u?.projects) return [];
  return Object.keys(u.projects).sort();
};

// ------------------------------
// CSV → Markdown (unchanged)
// ------------------------------
const csvToMarkdown = (filePath) =>
  new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (d) => results.push(d))
      .on("end", () => {
        if (!results.length) return resolve("");
        const keys = Object.keys(results[0]);
        const header = `| ${keys.join(" | ")} |`;
        const divider = `| ${keys.map(() => "---").join(" | ")} |`;
        const rows = results.map(
          (r) => `| ${keys.map((k) => r[k]).join(" | ")} |`
        );
        resolve([header, divider, ...rows].join("\n"));
      })
      .on("error", reject);
  });

// Excel → Markdown (unchanged)
const excelToMarkdown = (filePath) => {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  if (!json.length) return "";
  const keys = Object.keys(json[0]);
  const header = `| ${keys.join(" | ")} |`;
  const divider = `| ${keys.map(() => "---").join(" | ")} |`;
  const rows = json.map((r) => `| ${keys.map((k) => r[k]).join(" | ")} |`);
  return [header, divider, ...rows].join("\n");
};

// ------------------------------
// Multer storage
// ------------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeUser = (req.body.username || "").trim();
    const safeProj = (req.body.projectName || "").trim();
    const uniqueName = `${Date.now()}_${safeUser}_${safeProj}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ------------------------------
// Extraction helper: get or build outputs/<uploadFilename>.md
// ------------------------------
const ensureOutputMarkdown = async (uploadFilename) => {
  const ext = path.extname(uploadFilename).toLowerCase();
  const inputPath = path.join(uploadDir, uploadFilename);
  const mdName = `${uploadFilename}.md`;
  const mdPath = path.join(outputDir, mdName);

  if (!fs.existsSync(inputPath)) {
    const err = new Error("Upload file not found.");
    err.statusCode = 404;
    throw err;
  }

  if (fs.existsSync(mdPath)) {
    return { mdPath, md: fs.readFileSync(mdPath, "utf-8") };
  }

  let md = "";
  if (ext === ".pdf") {
    const data = await pdfParse(fs.readFileSync(inputPath));
    md = data.text || "";
  } else if (ext === ".csv") {
    md = await csvToMarkdown(inputPath);
  } else if (ext === ".xlsx" || ext === ".xls") {
    md = excelToMarkdown(inputPath);
  } else {
    md = "Unsupported file type for preview.";
  }

  fs.writeFileSync(mdPath, md);
  return { mdPath, md };
};

// ------------------------------
// Embeddings: Transformers.js (if installed) else deterministic fallback
// ------------------------------

// 🏠 Default route
app.get("/", (req, res) => {
  res.send("✨ Backend for NIC Document Console is running!");
});

// --------------------------------------------------------------
// USER + PROJECT REGISTRY (Dashboard support)
// --------------------------------------------------------------
app.get("/api/user", (req, res) => {
  const username = (req.query.username || "").trim();
  if (!username) return res.status(400).json({ error: "Missing username." });

  const db = readDB();
  const exists = !!db.users?.[username];
  const projects = exists ? listProjects(db, username) : [];
  return res.json({ exists, projects });
});

app.post("/api/user", (req, res) => {
  const username = (req.body.username || "").trim();
  if (!username) return res.status(400).json({ error: "Missing username." });

  const db = readDB();
  ensureUser(db, username);
  writeDB(db);
  return res.json({ message: "✅ User created.", username });
});

app.post("/api/project", (req, res) => {
  const username = (req.body.username || "").trim();
  const projectName = (req.body.projectName || "").trim();
  if (!username || !projectName)
    return res.status(400).json({ error: "Missing username/projectName." });

  try {
    assertSafeSegments(username, projectName);
    const db = readDB();
    ensureProject(db, username, projectName);
    writeDB(db);
    return res.json({ message: "✅ Project created.", projectName });
  } catch (e) {
    return res
      .status(e.statusCode || 500)
      .json({ error: e.message || "Server error" });
  }
});

// --------------------------------------------------------------
// MAIN PIPELINE ENDPOINT – upload | marker | embed
// --------------------------------------------------------------
app.post("/api/submit-all", upload.single("file"), async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const projectName = (req.body.projectName || "").trim();
    const operation = (req.body.operation || "").trim();

    if (!username || !projectName || !operation) {
      return res.status(400).json({ error: "Missing fields." });
    }

    assertSafeSegments(username, projectName);

    console.log("📥", operation.toUpperCase(), "→", username, "/", projectName);

    // 1️⃣ UPLOAD
    if (operation === "upload") {
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });

      saveUploadRecord(username, projectName, req.file.filename);

      const db = readDB();
      ensureProject(db, username, projectName);
      writeDB(db);

      return res.json({
        message: "✅ File uploaded successfully.",
        filename: req.file.filename,
      });
    }

    // 2️⃣ MARKER
    if (operation === "marker") {
      const uploaded = fs
        .readdirSync(uploadDir)
        .filter((f) => f.includes(`${username}_${projectName}`));

      if (!uploaded.length)
        return res.status(404).json({ error: "No uploaded files found." });

      const userMarkerDir = path.join(markerDir, username, projectName);
      if (!fs.existsSync(userMarkerDir))
        fs.mkdirSync(userMarkerDir, { recursive: true });

      const db = readDB();
      ensureProject(db, username, projectName);
      writeDB(db);

      const summary = [];

      for (const file of uploaded) {
        const ext = path.extname(file).toLowerCase();
        if (![".pdf", ".csv", ".xlsx", ".xls"].includes(ext)) continue;

        const { md } = await ensureOutputMarkdown(file);

        const lines = md
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 20)
          .slice(0, 10);

        const markers = lines.map((line, idx) => ({
          field: `Field_${idx + 1}`,
          value: line,
        }));

        const markerName = file.replace(ext, "_markers.json");
        const markerPath = path.join(userMarkerDir, markerName);

        fs.writeFileSync(markerPath, JSON.stringify(markers, null, 2));

        summary.push({ file, markerFile: markerName, fields: markers.length });
      }

      return res.json({ message: "✅ Marker files created.", summary });
    }

    // 3️⃣ EMBED
    if (operation === "embed") {
      const mDir = path.join(markerDir, username, projectName);
      if (!fs.existsSync(mDir))
        return res.status(404).json({ error: "No marker directory." });

      const files = fs
        .readdirSync(mDir)
        .filter((f) => f.endsWith("_markers.json"));

      if (!files.length)
        return res.status(404).json({ error: "No marker JSONs found." });

      const outDir = path.join(embedDir, username, projectName);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const db = readDB();
      ensureProject(db, username, projectName);
      writeDB(db);

      const summary = [];

      for (const file of files) {
        const markerPath = path.join(mDir, file);
        const markers = JSON.parse(fs.readFileSync(markerPath, "utf-8"));

        const embedded = [];
        let skipped = 0;

        for (const item of markers) {
          const text = String(item?.value || "").trim();
          if (text.length < 5) {
            skipped++;
            continue;
          }

          const vec = await getEmbeddingVector(text);
          embedded.push({ field: item.field, text, embedding: vec });
        }

        const outFile = file.replace("_markers.json", "_embedding.json");
        const outPath = path.join(outDir, outFile);
        fs.writeFileSync(outPath, JSON.stringify(embedded, null, 2));

        summary.push({ file, embeddedCount: embedded.length, skipped });
      }

      return res.json({ message: "✅ Embeddings created.", summary });
    }

    return res.json({ message: "Unknown operation" });
  } catch (err) {
    console.error("🔥 BACKEND ERR:", err);
    res
      .status(err.statusCode || 500)
      .json({ error: "Server error", details: err.message });
  }
});

// --------------------------------------------------------------
// LIST FILES (for frontend flags)
// --------------------------------------------------------------
app.get("/api/files", (req, res) => {
  const username = (req.query.username || "").trim();
  const projectName = (req.query.projectName || "").trim();

  if (!username || !projectName)
    return res.status(400).json({ error: "Missing fields" });

  try {
    assertSafeSegments(username, projectName);
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || "Server error" });
  }

  let uploadedFiles = [];
  if (fs.existsSync(uploadsJsonPath)) {
    const all = readJsonFile(uploadsJsonPath, []);
    uploadedFiles = all
      .filter((x) => x.username === username && x.projectName === projectName)
      .map((x) => x.filename);
  }

  let markedFiles = [];
  const mDir = path.join(markerDir, username, projectName);
  if (fs.existsSync(mDir)) {
    markedFiles = fs.readdirSync(mDir).filter((f) => f.endsWith("_markers.json"));
  }

  let embeddedFiles = [];
  const eDir = path.join(embedDir, username, projectName);
  if (fs.existsSync(eDir)) {
    embeddedFiles = fs.readdirSync(eDir).filter((f) => f.endsWith("_embedding.json"));
  }

  return res.json({ uploadedFiles, markedFiles, embeddedFiles });
});

// --------------------------------------------------------------
// VIEW ENDPOINTS (for swimlane viewer)
// --------------------------------------------------------------
app.get("/api/view/upload", async (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    const projectName = (req.query.projectName || "").trim();
    const filename = path.basename(req.query.filename || "");

    if (!username || !projectName || !filename)
      return res.status(400).json({ error: "Missing fields" });

    assertSafeSegments(username, projectName);

    if (!filename.includes(`${username}_${projectName}`)) {
      return res.status(403).json({ error: "File does not belong to this project." });
    }

    const { md } = await ensureOutputMarkdown(filename);
    return res.json({ filename, contentType: "text/plain", content: md });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || "Server error" });
  }
});

app.get("/api/view/marker", (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    const projectName = (req.query.projectName || "").trim();
    const filename = path.basename(req.query.filename || "");

    if (!username || !projectName || !filename)
      return res.status(400).json({ error: "Missing fields" });

    assertSafeSegments(username, projectName);

    const p = path.join(markerDir, username, projectName, filename);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Marker file not found." });

    const json = readJsonFile(p, null);
    return res.json({ filename, json });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || "Server error" });
  }
});

app.get("/api/view/embed", (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    const projectName = (req.query.projectName || "").trim();
    const filename = path.basename(req.query.filename || "");

    if (!username || !projectName || !filename)
      return res.status(400).json({ error: "Missing fields" });

    assertSafeSegments(username, projectName);

    const p = path.join(embedDir, username, projectName, filename);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Embedding file not found." });

    const json = readJsonFile(p, null);
    return res.json({ filename, json });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || "Server error" });
  }
});

// --------------------------------------------------------------
// DELETE (cascade)
// --------------------------------------------------------------
app.delete("/api/delete", (req, res) => {
  const username = (req.body.username || "").trim();
  const projectName = (req.body.projectName || "").trim();
  const type = (req.body.type || "").trim();
  const filename = path.basename(req.body.filename || "");

  if (!username || !projectName || !type || !filename)
    return res.status(400).json({ error: "Missing fields" });

  try {
    assertSafeSegments(username, projectName);
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || "Server error" });
  }

  const delIfExists = (p) => {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  };

  try {
    let target = null;
    if (type === "upload") target = path.join(uploadDir, filename);
    if (type === "marker") target = path.join(markerDir, username, projectName, filename);
    if (type === "embed") target = path.join(embedDir, username, projectName, filename);

    if (!target) return res.status(400).json({ error: "Invalid type." });
    if (!fs.existsSync(target)) return res.status(404).json({ error: "File not found." });

    fs.unlinkSync(target);

    // CASCADE
    if (type === "upload") {
      const ext = path.extname(filename);
      const base = ext ? filename.slice(0, -ext.length) : filename;

      const markerName = `${base}_markers.json`;
      const embedName = `${base}_embedding.json`;
      const mdName = `${filename}.md`;

      delIfExists(path.join(markerDir, username, projectName, markerName));
      delIfExists(path.join(embedDir, username, projectName, embedName));
      delIfExists(path.join(outputDir, mdName));

      if (fs.existsSync(uploadsJsonPath)) {
        const all = readJsonFile(uploadsJsonPath, []);
        const filtered = all.filter(
          (x) =>
            !(
              x.username === username &&
              x.projectName === projectName &&
              x.filename === filename
            )
        );
        writeJsonFileAtomic(uploadsJsonPath, filtered);
      }
    }

    if (type === "marker") {
      const base = filename.replace(/_markers\.json$/i, "");
      const embedName = `${base}_embedding.json`;
      delIfExists(path.join(embedDir, username, projectName, embedName));
    }

    return res.json({ message: "Deleted successfully." });
  } catch (err) {
    console.error("DELETE ERR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`💖 Backend running at http://localhost:${PORT}`);
});
