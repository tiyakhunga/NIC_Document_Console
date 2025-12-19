// server/utils/files.js
// Path safety + cascade deletion helpers + artifact filename helpers

const fs = require("fs");
const path = require("path");

// ------------------------------
// Safety helpers (username/projectName should be safe segments)
// ------------------------------
function isSafeSegment(s) {
    return (
        typeof s === "string" &&
        s.length > 0 &&
        !s.includes("..") &&
        !s.includes("/") &&
        !s.includes("\\") &&
        !s.includes("\0")
    );
}

function assertSafeSegments(username, projectName) {
    if (!isSafeSegment(username) || !isSafeSegment(projectName)) {
        const err = new Error("Invalid username/projectName.");
        err.statusCode = 400;
        throw err;
    }
}

function safeBasename(filename) {
    return path.basename(String(filename || ""));
}

// ------------------------------
// Project folder paths
// ------------------------------
function getProjectPaths({ serverRoot, username, projectName }) {
    // serverRoot = __dirname/.. (server/)
    const uploadDir = path.join(serverRoot, "uploads");
    const markerDir = path.join(serverRoot, "markers", username, projectName);
    const embedDir = path.join(serverRoot, "embeds", username, projectName);
    const outputDir = path.join(serverRoot, "outputs");
    return { uploadDir, markerDir, embedDir, outputDir };
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ------------------------------
// Artifact name helpers
// ------------------------------
function splitUploadFilename(uploadFilename) {
    const f = safeBasename(uploadFilename);
    const ext = path.extname(f);
    const base = ext ? f.slice(0, -ext.length) : f;
    return { base, ext, filename: f };
}

function markerNameFromUpload(uploadFilename) {
    const { base } = splitUploadFilename(uploadFilename);
    return `${base}_markers.json`;
}

function embedNameFromUpload(uploadFilename) {
    const { base } = splitUploadFilename(uploadFilename);
    return `${base}_embedding.json`;
}

function outputMdNameFromUpload(uploadFilename) {
    const f = safeBasename(uploadFilename);
    return `${f}.md`;
}

function embedNameFromMarker(markerFilename) {
    const f = safeBasename(markerFilename);
    const base = f.replace(/_markers\.json$/i, "");
    return `${base}_embedding.json`;
}

// ------------------------------
// Ownership checks (lightweight)
// ------------------------------
function uploadBelongsToProject({ username, projectName, uploadFilename }) {
    const f = safeBasename(uploadFilename);
    // your upload naming pattern includes `${username}_${projectName}`
    return f.includes(`${username}_${projectName}`);
}

// ------------------------------
// Delete helpers
// ------------------------------
function deleteIfExists(p) {
    try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
        // ignore
    }
}

/**
 * Cascade delete upload:
 * - uploads/<file>
 * - markers/<u>/<p>/<base>_markers.json
 * - embeds/<u>/<p>/<base>_embedding.json
 * - outputs/<file>.md
 */
function deleteUploadCascade({ serverRoot, username, projectName, uploadFilename }) {
    assertSafeSegments(username, projectName);

    const { uploadDir, markerDir, embedDir, outputDir } = getProjectPaths({
        serverRoot,
        username,
        projectName,
    });

    const filename = safeBasename(uploadFilename);

    // upload file
    deleteIfExists(path.join(uploadDir, filename));

    // marker + embed derived from upload base
    deleteIfExists(path.join(markerDir, markerNameFromUpload(filename)));
    deleteIfExists(path.join(embedDir, embedNameFromUpload(filename)));

    // cached output markdown
    deleteIfExists(path.join(outputDir, outputMdNameFromUpload(filename)));
}

/**
 * Cascade delete marker:
 * - markers/<u>/<p>/<markerFile>
 * - embeds/<u>/<p>/<matching embed file>
 */
function deleteMarkerCascade({ serverRoot, username, projectName, markerFilename }) {
    assertSafeSegments(username, projectName);

    const { markerDir, embedDir } = getProjectPaths({
        serverRoot,
        username,
        projectName,
    });

    const file = safeBasename(markerFilename);

    deleteIfExists(path.join(markerDir, file));
    deleteIfExists(path.join(embedDir, embedNameFromMarker(file)));
}

/**
 * Delete embed only:
 * - embeds/<u>/<p>/<embedFile>
 */
function deleteEmbedOnly({ serverRoot, username, projectName, embedFilename }) {
    assertSafeSegments(username, projectName);

    const { embedDir } = getProjectPaths({
        serverRoot,
        username,
        projectName,
    });

    const file = safeBasename(embedFilename);
    deleteIfExists(path.join(embedDir, file));
}

module.exports = {
    isSafeSegment,
    assertSafeSegments,
    safeBasename,

    getProjectPaths,
    ensureDir,

    splitUploadFilename,
    markerNameFromUpload,
    embedNameFromUpload,
    outputMdNameFromUpload,
    embedNameFromMarker,

    uploadBelongsToProject,

    deleteIfExists,
    deleteUploadCascade,
    deleteMarkerCascade,
    deleteEmbedOnly,
};
