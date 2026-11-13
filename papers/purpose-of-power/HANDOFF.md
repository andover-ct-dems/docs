Handoff: "The Purpose of the Power"
===================================

> **Note, 2026-11-13.** This toolkit has since been folded into the site
> repository and changed: sources now live in `versions/<N.N>/`, the output goes
> to `_site/purpose-of-power/`, and GitHub Actions runs the build. The
> repository's README describes the layout and the routine jobs as they are
> now. What still applies below is "Editorial rules," "Known gaps and open
> questions," and the account of how citations and the Markdown subset work.

This folder hands responsibility for the position paper's published forms
(web pages, Word files, PDFs) to the Claude Code instance that maintains the
GitHub Pages site at `docs.andoverctdems.com`. It was written on 2026-11-13 by
the Claude chat session in which Scott Sauyet drafted the paper. That session
could not see the site's repository, so anything below about the repo's layout
is an assumption to verify, and is marked as one.

The paper is a position paper of the Andover (CT) Democratic Town Committee on
how the Democratic majorities in the incoming Congress should use their power.
It has three parts: an essay, a resolution in Whereas/Resolved form, and notes
giving the source for every factual claim. The plan is for other town
committees to amend and adopt it, and for it to travel up to the state party.



Where things stand
------------------

| Item                            | State on 2026-11-13                                              |
| ------------------------------- | ---------------------------------------------------------------- |
| Live site, `/purpose-of-power/` | Version 1.0. Static pages, Word files, and PDFs.                 |
| `src/` in this folder           | Version 1.1 text: 1.0 plus the environment and climate material. |
| `dist/` in this folder          | A complete 1.1 build, made in the chat session's sandbox.        |
| Link registry on the site       | Leaves 302 to 340 and the list 301 (assumed deployed).           |
| `registry-additions/`           | Ten new leaves, 341 to 350, and an updated 301. Not yet on site. |

Version 1.1 has not been published. Scott asked for the 1.1 Markdown and this
toolkit; he has not, in the chat session, asked for 1.1 to go live. Ask him
before publishing.

