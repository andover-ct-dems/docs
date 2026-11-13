// Builds every version of the paper into the output folder (by default
// _site/purpose-of-power/, so run the site build first; it wipes _site/).
//
//   node build.js            Word files, PDFs, and pages
//   node build.js --no-pdf   skip the LibreOffice step
//
// Nothing is written unless every citation in every version resolves.
const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./lib/config");
const { readRegistry } = require("./lib/registry");
const docx = require("./build-docx");
const pdf = require("./build-pdf");
const html = require("./build-html");

(async () => {
  const cfg = loadConfig();
  const registry = readRegistry(cfg.linksSrcDirs);
  const withPdf = !process.argv.includes("--no-pdf");

  const wordFiles = await docx.render(cfg, registry);
  const pages = html.render(cfg, registry);
  registry.assertComplete();

  fs.rmSync(cfg.outDir, { recursive: true, force: true });
  docx.write(wordFiles);
  console.log(`docx: ${wordFiles.length} files`);

  if (withPdf) pdf.convert(cfg);
  else console.log("pdf: skipped (the pages' PDF links will not work)");

  // The current version's files, again, at the paper's main address.
  const current = cfg.versions.find((v) => v.status === "current");
  for (const d of cfg.documents) {
    for (const ext of withPdf ? ["docx", "pdf"] : ["docx"]) {
      fs.copyFileSync(path.join(current.outDir, `${d.key}.${ext}`), path.join(cfg.outDir, `${d.key}.${ext}`));
    }
  }

  html.write(pages);
  const drafts = cfg.versions.filter((v) => v.status === "draft").map((v) => v.version);
  console.log(
    `html: ${pages.length} pages. Current version ${cfg.current}; ` +
      `versions built: ${cfg.versions.map((v) => v.version).join(", ")}` +
      (drafts.length ? `; unlisted drafts: ${drafts.join(", ")}` : "")
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
