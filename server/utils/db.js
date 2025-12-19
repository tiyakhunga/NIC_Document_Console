// server/utils/db.js
// Local JSON "DB" helpers for Users + Projects
// - Auto-creates db.json and parent folders
// - Migrates uploads.json -> db.json (so old data appears on dashboard)
// - Atomic writes (tmp + rename)

const fs = require("fs");
const path = require("path");

// ------------------------------
// Paths
// ------------------------------
function getDbPaths() {
  const serverRoot = path.join(__dirname, ".."); // server/
  return {
    dbPath: process.env.DB_JSON_PATH || path.join(serverRoot, "db.json"),
    uploadsPath:
      process.env.UPLOADS_JSON_PATH || path.join(serverRoot, "uploads.json"),
  };
}

// ------------------------------
// Small safety helpers
// ------------------------------
function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath, data) {
  ensureDirForFile(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

// ------------------------------
// Data model helpers
// ------------------------------
function ensureUser(db, username) {
  db.users ||= {};
  if (!db.users[username]) {
    db.users[username] = {
      createdAt: new Date().toISOString(),
      projects: {},
    };
  }
}

function ensureProject(db, username, projectName) {
  ensureUser(db, username);
  db.users[username].projects ||= {};
  if (!db.users[username].projects[projectName]) {
    db.users[username].projects[projectName] = {
      createdAt: new Date().toISOString(),
    };
  }
}

function userExists(db, username) {
  return !!db?.users?.[username];
}

function listProjects(db, username) {
  const projects = db?.users?.[username]?.projects || {};
  return Object.keys(projects).sort();
}

// ------------------------------
// Migration: uploads.json -> db.json
// ------------------------------
function migrateUploadsIntoDB(db, uploadsPath) {
  const uploads = readJsonFile(uploadsPath, []);
  if (!Array.isArray(uploads)) return;

  for (const rec of uploads) {
    if (!rec?.username || !rec?.projectName) continue;
    ensureProject(db, String(rec.username).trim(), String(rec.projectName).trim());
  }
}

// ------------------------------
// Public API
// ------------------------------
function readDB({ migrate = true } = {}) {
  const { dbPath, uploadsPath } = getDbPaths();
  const db = readJsonFile(dbPath, { users: {} });

  if (migrate) migrateUploadsIntoDB(db, uploadsPath);

  // Ensure the file exists on disk (so later reads are consistent)
  writeJsonFileAtomic(dbPath, db);
  return db;
}

function writeDB(db) {
  const { dbPath } = getDbPaths();
  writeJsonFileAtomic(dbPath, db);
}

function createUser(username) {
  const u = String(username || "").trim();
  if (!u) throw new Error("Missing username.");

  const db = readDB();
  ensureUser(db, u);
  writeDB(db);

  return { username: u };
}

function createProject(username, projectName) {
  const u = String(username || "").trim();
  const p = String(projectName || "").trim();
  if (!u || !p) throw new Error("Missing username/projectName.");

  const db = readDB();
  ensureProject(db, u, p);
  writeDB(db);

  return { username: u, projectName: p };
}

module.exports = {
  getDbPaths,
  readDB,
  writeDB,
  ensureUser,
  ensureProject,
  userExists,
  listProjects,
  createUser,
  createProject,
};
