// Tiny Markdown → HTML for the guides (headings, paragraphs, bullet and
// numbered lists, pipe tables, **bold**, *italic*, `code`). Enough for the
// hand-written docs; not a general converter.

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

/** Convert a Markdown string to HTML. */
export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let para = [];
  let list = null; // { tag, items }
  let table = null; // rows[]

  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    const cells = (row, tag) => row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("");
    html.push(`<table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r, "td")}</tr>`).join("")}</tbody></table>`);
    table = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushTable(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushAll(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (/^\|.*\|$/.test(line)) {
      flushPara(); flushList();
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      (table ??= []).push(cells);
      continue;
    }
    flushTable();
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ul ?? ol)[1]);
      continue;
    }
    if (list) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    para.push(line.trim());
  }
  flushAll();
  return html.join("\n");
}

/**
 * Split a Markdown document into journal pages: the H1 is the title, each
 * H2 starts a page (its heading becomes the page name and is not repeated
 * in the body). Returns { title, pages: [{ name, html }] }.
 */
export function mdToPages(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  const pages = [];
  let current = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1 && !title) { title = h1[1].trim(); continue; }
    if (h2) { current = { name: h2[1].trim(), body: [] }; pages.push(current); continue; }
    if (current) current.body.push(line);
    else if (line.trim()) (pages[0] ??= { name: "Introduction", body: [] }) && (current = pages[0]) && current.body.push(line);
  }
  return { title, pages: pages.map((p) => ({ name: p.name, html: mdToHtml(p.body.join("\n")) })) };
}
