#!/usr/bin/env node
/*
 * Site build. Always a full rebuild into _site/, which is what the GitHub
 * Pages workflow uploads and which is never committed:
 *
 *   1. wipe _site/
 *   2. write a small home page at _site/index.html
 *   3. render links/src/*.yaml into _site/links/ (build/links.mjs)
 *   4. copy static/ over the top, verbatim
 *
 * static/ goes last so a hand-made file always wins over a generated one —
 * drop in static/index.html to replace the generated home page, for instance.
 *
 *   npm run build
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync } from "node:fs"
import { join, resolve } from "node:path"
import { escapeHtml, ogHead, pageShell } from "./chrome.mjs"
import { buildLinks } from "./links.mjs"

const HERE = import.meta.dirname
const ROOT = resolve(HERE, "..")
const OUT = join(ROOT, "_site")
const STATIC = join(ROOT, "static")

const homePage = (ctx) => {
  const title = `${ctx.docsLabel} — ${ctx.siteName}`
  const body =
    `<h1 class="report-title">${escapeHtml(ctx.docsLabel)}</h1>\n` +
    `<hr class="report-header-rule">\n` +
    `<div class="link-card">
  <div class="link-card-title"><a href="/purpose-of-power/">The Purpose of the Power</a></div>
  <p class="link-card-desc">A position paper, resolution, and source notes from the Andover Democratic Town Committee on how the new congressional majority should use its power.</p>
</div>
<div class="link-card">
  <div class="link-card-title"><a href="/links/">Links</a></div>
  <p class="link-card-desc">${escapeHtml(ctx.linksDescription)}</p>
</div>`
  return pageShell(
    {
      pageTitle: title,
      og: ogHead({ title, description: ctx.linksDescription, path: "/" }, ctx),
      trail: [{ label: ctx.docsLabel }],
      body,
    },
    ctx
  )
}

const main = () => {
  const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"))
  const missing = ["siteOrigin", "siteName", "home", "docsLabel", "linksDescription", "footer"]
    .filter((k) => !config[k])
  if (missing.length) throw new Error(`site.config.json is missing: ${missing.join(", ")}`)

  // Inlined into every page, so the authoring comments are stripped on the way.
  const css = ["theme.css", "base.css"]
    .map((f) => readFileSync(join(HERE, f), "utf8"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*\n/g, "\n")
  const ctx = { ...config, siteOrigin: config.siteOrigin.replace(/\/+$/, ""), css }

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "index.html"), homePage(ctx), "utf8")

  const { errors, count } = buildLinks(
    { srcDir: join(ROOT, "links", "src"), outDir: OUT, label: "links/src" },
    ctx
  )
  if (errors.length) {
    errors.forEach((e) => console.error(`ERROR ${e}`))
    process.exit(1)
  }
  console.log(`links: ${count} pages + index`)

  if (existsSync(STATIC)) {
    cpSync(STATIC, OUT, { recursive: true, filter: (src) => !src.endsWith(".gitkeep") })
    console.log("static: copied")
  }
}

try {
  main()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
