// Markdown sources to Word documents, one set per version:
// <out>/v<N.N>/essay.docx, resolution.docx, notes.docx. US Letter, one-inch
// margins.
//
// Line spacing is exact (a fixed height per line), not a multiple of the
// font's own line height. Cambria and its stand-in on Linux, Caladea, set the
// same words to the same widths but have different natural line heights; with
// exact spacing the page breaks do not depend on which one is installed.
//
// Every page carries a footer: version (left), committee credit (center),
// page number (right). Pages after the first carry a running header: paper
// title (left), document type (right).
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, Header, Footer,
  AlignmentType, TabStopType, PageNumber, Tab, BorderStyle, LevelFormat,
  HeadingLevel, LineRuleType,
} = require("docx");
const { parse, smart } = require("./lib/markdown");
const { readRegistry } = require("./lib/registry");
const { srcPath } = require("./lib/config");

const SERIF = "Cambria";
const SANS = "Calibri";
const BLUE = "1F3864";
const GRAY = "595959";
const RULE = "8EA9DB";
const LINK = "1155CC";
const TEXT_WIDTH = 12240 - 2 * 1440; // US Letter minus one-inch margins, in DXA
const LEADING = 1.25; // line height as a multiple of the type size

// Exact line spacing for type of the given size in points.
const exact = (pt) => ({ line: Math.round(pt * LEADING * 20), lineRule: LineRuleType.EXACT });

// Inline tokens to docx runs.
//   internal link ("/links/301/")  -> its label, linked to the live page
//   external link (a source URL)   -> "Label (docs…/links/N)", so the short
//                                     address is legible on paper
function runs(tokens, cfg, registry, base = {}) {
  const style = (t) => ({ ...base, ...(t.bold ? { bold: true } : {}), ...(t.italic ? { italics: true } : {}) });
  const link = (text, url, t) =>
    new ExternalHyperlink({
      link: url,
      children: [new TextRun({ text, ...style(t), color: LINK, underline: { color: LINK } })],
    });
  return tokens.flatMap((t) => {
    if (!t.href) return [new TextRun({ text: t.text, ...style(t) })];
    if (t.href.startsWith("/")) return [link(t.text, cfg.origin + t.href, t)];
    const id = registry.idFor(t.href);
    const short = `${cfg.host}${cfg.linksPath}/${id}`;
    return [
      new TextRun({ text: `${t.text} (`, ...style(t) }),
      link(short, `${cfg.origin}${cfg.linksPath}/${id}/`, t),
      new TextRun({ text: ")", ...style(t) }),
    ];
  });
}

const furniture = (children) => new TextRun({ children, font: SANS, size: 17, color: GRAY });

const footer = (cfg, edition) =>
  new Footer({
    children: [
      new Paragraph({
        style: "Furniture",
        tabStops: [
          { type: TabStopType.CENTER, position: TEXT_WIDTH / 2 },
          { type: TabStopType.RIGHT, position: TEXT_WIDTH },
        ],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
        children: [
          furniture([`Version ${edition.version}`]),
          furniture([new Tab(), cfg.credit]),
          furniture([new Tab()]),
          furniture([PageNumber.CURRENT]),
        ],
      }),
    ],
  });

const runningHeader = (left, right) =>
  new Header({
    children: [
      new Paragraph({
        style: "Furniture",
        tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
        children: [furniture([smart(left)]), furniture([new Tab(), right])],
      }),
    ],
  });

function buildDoc(doc, cfg, edition, registry) {
  const blocks = parse(fs.readFileSync(srcPath(edition, doc), "utf8"));
  const size = Math.round(doc.bodyPt * 2); // half-points
  const titlePt = doc.centerTitle ? 17 : 22;
  const after = Math.round(doc.bodyPt * 12.5);
  const align = doc.centerTitle ? AlignmentType.CENTER : AlignmentType.LEFT;

  const children = blocks.map((b) => {
    switch (b.type) {
      case "title":
        return new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: align,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 6 } },
          children: [new TextRun({ text: b.text })],
        });
      case "deck":
        return new Paragraph({
          style: "Deck",
          alignment: align,
          children: runs(b.tokens, cfg, registry, { italics: true, color: GRAY }),
        });
      case "h2":
        return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(b.text)] });
      case "h3":
        return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.text)] });
      case "li":
        return new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80, ...exact(doc.bodyPt) },
          children: runs(b.tokens, cfg, registry),
        });
      default:
        return new Paragraph({ children: runs(b.tokens, cfg, registry) });
    }
  });

  const document = new Document({
    creator: cfg.credit,
    title: cfg.paperTitle,
    description: `Version ${edition.version}`,
    styles: {
      default: {
        document: {
          run: { font: SERIF, size },
          paragraph: { spacing: { after, ...exact(doc.bodyPt) } },
        },
        title: {
          run: { font: SANS, size: titlePt * 2, bold: true, color: BLUE },
          paragraph: { spacing: { before: 0, after: 160, ...exact(titlePt) }, keepNext: true },
        },
        heading1: {
          run: { font: SANS, size: 30, bold: true, color: BLUE },
          paragraph: { spacing: { before: 360, after: 80, ...exact(15) }, keepNext: true },
        },
        heading2: {
          run: { font: SANS, size: 23, bold: true, color: BLUE },
          paragraph: { spacing: { before: 240, after: 80, ...exact(11.5) }, keepNext: true },
        },
      },
      paragraphStyles: [
        {
          // Header and footer text. A paragraph style (not just run formatting)
          // so the page-number field inherits the small gray type.
          id: "Furniture",
          name: "Furniture",
          basedOn: "Normal",
          run: { font: SANS, size: 17, color: GRAY },
          paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.EXACT } },
        },
        {
          id: "Deck",
          name: "Deck",
          basedOn: "Normal",
          run: { italics: true, color: GRAY },
          paragraph: { spacing: { after: 240 } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true, // first page: footer only, no running header
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 600, footer: 600 },
          },
        },
        headers: {
          default: runningHeader(cfg.paperTitle, doc.runningHead),
          first: new Header({ children: [new Paragraph({ spacing: { after: 0 }, children: [] })] }),
        },
        footers: { default: footer(cfg, edition), first: footer(cfg, edition) },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

// Renders every version's Word files in memory: [[file, buffer], ...].
async function render(cfg, registry) {
  const built = [];
  for (const edition of cfg.versions) {
    for (const doc of cfg.documents) {
      built.push([path.join(edition.outDir, `${doc.key}.docx`), await buildDoc(doc, cfg, edition, registry)]);
    }
  }
  return built;
}

function write(built) {
  for (const [file, buf] of built) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
  }
}

module.exports = { render, write };
