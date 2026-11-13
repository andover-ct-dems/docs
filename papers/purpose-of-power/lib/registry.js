// Reads the site's link registry (links/_src/<id>.yaml) and answers one
// question: which registry id stands for this source URL?
//
// The notes cite sources by their real URLs. Every such URL must have a leaf
// in the registry; the builders turn each citation into the leaf's short
// address. The registry YAML stays the single source of truth for link
// metadata, and nothing about a source is duplicated here.
//
// Leaves are simple enough (one `id:` line, one `url:` line) that two regular
// expressions read them reliably, which keeps this toolkit free of a YAML
// dependency. Lists have no `url:` and are skipped.
const fs = require("fs");
const path = require("path");

function readRegistry(dirs) {
  const byUrl = new Map();
  const found = dirs.filter((d) => fs.existsSync(d));
  if (!found.length) {
    throw new Error(`No link registry found. Looked in:\n  ${dirs.join("\n  ")}\nSet "linksSrcDirs" in build.config.json.`);
  }
  for (const dir of found) {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      const id = (text.match(/^id:\s*(\S+)\s*$/m) || [])[1];
      const url = (text.match(/^url:\s*(\S+)\s*$/m) || [])[1];
      if (!id || !url) continue;
      const clean = url.replace(/^["']|["']$/g, "");
      if (byUrl.has(clean) && byUrl.get(clean) !== id) {
        throw new Error(`Two registry leaves share one URL (${byUrl.get(clean)} and ${id}): ${clean}`);
      }
      byUrl.set(clean, id);
    }
  }
  const missing = new Set();
  return {
    size: byUrl.size,
    idFor(url) {
      const id = byUrl.get(url);
      if (!id) missing.add(url);
      return id;
    },
    // Call after rendering. Reports every uncited URL at once, the way the
    // links build reports all of its errors together.
    assertComplete() {
      if (!missing.size) return;
      throw new Error(
        `These cited URLs have no leaf in the link registry:\n  ${[...missing].join("\n  ")}\n` +
          `Add a links/_src/<id>.yaml for each (see HANDOFF.md, "Adding a source"), then rebuild.`
      );
    },
  };
}

module.exports = { readRegistry };
