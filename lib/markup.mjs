// A tiny, safe formatter for text the owner types in the dashboard.
//   blank line   → new paragraph
//   - item       → bullet point
//   ## Heading   → small heading (each heading starts a new column)
//   **bold**     → bold     *italic* → italic

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Style the business name the same way the logo does.
export const brand = (html) => html;

export function inline(text) {
  return brand(
    esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
  );
}

function blocksToHtml(lines) {
  const out = [];
  let para = [];
  let list = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join(" ")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      const cls = list.length > 6 && list.every((i) => i.length <= 32) ? "bullets cols" : "bullets";
      out.push(`<ul class="${cls}">${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
    }
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (/^[-•*]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^[-•*]\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("");
}

export function format(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  if (!lines.some((l) => /^##\s+/.test(l.trim()))) return blocksToHtml(lines);

  // Split into columns at each "## Heading".
  const intro = [];
  const cols = [];
  for (const l of lines) {
    const m = l.trim().match(/^##\s+(.*)$/);
    if (m) cols.push({ title: m[1], lines: [] });
    else (cols.length ? cols[cols.length - 1].lines : intro).push(l);
  }
  return (
    blocksToHtml(intro) +
    `<div class="cols-grid">${cols
      .map((c) => `<div><h4>${inline(c.title)}</h4>${blocksToHtml(c.lines).replace(/bullets cols/g, "bullets")}</div>`)
      .join("")}</div>`
  );
}
