import katex from "katex";
import html2canvas from "html2canvas";

export interface AlgorithmRenderResult {
  base64: string; // raw base64 (no data URL prefix)
  widthPt: number;
  heightPt: number;
}

const RENDER_SCALE = 5; // 5x for ≥330 DPI (theoretical 480 DPI)
const cache = new Map<string, AlgorithmRenderResult>();

/**
 * Render LaTeX algorithm/algorithmic pseudocode to a PNG image.
 *
 * Uses a lightweight built-in renderer that parses common algorithmic
 * commands (\State, \If, \For, \While, \Function, \Return, etc.)
 * and produces styled HTML, then rasterises via html2canvas.
 */
export async function renderAlgorithm(
  code: string,
  fontSize: number = 16
): Promise<AlgorithmRenderResult> {
  const cacheKey = `${code}|${fontSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const html = algorithmToHTML(code, fontSize);
  const result = await htmlToPng(html);
  cache.set(cacheKey, result);
  return result;
}

/* ------------------------------------------------------------------ */
/*  LaTeX algorithmic → HTML converter                                */
/* ------------------------------------------------------------------ */

/** Render a LaTeX math fragment to HTML via KaTeX (inline mode) */
function renderMathInline(tex: string): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode: false,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return `<code>${tex}</code>`;
  }
}

/**
 * Process inline math ($...$) and \textbf{}, \textit{} within a text
 * fragment, returning an HTML string.
 */
function processInlineFormatting(text: string): string {
  // Replace $...$ with KaTeX-rendered HTML
  let result = text.replace(/\$([^$]+)\$/g, (_, tex) => renderMathInline(tex));
  // \textbf{...}
  result = result.replace(/\\textbf\{([^}]*)}/g, "<b>$1</b>");
  // \textit{...}
  result = result.replace(/\\textit\{([^}]*)}/g, "<i>$1</i>");
  // \texttt{...}
  result = result.replace(/\\texttt\{([^}]*)}/g, '<code style="font-family:Consolas,monospace;background:#f0f0f0;padding:0 3px;border-radius:2px;">$1</code>');
  return result;
}

/**
 * Parse LaTeX algorithmic commands into structured HTML.
 * Supports: \State, \If, \ElsIf, \Else, \EndIf, \For, \EndFor,
 * \While, \EndWhile, \Function, \EndFunction, \Return, \Require,
 * \Ensure, \Comment, \caption, line numbers.
 */
function algorithmToHTML(code: string, fontSize: number): string {
  // Strip outer \begin{algorithm}...\end{algorithm} wrapper if present
  let body = code.trim();
  let caption = "";

  const captionMatch = body.match(/\\caption\{([^}]*)}/);
  if (captionMatch) {
    caption = captionMatch[1];
    body = body.replace(captionMatch[0], "");
  }

  body = body
    .replace(/\\begin\{algorithm\}(\[.*?\])?/g, "")
    .replace(/\\end\{algorithm\}/g, "")
    .replace(/\\begin\{algorithmic\}(\[.*?\])?/g, "")
    .replace(/\\end\{algorithmic\}/g, "")
    .trim();

  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  let indent = 0;
  let lineNum = 0;
  const htmlLines: string[] = [];

  for (const line of lines) {
    const result = parseLine(line, indent);
    if (result.indentBefore !== undefined) indent = Math.max(0, result.indentBefore);
    lineNum++;
    const pad = indent * 24;
    const numSpan = `<span class="algo-linenum">${lineNum}</span>`;
    htmlLines.push(
      `<div class="algo-line" style="padding-left:${pad}px">${numSpan}${result.html}</div>`
    );
    if (result.indentAfter !== undefined) indent = Math.max(0, result.indentAfter);
  }

  const captionHTML = caption
    ? `<div class="algo-caption"><b>Algorithm:</b> ${processInlineFormatting(caption)}</div>`
    : "";

  return `<div class="algo-container" style="font-size:${fontSize}pt;font-family:'Segoe UI','微软雅黑',sans-serif;line-height:1.7;padding:16px 20px;background:#fff;border:1px solid #ccc;border-radius:4px;display:inline-block;">
${captionHTML}
<div class="algo-body">${htmlLines.join("\n")}</div>
</div>
<style>
.algo-caption { font-size:${fontSize}pt; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #ddd; }
.algo-line { white-space:pre-wrap; position:relative; min-height:1.7em; }
.algo-linenum { display:inline-block; width:28px; color:#999; text-align:right; margin-right:12px; font-size:0.85em; user-select:none; }
.algo-kw { color:#0033b3; font-weight:bold; }
.algo-fn { color:#6a3e7e; }
.algo-comment { color:#8c8c8c; font-style:italic; }
</style>`;
}

interface ParsedLine {
  html: string;
  indentBefore?: number;
  indentAfter?: number;
}

function kw(word: string): string {
  return `<span class="algo-kw">${word}</span>`;
}

function parseLine(line: string, currentIndent: number): ParsedLine {
  // \Require / \Ensure (preconditions)
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^\\Require\s+(.*)/))) {
    return { html: `${kw("Require:")} ${processInlineFormatting(m[1])}` };
  }
  if ((m = line.match(/^\\Ensure\s+(.*)/))) {
    return { html: `${kw("Ensure:")} ${processInlineFormatting(m[1])}` };
  }
  // \Function{Name}{params}
  if ((m = line.match(/^\\Function\{([^}]*)}\{([^}]*)}/))) {
    return {
      html: `${kw("function")} <span class="algo-fn">${m[1]}</span>(${processInlineFormatting(m[2])})`,
      indentAfter: currentIndent + 1,
    };
  }
  if (/^\\EndFunction/.test(line)) {
    return { html: kw("end function"), indentBefore: currentIndent - 1 };
  }
  // \Procedure{Name}{params}
  if ((m = line.match(/^\\Procedure\{([^}]*)}\{([^}]*)}/))) {
    return {
      html: `${kw("procedure")} <span class="algo-fn">${m[1]}</span>(${processInlineFormatting(m[2])})`,
      indentAfter: currentIndent + 1,
    };
  }
  if (/^\\EndProcedure/.test(line)) {
    return { html: kw("end procedure"), indentBefore: currentIndent - 1 };
  }
  // \If{condition}
  if ((m = line.match(/^\\If\{(.*)}/))) {
    return {
      html: `${kw("if")} ${processInlineFormatting(m[1])} ${kw("then")}`,
      indentAfter: currentIndent + 1,
    };
  }
  if ((m = line.match(/^\\ElsIf\{(.*)}/))) {
    return {
      html: `${kw("else if")} ${processInlineFormatting(m[1])} ${kw("then")}`,
      indentBefore: currentIndent - 1,
      indentAfter: currentIndent,
    };
  }
  if (/^\\Else/.test(line)) {
    return {
      html: kw("else"),
      indentBefore: currentIndent - 1,
      indentAfter: currentIndent,
    };
  }
  if (/^\\EndIf/.test(line)) {
    return { html: kw("end if"), indentBefore: currentIndent - 1 };
  }
  // \For{condition}
  if ((m = line.match(/^\\For\{(.*)}/))) {
    return {
      html: `${kw("for")} ${processInlineFormatting(m[1])} ${kw("do")}`,
      indentAfter: currentIndent + 1,
    };
  }
  if ((m = line.match(/^\\ForAll\{(.*)}/))) {
    return {
      html: `${kw("for all")} ${processInlineFormatting(m[1])} ${kw("do")}`,
      indentAfter: currentIndent + 1,
    };
  }
  if (/^\\EndFor/.test(line)) {
    return { html: kw("end for"), indentBefore: currentIndent - 1 };
  }
  // \While{condition}
  if ((m = line.match(/^\\While\{(.*)}/))) {
    return {
      html: `${kw("while")} ${processInlineFormatting(m[1])} ${kw("do")}`,
      indentAfter: currentIndent + 1,
    };
  }
  if (/^\\EndWhile/.test(line)) {
    return { html: kw("end while"), indentBefore: currentIndent - 1 };
  }
  // \Repeat / \Until
  if (/^\\Repeat/.test(line)) {
    return { html: kw("repeat"), indentAfter: currentIndent + 1 };
  }
  if ((m = line.match(/^\\Until\{(.*)}/))) {
    return {
      html: `${kw("until")} ${processInlineFormatting(m[1])}`,
      indentBefore: currentIndent - 1,
    };
  }
  // \Return
  if ((m = line.match(/^\\Return\s*(.*)/))) {
    return { html: `${kw("return")} ${processInlineFormatting(m[1])}` };
  }
  // \State (general statement)
  if ((m = line.match(/^\\State\s*(.*)/))) {
    let content = m[1];
    // Handle \Comment{...} at end of line
    const commentMatch = content.match(/\\Comment\{([^}]*)}/);
    let comment = "";
    if (commentMatch) {
      comment = ` <span class="algo-comment">▷ ${commentMatch[1]}</span>`;
      content = content.replace(commentMatch[0], "");
    }
    // Handle \gets (←)
    content = content.replace(/\\gets/g, "←");
    content = content.replace(/\\leftarrow/g, "←");
    return { html: processInlineFormatting(content.trim()) + comment };
  }
  // \Comment standalone
  if ((m = line.match(/^\\Comment\{([^}]*)}/))) {
    return { html: `<span class="algo-comment">▷ ${m[1]}</span>` };
  }
  // Fallback: render as-is with inline formatting
  let fallback = line.replace(/\\gets/g, "←").replace(/\\leftarrow/g, "←");
  return { html: processInlineFormatting(fallback) };
}

/* ------------------------------------------------------------------ */
/*  HTML → PNG rasterisation                                          */
/* ------------------------------------------------------------------ */

async function htmlToPng(html: string): Promise<AlgorithmRenderResult> {
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-9999px;top:0;background:white;";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: RENDER_SCALE,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });
    const dataUrl = canvas.toDataURL("image/png");
    const widthPt = canvas.width / RENDER_SCALE / 1.333;
    const heightPt = canvas.height / RENDER_SCALE / 1.333;

    const idx = dataUrl.indexOf(",");
    const raw = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;

    return { base64: raw, widthPt, heightPt };
  } finally {
    document.body.removeChild(container);
  }
}

export function clearAlgorithmCache(): void {
  cache.clear();
}
