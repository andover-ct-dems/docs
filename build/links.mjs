/*
 * Link-registry builder.
 *
 * Renders the hand-authored YAML docs under links/src/ into static pages at
 * <out>/links/<id>/index.html plus <out>/links/index.html listing every
 * collection. Lifted from andoverct.info's _build/links.mjs.
 *
 * Two doc shapes, distinguished by their keys:
 *   leaf  — { id, title, description, url, image?, date?, archived? }
 *   list  — { id, title, description, image?, groups | links }
 * where groups is an ordered array of { title, description?, links } and a
 * top-level links array is an untitled single group. Link arrays reference
 * other docs by id (= filename stem).
 *
 * Lists never nest: a reference to another list renders as a plain link card
 * pointing at that list's own page, which structurally rules out recursion.
 * Every referenced doc must exist; any validation failure is a build error,
 * and all errors across all files are reported before the build stops.
 *
 * A url or image beginning with "/" is a file on this site (something under
 * static/, e.g. /purpose-of-power/resolution.pdf). Body hrefs stay
 * root-relative; only og:url / og:image / rel=canonical are absolutized.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { load as parseYaml } from "js-yaml"
import { escapeHtml, ogHead, pageShell } from "./chrome.mjs"

const ID_RE = /^[A-Za-z0-9_-]+$/
const URL_RE = /^(https?:\/\/|\/)/ // external or root-relative internal
const EXT_RE = /^https?:\/\//

// ---------------------------------------------------------------------------
// Load + validate sources
// ---------------------------------------------------------------------------

// Structural validation of one parsed YAML doc. Returns error strings; an
// empty array means the doc is safe to normalize.
const validateDoc = (raw, stem, rel) => {
  const errs = []
  const err = (m) => errs.push(`${rel}: ${m}`)

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    err("document must be a YAML mapping")
    return errs
  }
  if (raw.id === undefined) err(`missing "id"`)
  else if (String(raw.id) !== stem) err(`id "${raw.id}" does not match filename`)

  const shapeKeys = ["url", "groups", "links"].filter((k) => raw[k] !== undefined)
  if (shapeKeys.length !== 1) {
    err(
      `must be a leaf ("url") or a list ("groups" or "links"); found: ` +
        (shapeKeys.join(", ") || "none")
    )
    return errs
  }
  const kind = shapeKeys[0] === "url" ? "leaf" : "list"

  const allowed =
    kind === "leaf"
      ? ["id", "title", "description", "url", "image", "date", "archived"]
      : ["id", "title", "description", "image", "groups", "links"]
  Object.keys(raw)
    .filter((k) => !allowed.includes(k))
    .forEach((k) => err(`unknown key "${k}"`))

  const nonEmptyString = (v) => typeof v === "string" && v.trim() !== ""
  if (!nonEmptyString(raw.title)) err(`"title" must be a non-empty string`)
  if (!nonEmptyString(raw.description)) err(`"description" must be a non-empty string`)
  if (raw.image !== undefined && !(typeof raw.image === "string" && URL_RE.test(raw.image)))
    err(`"image" must start with "/" or "http(s)://"`)

  if (kind === "leaf") {
    if (!(typeof raw.url === "string" && URL_RE.test(raw.url)))
      err(`"url" must start with "/" (internal) or "http(s)://" (external)`)
    if (
      raw.archived !== undefined &&
      !(typeof raw.archived === "string" && EXT_RE.test(raw.archived))
    )
      err(`"archived" must be an http(s) URL`)
    if (raw.date !== undefined) {
      // js-yaml parses a bare YYYY-MM-DD into a JS Date; accept either form.
      const ok =
        raw.date instanceof Date
          ? !isNaN(raw.date)
          : typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      if (!ok) err(`"date" must be YYYY-MM-DD`)
    }
    return errs
  }

  const checkLinks = (arr, where) =>
    !Array.isArray(arr) || arr.length === 0
      ? err(`${where} must be a non-empty array of ids`)
      : arr
          .filter((x) => !ID_RE.test(String(x)))
          .forEach((x) => err(`${where} contains invalid id "${x}"`))

  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups) || raw.groups.length === 0) {
      err(`"groups" must be a non-empty array`)
      return errs
    }
    raw.groups.forEach((g, i) => {
      const where = `groups[${i}]`
      if (!g || typeof g !== "object" || Array.isArray(g)) {
        err(`${where} must be a mapping`)
        return
      }
      Object.keys(g)
        .filter((k) => !["title", "description", "links"].includes(k))
        .forEach((k) => err(`${where}: unknown key "${k}"`))
      if (!nonEmptyString(g.title)) err(`${where}: "title" must be a non-empty string`)
      if (g.description !== undefined && !nonEmptyString(g.description))
        err(`${where}: "description" must be a non-empty string`)
      checkLinks(g.links, `${where}.links`)
    })
  } else {
    checkLinks(raw.links, `"links"`)
  }
  return errs
}

// A validated doc, reshaped for rendering: ids stringified, dates formatted,
// and an ungrouped links array folded into a single untitled group.
const normalizeDoc = (raw, stem) => {
  const kind = raw.url !== undefined ? "leaf" : "list"
  return {
    id: stem,
    kind,
    title: raw.title.trim(),
    description: raw.description.trim(),
    ...(raw.image && { image: raw.image }),
    ...(kind === "leaf"
      ? {
          url: raw.url,
          ...(raw.archived && { archived: raw.archived }),
          ...(raw.date !== undefined && {
            date: raw.date instanceof Date ? raw.date.toISOString().slice(0, 10) : raw.date,
          }),
        }
      : {
          groups: raw.groups
            ? raw.groups.map((g) => ({
                title: g.title.trim(),
                description: g.description ? g.description.trim() : undefined,
                links: g.links.map(String),
              }))
            : [{ links: raw.links.map(String) }],
        }),
  }
}

// Reads every <dir>/*.yaml into a Map<id, doc>, collecting all problems (bad
// filename, parse failure, schema violation, dangling reference) so the whole
// batch is reported at once. `label` names the directory in error messages.
const loadDocs = (dir, label) => {
  if (!existsSync(dir)) throw new Error(`source directory not found: ${dir}`)
  const errors = []
  const docs = new Map()
  readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .forEach((file) => {
      const rel = `${label}/${file}`
      const stem = file.slice(0, -".yaml".length)
      if (!ID_RE.test(stem)) {
        errors.push(`${rel}: filename id "${stem}" must be letters/digits/_/- only`)
        return
      }
      let raw
      try {
        raw = parseYaml(readFileSync(join(dir, file), "utf8"))
      } catch (e) {
        errors.push(`${rel}: YAML parse error: ${e.message}`)
        return
      }
      const errs = validateDoc(raw, stem, rel)
      if (errs.length) {
        errors.push(...errs)
        return
      }
      docs.set(stem, normalizeDoc(raw, stem))
    })
  ;[...docs.values()]
    .filter((doc) => doc.kind === "list")
    .forEach((doc) =>
      doc.groups
        .flatMap((g) => g.links)
        .filter((ref) => !docs.has(ref))
        .forEach((ref) => errors.push(`${label}/${doc.id}.yaml: reference to unknown id "${ref}"`)))
  return { docs, errors }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const metaLineHtml = (doc) => {
  const bits = [
    ...(doc.date ? [escapeHtml(doc.date)] : []),
    ...(doc.archived ? [`<a href="${escapeHtml(doc.archived)}">archived copy</a>`] : []),
  ]
  return bits.length ? `\n  <p class="link-card-meta">${bits.join(" · ")}</p>` : ""
}

// The card for a leaf doc, both on its own page and inlined in lists. Only
// the first occurrence per page carries the fragment id (withFragment).
const leafCardHtml = (doc, withFragment) => {
  const idAttr = withFragment ? ` id="link-${doc.id}"` : ""
  const mark = EXT_RE.test(doc.url)
    ? `<span class="ext-mark" title="external link">&#8599;</span>`
    : ""
  return `<div class="link-card"${idAttr}>
  <div class="link-card-title"><a href="${escapeHtml(doc.url)}">${escapeHtml(doc.title)}</a>${mark}</div>
  <p class="link-card-desc">${escapeHtml(doc.description)}</p>${metaLineHtml(doc)}
</div>`
}

// The card for a list doc referenced from another page: links to the list's
// own page instead of inlining its contents (the no-nesting rule).
const listRefCardHtml = (doc, withFragment) => {
  const idAttr = withFragment ? ` id="link-${doc.id}"` : ""
  return `<div class="link-card"${idAttr}>
  <div class="link-card-title"><a href="/links/${doc.id}/">${escapeHtml(doc.title)}</a></div>
  <p class="link-card-desc">${escapeHtml(doc.description)}</p>
</div>`
}

const docPage = (doc, body, ctx) =>
  pageShell(
    {
      pageTitle: `${doc.title} — ${ctx.siteName}`,
      og: ogHead(
        { title: doc.title, description: doc.description, path: `/links/${doc.id}/`, image: doc.image },
        ctx
      ),
      trail: [{ label: ctx.docsLabel, href: "/" }, { label: "Links", href: "/links/" }, { label: doc.title }],
      body,
    },
    ctx
  )

const renderLeafPage = (doc, ctx) =>
  docPage(doc, `<p class="section-label">Source</p>\n` + leafCardHtml(doc, true), ctx)

const renderListPage = (doc, docs, ctx) => {
  const seen = new Set()
  const card = (ref) => {
    const target = docs.get(ref)
    const withFragment = !seen.has(ref)
    seen.add(ref)
    return target.kind === "leaf"
      ? leafCardHtml(target, withFragment)
      : listRefCardHtml(target, withFragment)
  }
  const body = [
    `<h1 class="report-title">${escapeHtml(doc.title)}</h1>`,
    `<p class="report-subtitle">${escapeHtml(doc.description)}</p>`,
    `<hr class="report-header-rule">`,
    ...doc.groups.flatMap((g) => [
      ...(g.title ? [`<h2>${escapeHtml(g.title)}</h2>`] : []),
      ...(g.description ? [`<p class="link-group-desc">${escapeHtml(g.description)}</p>`] : []),
      ...g.links.map(card),
    ]),
  ].join("\n")
  return docPage(doc, body, ctx)
}

const renderIndexPage = (docs, ctx) => {
  const byId = (a, b) =>
    /^\d+$/.test(a.id) && /^\d+$/.test(b.id)
      ? Number(a.id) - Number(b.id)
      : a.id.localeCompare(b.id)
  const all = [...docs.values()]
  const lists = all.filter((d) => d.kind === "list").sort(byId)
  const leaves = all.filter((d) => d.kind === "leaf")
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`
  const title = `Links — ${ctx.siteName}`
  const body =
    `<h1 class="report-title">Links</h1>\n` +
    `<p class="report-subtitle">${escapeHtml(ctx.linksDescription)}</p>\n` +
    `<hr class="report-header-rule">\n` +
    lists.map((d) => listRefCardHtml(d, false)).join("\n") +
    `\n<p class="links-count">${plural(lists.length, "collection")} · ${plural(leaves.length, "source")}</p>`
  return pageShell(
    {
      pageTitle: title,
      og: ogHead({ title, description: ctx.linksDescription, path: "/links/" }, ctx),
      trail: [{ label: ctx.docsLabel, href: "/" }, { label: "Links" }],
      body,
    },
    ctx
  )
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Builds every page from srcDir into <outDir>/links/. Returns the validation
// errors (empty on success, in which case the pages have been written).
const buildLinks = ({ srcDir, outDir, label }, ctx) => {
  const { docs, errors } = loadDocs(srcDir, label)
  if (errors.length) return { errors, count: 0 }

  const write = (dir, html) => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "index.html"), html, "utf8")
  }
  const linksOut = join(outDir, "links")
  docs.forEach((doc, id) =>
    write(
      join(linksOut, id),
      doc.kind === "leaf" ? renderLeafPage(doc, ctx) : renderListPage(doc, docs, ctx)
    ))
  write(linksOut, renderIndexPage(docs, ctx))
  return { errors, count: docs.size }
}

export { buildLinks }
