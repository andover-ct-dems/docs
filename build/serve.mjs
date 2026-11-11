#!/usr/bin/env node
/*
 * Minimal local preview of _site/, serving it at the root the way GitHub Pages
 * does on a custom domain (the pages use root-relative links, so opening the
 * files straight from disk does not work).
 *
 *   npm run build && npm run serve      → http://localhost:8080
 */

import { createServer } from "node:http"
import { readFileSync, existsSync, statSync } from "node:fs"
import { join, resolve, extname, sep } from "node:path"

const OUT = resolve(import.meta.dirname, "..", "_site")
const PORT = Number(process.env.PORT) || 8080

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory()

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
  const target = resolve(join(OUT, path))
  if (target !== OUT && !target.startsWith(OUT + sep)) {
    res.writeHead(403).end("Forbidden")
    return
  }
  // Like Pages: a directory without its trailing slash redirects to add it.
  if (isDir(target) && !path.endsWith("/")) {
    res.writeHead(301, { Location: path + "/" }).end()
    return
  }
  const file = isDir(target) ? join(target, "index.html") : target
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
    return
  }
  res
    .writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" })
    .end(readFileSync(file))
}).listen(PORT, () => console.log(`serving _site at http://localhost:${PORT}`))
