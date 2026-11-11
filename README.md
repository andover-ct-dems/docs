# docs.andoverctdems.com

Static documents and a link registry for the Andover Democratic Town Committee,
published to GitHub Pages. No framework, no bundler: one small Node build turns
YAML into HTML and copies everything else through untouched.


## Layout

| Path                          | What it is                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| `links/src/*.yaml`            | Link registry sources, one file per link or collection            |
| `static/`                     | Files published verbatim (PDFs, images, hand-made pages)          |
| `site.config.json`            | Site origin, names, breadcrumb home link, footer text             |
| `build/build.mjs`             | The build: home page, links, then `static/` copied over the top   |
| `build/links.mjs`             | Link registry generator                                           |
| `build/chrome.mjs`            | Shared banner, breadcrumbs, footer and page shell                 |
| `build/theme.css`             | Every colour, font and size token; the place to restyle the site  |
| `build/base.css`              | Structural CSS, tokens only                                       |
| `.github/workflows/pages.yml` | Builds and deploys on every push to `main`                        |
| `_site/`                      | Build output; git-ignored, never committed                        |


## Everyday use

```
npm install
npm run build      # writes _site/
npm run serve      # previews _site/ at http://localhost:8080
```

Then commit and push; the workflow rebuilds and publishes.


## Documents

A file at `static/purpose-of-power/resolution.pdf` is published at
`https://docs.andoverctdems.com/purpose-of-power/resolution.pdf`. Anything in
`static/` wins over a generated file of the same path, so `static/index.html`
replaces the generated home page.


## Links

Each YAML file in `links/src/` becomes a page at `/links/<id>/`, where the id is
the filename stem and must match the file's `id`. There are two shapes.

A **leaf** is one source:

```yaml
id: 307
title: "NPR: The federal investigations into the shootings of Renee Good and Alex Pretti"
description: >-
  An April 10, 2026 NPR report on the investigations.
url: https://www.npr.org/2026/04/10/...
date: 2026-04-10        # optional
archived: https://...   # optional, an archive copy
image: /cards/307.png   # optional, the og:image for the link's own page
```

A **list** is a collection of other docs, by id:

```yaml
id: 301
title: "Sources for \"The Purpose of the Power\""
description: >-
  The sources behind the position paper.
groups:
  - title: "Immigration enforcement"
    description: "Optional line under the heading."
    links: [304, 305, 306, 307]
```

A list with no need for headings can use a top-level `links: [...]` instead of
`groups`.

Rules the build enforces, reporting every failure before it stops:

- A `url` or `image` starts with `http(s)://` (external) or `/` (a file on this
  site, normally something under `static/`).
- Every id a list references must exist.
- Lists do not nest. A list that references another list shows a card linking to
  that list's page instead of inlining it.
- Unknown keys are errors.

On a list page each card carries the fragment id `link-<id>`, so
`/links/301/#link-307` lands on, and highlights, one source within the
collection.


## First-time GitHub setup

1. Create the repository and push `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Pages → Custom domain: `docs.andoverctdems.com`, and add a DNS
   `CNAME` record for `docs` pointing at `<owner>.github.io`. With an
   Actions-based deploy the custom domain lives in this setting; no `CNAME`
   file is needed in the repository.
4. Once the certificate is issued, tick **Enforce HTTPS**.

The pages use root-relative links (`/links/307/`), so the site must be served
from the root of its own domain. It will not render correctly at
`<owner>.github.io/<repo>/` before the custom domain is attached. If the domain
changes, update `siteOrigin` in `site.config.json`, which feeds the canonical
and Open Graph URLs.
