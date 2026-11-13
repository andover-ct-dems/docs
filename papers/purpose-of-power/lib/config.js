// Loads build.config.json, finds the version folders, and works out the
// "editions" to build.
//
// Every folder versions/<N.N>/ is built at <basePath>/v<N.N>/, its permanent
// address. The version named by "current" is also built at <basePath>/ itself.
// A version newer than "current" is a draft: it is built, so it can be
// reviewed at its address, but nothing links to it and it asks search engines
// not to index it.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOC_FILES = ["landing.json"];

const compareVersions = (a, b) => {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
};

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "build.config.json"), "utf8"));
  const abs = (p) => path.resolve(ROOT, p);
  const versionsDir = abs(cfg.versionsDir);
  const outDir = abs(cfg.outDir);

  const names = fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+$/.test(e.name))
    .map((e) => e.name)
    .sort(compareVersions);
  if (!names.includes(cfg.current)) {
    throw new Error(`"current" is ${cfg.current}, but there is no ${path.join(cfg.versionsDir, cfg.current)} folder.`);
  }

  const problems = [];
  const versions = names.map((version) => {
    const srcDir = path.join(versionsDir, version);
    for (const f of [...DOC_FILES, ...cfg.documents.map((d) => `${d.key}.md`)]) {
      if (!fs.existsSync(path.join(srcDir, f))) problems.push(`versions/${version}/${f} is missing`);
    }
    const order = compareVersions(version, cfg.current);
    return {
      version,
      srcDir,
      status: order < 0 ? "old" : order > 0 ? "draft" : "current",
      isRoot: false,
      basePath: `${cfg.basePath}/v${version}`,
      outDir: path.join(outDir, `v${version}`),
    };
  });
  if (problems.length) throw new Error(problems.join("\n"));
  for (const v of versions) {
    v.landing = JSON.parse(fs.readFileSync(path.join(v.srcDir, "landing.json"), "utf8"));
  }

  const current = versions.find((v) => v.status === "current");
  return {
    ...cfg,
    root: ROOT,
    host: cfg.origin.replace(/^https?:\/\//, ""),
    outDir,
    linksSrcDirs: cfg.linksSrcDirs.map(abs),
    versions,
    // The current version again, at the paper's main address.
    rootEdition: { ...current, isRoot: true, basePath: cfg.basePath, outDir },
  };
}

const srcPath = (edition, doc) => path.join(edition.srcDir, `${doc.key}.md`);

module.exports = { loadConfig, srcPath, compareVersions, ROOT };