The live 1.0 pages began as output from an earlier form of `build-html.js`
and were then edited in the repo: a "Documents" breadcrumb level was added.
That level is now in `build.config.json`. Checked on 2026-11-13, the generator's
essay page differs from the 1.0 page it descends from in exactly three ways:
the new breadcrumb, the version number, and the new paragraph. That check was
against the session's own 1.0 output and a description of the live page, not a
byte comparison with the live HTML, so do the real diff yourself (see "First
tasks").



What is in this folder
----------------------

```
purpose-of-power-build/
  HANDOFF.md                 this file
  build.config.json          version, site origin, paths, per-document settings
  package.json               one dependency: docx
  build.js                   runs all three steps
  build-docx.js              src/*.md  ->  dist/<key>.docx
  build-pdf.js               dist/<key>.docx  ->  dist/<key>.pdf  (LibreOffice)
  build-html.js              src/*.md, src/landing.json  ->  dist/**/index.html
  lib/markdown.js            the small Markdown reader all builders share
  lib/registry.js            maps a cited URL to its link-registry id
  lib/config.js              loads the config and resolves paths
  lib/site.css               the site stylesheet plus a marked block of additions
  src/essay.md               the essay
  src/resolution.md          the resolution
  src/notes.md               the notes; cites sources by their real URLs
  src/landing.json           the landing page's copy
  registry-additions/        links/_src/ YAML to merge into the site's registry
  dist/                      a finished 1.1 build, for reference or direct use
```

`dist/` mirrors the served folder exactly:

```
index.html
essay.docx   essay.pdf   essay/index.html
resolution.docx   resolution.pdf   resolution/index.html
notes.docx   notes.pdf   notes/index.html
```



First tasks
-----------

1. **Put this folder in the repo** somewhere that is not served, or that you
   are content to have served. The config assumes
   `<repo>/_build/purpose-of-power/`. If the site uses Jekyll, underscore
   directories are not published; if it has a `.nojekyll` file, they are.
2. **Fix the paths in `build.config.json`.** `linksSrcDirs` must include the
   repo's `links/_src/`. The default, `../../links/_src`, matches the location
   in step 1. `outDir` defaults to `dist` inside this folder so that a first
   build cannot overwrite anything live.
3. **Merge the registry additions.** Copy `registry-additions/links/_src/*.yaml`
   into the repo's `links/_src/` (301 is an update, the rest are new), run the
   links build, and confirm it passes. Then remove `registry-additions` from
   `linksSrcDirs`, so the repo's registry is the only one consulted.
4. **Install and build.** `npm install`, then `npm run build`. The PDF step
   needs LibreOffice; use `node build.js --no-pdf` to skip it.
5. **Diff `dist/` against the served `purpose-of-power/` folder.** Any
   difference beyond the version number and the 1.1 content means the live
   pages were changed in the repo after the generator's 1.0 output. Port those
   changes into `build-html.js`, `lib/site.css`, or the config. The repo's
   version wins; this generator should be made to reproduce it.
6. **Publish only when Scott says so.** Then copy `dist/` over the served
   folder, or point `outDir` at it.



How the build works
-------------------

### Sources of truth ###

| What                                      | Lives in                                            |
| ----------------------------------------- | --------------------------------------------------- |
| The paper's words                         | `src/essay.md`, `src/resolution.md`, `src/notes.md` |
| The landing page's words                  | `src/landing.json`                                  |
| Each source's URL, title, and description | The site's `links/_src/<id>.yaml`                   |
| Version number and date label             | `build.config.json`                                 |
| Look of the Word files                    | `build-docx.js`                                     |
| Look of the web pages                     | `lib/site.css`, `build-html.js`                     |

Everything in `dist/` is generated. Never edit it by hand.


### How citations flow ###

`src/notes.md` cites each source the natural way, as a Markdown link to the
source's real URL:

```
Source: [Migration Policy Institute](https://www.migrationpolicy.org/...).
```

At build time `lib/registry.js` reads every leaf in the link registry and
finds the one whose `url:` equals the cited URL. The builders then emit:

- **Web:** the source's name, linked to `/links/<id>/`. The print stylesheet
  adds the short address after each one, so a printed page still works.
- **Word and PDF:** `Migration Policy Institute (docs.andoverctdems.com/links/304)`,
  with the short address as a live link. This is what makes the documents
  usable on paper, which Scott asked for.

If a cited URL has no leaf, the build stops, lists every such URL, and writes
nothing. The match is exact, so a URL must be identical in the notes and in
its leaf, down to a trailing slash.

A link whose target starts with `/` is a site-internal link and is passed
through as written. The notes' pointer to `/links/301/` is the one example.


### The Markdown subset ###

`lib/markdown.js` reads only what the sources use: a Setext H1 title, Setext
H2 sections, `### Group ###` H3 headings, flat `- ` bullets, `**bold**`,
`*italic*`, links, and a "deck" line (a paragraph wholly in single asterisks,
shown under the title). Paragraphs may be hard-wrapped. Tables, nested lists,
numbered lists, and images are not supported; add support before using them.

Straight quotes in the sources become typographic quotes in every output.
Keep the sources in straight quotes.



Routine jobs
------------

### Publishing a new version ###

1. Edit the text in `src/`. Text changes come from Scott; see "Editorial
   rules."
2. Set `version` in `build.config.json`, and `dateLabel` if the month changed.
   Versions have two segments. Scott decides the number; a content change has
   so far meant a minor bump (1.0 to 1.1).
3. `npm run build`, review `dist/`, publish.

The version appears in the Word and PDF footers, under each web page's title,
and on the landing page. It is set in that one place only.


### Adding a source ###

1. Create `links/_src/<id>.yaml` in the repo, following the registry's README.
   Ids 301 through 350 are taken. Give it a `date` only if you know the
   publication date.
2. Add the id to the right group in `links/_src/301.yaml`. The groups mirror
   the notes' sections.
3. Cite the source in `src/notes.md` by the same URL the leaf carries.
4. Run the links build, then this build.


### Checking length ###

Scott wants the essay to fit on two pages in Word. In the reference build it
does, at 11 point with one-inch margins, with room to spare on page two. Page
counts in `dist/`: essay 2, resolution 2, notes 5. Recheck after any change to
the essay, and see the note on fonts under "Known gaps."



Editorial rules
---------------

These were set by Scott over the course of drafting. Treat them as binding.

- **The essay and resolution name no sources.** It is advocacy, not research.
  Where a number or a legal finding needs a hedge, the hedge is generic:
  "reportedly," "researchers project," "Congress's own auditors found." Naming
  an actor in the argument is fine ("the Supreme Court struck down," "the
  President says"). The notes carry every source.
- **Every factual claim in the essay or resolution has an entry in the
  notes,** in the order the essay makes the claims, with a registry leaf, and
  with a caveat wherever the claim is an estimate, an allegation, press
  reporting, or a ruling under appeal.
- **Numbers, not adjectives, and never overstated.** The paper's standing
  rests on its facts being right. If a fact is contested or is an estimate,
  the wording says so.
- **Institutional voice.** "The President," never his name. No aides or family
  members are named in the essay or resolution. The paper speaks as the
  committee: "we."
- **No Connecticut focus in the argument.** It is a national paper. The only
  local references are the committee's name and the resolution's last clause.
- **No em-dashes in prose.** Use commas, periods, or parentheses. (The dash in
  each page's `<title>` is the site template's separator, not prose.)
- **Do not reword the paper on your own initiative.** Wording is Scott's and
  the committee's. If you find an accuracy problem, report it and propose a
  fix; do not apply it silently.
- **Fairness in the notes.** The notes include the strongest points against
  the paper's position and label partisan or advocacy sources as such.



Known gaps and open questions
-----------------------------

Raise these with Scott; none is settled.

- **Adoption status.** The chat session does not know whether the committee
  has adopted the paper, or in what form. The pages present it as the
  committee's.
- **Version 1.1 is unreviewed in its built forms.** Scott has seen the 1.1
  Markdown, not the Word, PDF, or web output in `dist/`.
- **An unverified date.** The notes say press accounts of the billion-dollar
  request were "first published in May 2024." That came from the session's
  recollection, not from a source it opened. Verify or cut.
- **A wording wrinkle.** The essay says DOGE was "led by one of the wealthiest
  men in the world" when it "claimed about $110 billion." He left government
  in May 2025 and the claims kept accumulating until the office closed in July
  2026. Scott has been told twice and has left the wording alone. The notes
  record the dates.
- **Election figures are as of November 11, 2026.** Two Senate races were
  uncalled. Update the first notes entry when the counts are final.
- **How thoroughly sources were checked.** The session opened and read the
  sources for the corruption poll, ICE deaths, the DOGE audit, the Iran
  figures, the boat-strike toll, the Venezuelan oil figure, the Senate staff
  report, and the Yale survey article, and confirmed the endangerment finding,
  power plant, and offshore wind facts from search results. The remaining
  links came from a research report and were not individually opened. They
  should be clicked through before the paper is promoted widely.
- **Leaf descriptions** in the registry were written from titles and research
  notes, not from reading each page. They double as link-preview text.
- **No `archived` links.** No leaf has a Wayback copy. Leaves 302 (a running
  election tally) and 317 (a live-updates page) are the most likely to change.
- **No `og:image`.** Neither these pages nor the `/links/` pages emit one, so
  link previews have no picture. Scott called this secondary.
- **Fonts and page breaks.** The Word files ask for Cambria and Calibri. The
  reference PDFs were made on Linux, where LibreOffice substitutes the
  metric-compatible Caladea and Carlito. On a machine with other substitutes,
  page breaks may move, and the essay could run past two pages.
- **Word files and cloud editors.** The docx library writes ZIP directory
  entries, which desktop Word ignores. If a cloud co-editing service refuses
  a file, strip them: `zip -d essay.docx '*/'`.
- **Landing page copy** in `src/landing.json` was drafted by the session.
  Scott was asked to review it; the session does not know whether he changed
  it in the repo. If the live landing page reads differently, the live text
  wins; copy it into `landing.json`.



What the session did not know about the repo
--------------------------------------------

- Its directory layout, and whether it uses Jekyll or `.nojekyll`.
- How it deploys.
- Whether its links build is the one described in the registry README the
  session was shown (`_build/links.mjs`, `npm run rebuild:links`, strict
  validation, `siteOrigin` in `_build/report.config.json`).
- What sits at the site root that the "Documents" breadcrumb points to. The
  config links it to `/`.
- Whether the site has a `robots.txt`. The session's own fetcher was once
  refused for a robots reason on a temporary host; Scott found no robots file
  and no robots meta tag. Facebook's Sharing Debugger is the real test if link
  previews matter.
