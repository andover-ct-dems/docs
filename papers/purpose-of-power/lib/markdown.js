// A deliberately small Markdown reader for the three source documents.
// It understands exactly what those files use and nothing more:
//
//   Title            Setext H1 (a line underlined with ===)
//   Section          Setext H2 (a line underlined with ---)
//   ### Group ###    ATX H3
//   *deck line*      a paragraph wholly in single asterisks
//   - item           flat bullet list
//   **bold**, *italic*, [label](url)   inline
//
// Paragraphs and list items may be hard-wrapped; wrapped lines are rejoined.

// Straight quotes to typographic ones. Applied to text only, never to URLs.
const smart = (s) =>
  s
    .replace(/(^|[\s(\[*])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/'/g, "’");

// Find the ")" that closes a link target, allowing balanced parentheses
// inside the URL (The Lancet's URLs contain them).
const closeParen = (src, from) => {
  let depth = 1;
  let j = from;
  while (j < src.length && depth > 0) {
    if (src[j] === "(") depth++;
    else if (src[j] === ")") depth--;
    j++;
  }
  return depth === 0 ? j : -1;
};

// Inline text to a flat list of tokens:
//   { text, bold, italic }            plain run
//   { text, bold, italic, href }      link
// Quotes are smartened across the whole string first so that an opening quote
// at the start of a bold or italic span is still recognized as opening.
function tokenize(src, style = { bold: false, italic: false }, smartened = false) {
  if (!smartened) src = smartenOutsideUrls(src);
  const out = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) out.push({ text: buf, ...style });
    buf = "";
  };
  while (i < src.length) {
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > -1) {
        flush();
        out.push(...tokenize(src.slice(i + 2, end), { ...style, bold: true }, true));
        i = end + 2;
        continue;
      }
    }
    if (src[i] === "*") {
      const end = src.indexOf("*", i + 1);
      if (end > -1) {
        flush();
        out.push(...tokenize(src.slice(i + 1, end), { ...style, italic: true }, true));
        i = end + 1;
        continue;
      }
    }
    if (src[i] === "[") {
      const mid = src.indexOf("](", i);
      const end = mid > -1 ? closeParen(src, mid + 2) : -1;
      if (end > -1) {
        flush();
        out.push({ text: src.slice(i + 1, mid), href: src.slice(mid + 2, end - 1), ...style });
        i = end;
        continue;
      }
    }
    buf += src[i++];
  }
  flush();
  return out;
}

// Smarten quotes everywhere except inside link targets.
function smartenOutsideUrls(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const mid = src.indexOf("](", i);
    if (mid < 0) return out + smart(src.slice(i));
    const end = closeParen(src, mid + 2);
    if (end < 0) return out + smart(src.slice(i));
    out += smart(src.slice(i, mid + 2)) + src.slice(mid + 2, end);
    i = end;
  }
  return out;
}

const isRule = (line, ch) => new RegExp(`^${ch}{3,}\\s*$`).test(line || "");

// Markdown text to a list of blocks:
//   { type: "title" | "h2" | "h3" | "deck" | "p" | "li", tokens, text }
function parse(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const push = (type, raw) => {
    const tokens = tokenize(raw);
    blocks.push({ type, tokens, text: tokens.map((t) => t.text).join("") });
  };
  let k = 0;
  while (k < lines.length) {
    const line = lines[k];
    if (!line.trim()) { k++; continue; }
    if (isRule(lines[k + 1], "=")) { push("title", line.trim()); k += 2; continue; }
    if (isRule(lines[k + 1], "-")) { push("h2", line.trim()); k += 2; continue; }
    const h3 = line.match(/^###\s+(.*?)\s*#*\s*$/);
    if (h3) { push("h3", h3[1]); k++; continue; }

    // Gather the wrapped lines of one paragraph or one list item.
    const isItem = line.startsWith("- ");
    const parts = [isItem ? line.slice(2).trim() : line.trim()];
    k++;
    while (
      k < lines.length &&
      lines[k].trim() &&
      !lines[k].startsWith("- ") &&
      !/^###\s/.test(lines[k]) &&
      !isRule(lines[k + 1], "=") &&
      !isRule(lines[k + 1], "-")
    ) {
      parts.push(lines[k].trim());
      k++;
    }
    const raw = parts.join(" ");
    if (isItem) push("li", raw);
    else if (/^\*[^*].*[^*]\*$/.test(raw)) push("deck", raw.slice(1, -1));
    else push("p", raw);
  }
  return blocks;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

module.exports = { parse, tokenize, smart, slug };
