// server/utils/extract.js
// Build/return cached extracted text/markdown in outputs/<uploadFilename>.md
// Supports: PDF, CSV, XLSX/XLS

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const xlsx = require("xlsx");
const csv = require("csv-parser");

// --- CSV → Markdown table
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
          (r) => `| ${keys.map((k) => String(r[k] ?? "")).join(" | ")} |`
        );

        resolve([header, divider, ...rows].join("\n"));
      })
      .on("error", reject);
  });

// --- Excel → Markdown table (first sheet)
const excelToMarkdown = (filePath) => {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  if (!json.length) return "";

  const keys = Object.keys(json[0]);
  const header = `| ${keys.join(" | ")} |`;
  const divider = `| ${keys.map(() => "---").join(" | ")} |`;
  const rows = json.map((r) => `| ${keys.map((k) => String(r[k] ?? "")).join(" | ")} |`);
  return [header, divider, ...rows].join("\n");
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Ensure output markdown exists for an upload filename.
 *
 * @param {Object} args
 * @param {string} args.uploadFilename - filename stored in uploads/
 * @param {string} args.uploadDir - path to uploads directory
 * @param {string} args.outputDir - path to outputs directory
 * @returns {Promise<{ mdPath: string, md: string }>}
 */
async function ensureOutputMarkdown({ uploadFilename, uploadDir, outputDir }) {
  ensureDir(outputDir);

  const ext = path.extname(uploadFilename).toLowerCase();
  const inputPath = path.join(uploadDir, uploadFilename);

  if (!fs.existsSync(inputPath)) {
    const err = new Error("Upload file not found.");
    err.statusCode = 404;
    throw err;
  }

  const mdName = `${uploadFilename}.md`;
  const mdPath = path.join(outputDir, mdName);

  // cache hit
  if (fs.existsSync(mdPath)) {
    return { mdPath, md: fs.readFileSync(mdPath, "utf-8") };
  }

  // build markdown/text
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
}

module.exports = {
  ensureOutputMarkdown,
  csvToMarkdown,
  excelToMarkdown,
};
