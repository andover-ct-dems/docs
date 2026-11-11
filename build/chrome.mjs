/*
 * Shared page chrome: escaping, breadcrumbs, the banner, the footer bar, the
 * Open Graph head and the page shell every generated page is poured into.
 *
 * Lifted from andoverct.info's _build/chrome.js and links.mjs, minus everything
 * that site needs and this one does not (report kinds, client scripts, the
 * ESM/CJS split). This emits stable class names; build/theme.css and
 * build/base.css skin them.
 */

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const SEP = '<span class="sep">›</span>'

// `trail` is an ordered array of { label, href? }: items with an href render as
// links, an item without one (normally the last) as the current-page span.
const crumbs = (trail) =>
  trail
    .map((c) => (c.href
      ? `<a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a>`
      : `<span class="current">${escapeHtml(c.label)}</span>`))
    .join(SEP)

const banner = (crumbsHtml) =>
  `<div class="page-banner">
  <nav class="page-banner-inner crumbs">
    ${crumbsHtml}
  </nav>
</div>`

// `footer` is trusted HTML from site.config.json.
const siteFooter = (footer) =>
  `<footer class="site-footer">
<div class="site-footer-inner">${footer}</div>
</footer>`

const absUrl = (u, siteOrigin) => (u.startsWith("/") ? siteOrigin + u : u)

const ogHead = ({ title, description, path, image }, { siteOrigin, defaultOgImage }) => {
  const url = siteOrigin + path
  const img = image || defaultOgImage
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    ...(img ? [`<meta property="og:image" content="${escapeHtml(absUrl(img, siteOrigin))}">`] : []),
    `<link rel="canonical" href="${escapeHtml(url)}">`,
  ].join("\n")
}

// trail: the crumbs AFTER the site's home link, which is always first.
const pageShell = ({ pageTitle, og, trail, body }, ctx) =>
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${og}
<title>${escapeHtml(pageTitle)}</title>
<style>${ctx.css}</style>
</head>
<body>
${banner(crumbs([ctx.home, ...trail]))}
<div class="container">
${body}
</div>
${siteFooter(ctx.footer)}
</body>
</html>`

export { escapeHtml, crumbs, banner, siteFooter, absUrl, ogHead, pageShell }
