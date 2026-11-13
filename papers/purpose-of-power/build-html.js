// Markdown sources to the served pages. For each edition (every version at
// <base>/v<N.N>/, and the current version again at <base>/):
//   index.html                landing page
//   <key>/index.html          one page per document
// and one page listing the published versions, at <base>/versions/.
//
// Each page inlines lib/site.css, as the /links/ pages inline theirs. Body
// links are root-relative; only og:url and rel=canonical are absolute.
const fs = require("fs");
const path = require("path");
const { parse, tokenize, slug } = require("./lib/markdown");
const { srcPath } = require("./lib/config");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const SEP = `<span class="sep">·</span>`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Inline tokens to HTML.
//   internal link -> a plain link
//   source URL    -> the source's name, linked to its registry page; the print
//                    stylesheet spells out the short address after it
function inline(tokens, cfg, registry) {
  return tokens
    .map((t) => {
      let html = esc(t.text);
      if (t.href) {
        html = t.href.startsWith("/")
          ? `<a href="${attr(t.href)}">${html}</a>`
          : `<a class="src" href="${cfg.linksPath}/${registry.idFor(t.href)}/">${html}</a>`;
      }
      if (t.italic) html = `<em>${html}</em>`;
      if (t.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("")
    .replace(/<\/strong><strong>|<\/em><em>/g, ""); // merge adjacent runs
}

function body(blocks, cfg, registry) {
  const out = [];
  let inList = false;
  const close = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const b of blocks) {
    if (b.type === "title" || b.type === "deck") continue; // shown in the page header
    if (b.type === "li") {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`  <li>${inline(b.tokens, cfg, registry)}</li>`);
      continue;
    }
    close();
    if (b.type === "h2") out.push(`<h2 id="${slug(b.text)}">${esc(b.text)}</h2>`);
    else if (b.type === "h3") out.push(`<h3 id="${slug(b.text)}">${esc(b.text)}</h3>`);
    else out.push(`<p>${inline(b.tokens, cfg, registry)}</p>`);
  }
  close();
  return out.join("\n");
}

// The line at the top of every page that is not at the paper's main address.
function versionNote(cfg, edition) {
  if (edition.isRoot) return "";
  const home = `<a href="${cfg.basePath}/">${esc(cfg.current)}</a>`;
  const text = {
    old: `This is version ${esc(edition.version)}, kept for reference. The current version is ${home}.`,
    current: `This is the permanent address of version ${esc(edition.version)}, which is the current version.`,
    draft: `This is a draft, version ${esc(edition.version)}, and has not been published. The current version is ${home}.`,
  }[edition.status];
  return `<p class="version-note">${text}</p>\n`;
}

// Crumbs after the site's own: the paper, then the version if this is not
// the main address, then the page. `last` is the current page's label, or
// null when the edition's landing page is itself the current page.
function trailFor(cfg, edition, last) {
  if (edition.isRoot) {
    return last ? [{ label: cfg.paperTitle, href: `${cfg.basePath}/` }, { label: last }] : [{ label: cfg.paperTitle }];
  }
  const version = `Version ${edition.version}`;
  return [
    { label: cfg.paperTitle, href: `${cfg.basePath}/` },
    ...(last ? [{ label: version, href: `${edition.basePath}/` }, { label: last }] : [{ label: version }]),
  ];
}

function page(cfg, css, { base, rel, title, description, crumbs, main, noindex }) {
  const url = `${cfg.origin}${base}/${rel}`;
  const plain = (s) => tokenize(s).map((t) => t.text).join("");
  const trail = [...cfg.crumbs, ...crumbs]
    .map((c) => (c.href ? `<a href="${attr(c.href)}">${esc(c.label)}</a>` : `<span class="current">${esc(c.label)}</span>`))
    .join(`<span class="sep">›</span>`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:title" content="${attr(plain(title))}">
<meta property="og:description" content="${attr(plain(description))}">
<meta property="og:url" content="${url}">
<link rel="canonical" href="${url}">
${noindex ? `<meta name="robots" content="noindex">\n` : ""}<title>${esc(plain(title))} — ${esc(cfg.siteName)}</title>
<style>
${css}</style>
</head>
<body>
<div class="page-banner">
  <nav class="page-banner-inner crumbs">
    ${trail}
  </nav>
</div>
<div class="container">
${main}
</div>
<footer class="site-footer">
<div class="site-footer-inner"><strong>${esc(cfg.footer.org)}</strong> · <a href="${attr(cfg.footer.href)}">${esc(cfg.footer.label)}</a></div>
</footer>
</body>
</html>
`;
}

function docPage(doc, cfg, edition, css, registry) {
  const base = edition.basePath;
  const blocks = parse(fs.readFileSync(srcPath(edition, doc), "utf8"));
  const title = blocks.find((b) => b.type === "title").text;
  const deck = blocks.find((b) => b.type === "deck");
  const others = cfg.documents
    .filter((o) => o.key !== doc.key)
    .map((o) => `<a href="${base}/${o.key}/">${esc(cap(o.cardTitle))}</a>`)
    .join(SEP);
  const main = `${versionNote(cfg, edition)}<p class="section-label">${esc(doc.label)}</p>
<h1 class="report-title">${esc(title)}</h1>
${deck ? `<p class="doc-deck">${inline(deck.tokens, cfg, registry).replace(/^<em>|<\/em>$/g, "")}</p>\n` : ""}<p class="doc-meta">Version ${esc(edition.version)}${SEP}Download: <a href="${base}/${doc.key}.docx">Word</a>${SEP}<a href="${base}/${doc.key}.pdf">PDF</a></p>
<hr class="report-header-rule">
<div class="prose">
${body(blocks, cfg, registry)}
</div>
<p class="doc-nav"><a href="${base}/">← ${esc(cfg.paperTitle)}</a>${SEP}${others}</p>`;
  return page(cfg, css, {
    base,
    rel: `${doc.key}/`,
    title: doc.pageTitle || title,
    description: doc.description,
    crumbs: trailFor(cfg, edition, doc.label),
    main,
    noindex: edition.status === "draft",
  });
}

function landingPage(cfg, edition, css, registry) {
  const base = edition.basePath;
  const L = edition.landing;
  // Only the paper's main page links to the list of versions.
  const allVersions = edition.isRoot ? `${SEP}<a href="${cfg.basePath}/versions/">All versions</a>` : "";
  const md = (s) => inline(tokenize(s), cfg, registry);
  const cards = cfg.documents
    .map(
      (d) => `<div class="link-card" id="${d.key}">
  <div class="link-card-title"><a href="${base}/${d.key}/">${esc(cap(d.cardTitle))}</a></div>
  <p class="link-card-desc">${md(L.cards[d.key])}</p>
  <p class="link-card-meta"><a href="${base}/${d.key}/">Read online</a>${SEP}<a href="${base}/${d.key}.docx">Word</a>${SEP}<a href="${base}/${d.key}.pdf">PDF</a></p>
</div>`
    )
    .join("\n");
  const main = `${versionNote(cfg, edition)}<p class="section-label">${esc(L.sectionLabel)}</p>
<h1 class="report-title">${esc(cfg.paperTitle)}</h1>
<p class="report-subtitle">${md(L.subtitle)}</p>
<p class="doc-meta">${esc(L.metaOrg)}${SEP}Version ${esc(edition.version)}${SEP}${esc(L.dateLabel)}${allVersions}</p>
<hr class="report-header-rule">
<div class="prose">
${L.intro.map((p) => `<p>${md(p)}</p>`).join("\n")}
</div>
<h2 id="documents">${esc(L.documentsHeading)}</h2>
${cards}
<h2 id="sources">${esc(L.sourcesHeading)}</h2>
<div class="prose">
<p>${md(L.sources)}</p>
</div>
<h2 id="adopt">${esc(L.committeesHeading)}</h2>
<div class="prose">
<p>${md(L.committees)}</p>
</div>`;
  return page(cfg, css, {
    base,
    rel: "",
    title: cfg.paperTitle,
    description: L.description,
    crumbs: trailFor(cfg, edition, null),
    main,
    noindex: edition.status === "draft",
  });
}

// The published versions, newest first. Drafts are left out.
function versionsPage(cfg, css) {
  const cards = cfg.versions
    .filter((v) => v.status !== "draft")
    .reverse()
    .map((v) => {
      const docs = cfg.documents
        .map((d) => `<a href="${v.basePath}/${d.key}/">${esc(d.label)}</a>`)
        .join(SEP);
      const summary = v.landing.summary ? ` ${esc(v.landing.summary)}` : "";
      return `<div class="link-card" id="v${attr(v.version)}">
  <div class="link-card-title"><a href="${v.basePath}/">Version ${esc(v.version)}</a>${v.status === "current" ? " (current)" : ""}</div>
  <p class="link-card-desc">${esc(v.landing.dateLabel)}.${summary}</p>
  <p class="link-card-meta">${docs}</p>
</div>`;
    })
    .join("\n");
  const org = cfg.rootEdition.landing.metaOrg;
  const main = `<p class="section-label">Versions</p>
<h1 class="report-title">${esc(cfg.paperTitle)}</h1>
<p class="doc-meta">${esc(org)}</p>
<hr class="report-header-rule">
<div class="prose">
<p>Every published version of this paper stays online at its own address. The <a href="${cfg.basePath}/">main page</a> always shows the current one.</p>
</div>
${cards}`;
  return page(cfg, css, {
    base: cfg.basePath,
    rel: "versions/",
    title: `${cfg.paperTitle}: Versions`,
    description: `Every published version of "${cfg.paperTitle}," a position paper of the ${org}.`,
    crumbs: [{ label: cfg.paperTitle, href: `${cfg.basePath}/` }, { label: "Versions" }],
    main,
  });
}

// Renders every page in memory: [[file, html], ...].
function render(cfg, registry) {
  const css = fs.readFileSync(path.join(cfg.root, "lib", "site.css"), "utf8").replace("__HOST__", cfg.host);
  const pages = [];
  for (const edition of [cfg.rootEdition, ...cfg.versions]) {
    pages.push([path.join(edition.outDir, "index.html"), landingPage(cfg, edition, css, registry)]);
    for (const d of cfg.documents) {
      pages.push([path.join(edition.outDir, d.key, "index.html"), docPage(d, cfg, edition, css, registry)]);
    }
  }
  pages.push([path.join(cfg.outDir, "versions", "index.html"), versionsPage(cfg, css)]);
  return pages;
}

function write(pages) {
  for (const [file, html] of pages) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
}

module.exports = { render, write };
