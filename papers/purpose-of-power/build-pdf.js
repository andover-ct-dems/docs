// <out>/v<N.N>/<key>.docx to <key>.pdf beside it, using LibreOffice in
// headless mode.
//
// The PDFs are conversions of the Word files, so they carry the same header,
// footer, and version. After converting, this step counts each PDF's pages and
// fails if a document is longer than its "maxPages" in build.config.json.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const CANDIDATES = [
  process.env.SOFFICE,
  "soffice",
  "libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
].filter(Boolean);

const findSoffice = () =>
  CANDIDATES.find((bin) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0);

// The Word files ask for Cambria and Calibri. Linux has neither, and uses the
// metric-compatible Caladea and Carlito if they are installed. Anything else
// in a PDF means a font was missing and the layout cannot be trusted.
const FONTS = /^(Cambria|Calibri|Caladea|Carlito)/;
const strayFonts = (file) => [
  ...new Set(
    [...fs.readFileSync(file, "latin1").matchAll(/\/FontName\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)]
      .map((m) => m[1])
      .filter((name) => !FONTS.test(name))
  ),
];

// LibreOffice writes one uncompressed "/Type /Page" object per page.
const pageCount = (file) => (fs.readFileSync(file, "latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;

function convert(cfg) {
  const soffice = findSoffice();
  if (!soffice) {
    throw new Error(
      "LibreOffice not found. Install it, or set SOFFICE to the soffice binary, or pass --no-pdf."
    );
  }
  // A private profile, so a build never collides with an open LibreOffice.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "potp-lo-"));
  const profileUrl = "file:///" + profile.replace(/\\/g, "/").replace(/^\//, "");
  const tooLong = [];
  const badFonts = [];
  try {
    for (const edition of cfg.versions) {
      const inputs = cfg.documents.map((d) => path.join(edition.outDir, `${d.key}.docx`));
      const run = spawnSync(
        soffice,
        [`-env:UserInstallation=${profileUrl}`, "--headless", "--convert-to", "pdf", "--outdir", edition.outDir, ...inputs],
        { encoding: "utf8" }
      );
      const failed = inputs.map((f) => f.replace(/\.docx$/, ".pdf")).filter((f) => !fs.existsSync(f));
      if (run.status !== 0 || failed.length) {
        throw new Error(`LibreOffice did not produce: ${failed.join(", ") || "(unknown)"}\n${run.stderr || ""}`);
      }
      const counts = cfg.documents.map((d) => {
        const file = path.join(edition.outDir, `${d.key}.pdf`);
        const n = pageCount(file);
        const stray = strayFonts(file);
        if (stray.length) badFonts.push(`version ${edition.version} ${d.key}: ${stray.join(", ")}`);
        if (d.maxPages && n > d.maxPages) {
          tooLong.push(`version ${edition.version} ${d.key}: ${n} pages, limit ${d.maxPages}`);
        }
        return `${d.key} ${n}`;
      });
      console.log(`pdf: version ${edition.version} pages: ${counts.join(", ")}`);
    }
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  if (badFonts.length) {
    throw new Error(
      `Unexpected fonts in the PDFs (install Caladea and Carlito, or Cambria and Calibri):\n  ${badFonts.join("\n  ")}`
    );
  }
  if (tooLong.length) throw new Error(`Too long:\n  ${tooLong.join("\n  ")}`);
}

module.exports = { convert, pageCount };
