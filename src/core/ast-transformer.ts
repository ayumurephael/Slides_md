import type Token from "markdown-it/lib/token.mjs";
import type {
  SlideIR,
  SlideElement,
  InlineRun,
  TextRun,
  ListItem,
  ListElement,
  AdmonitionType,
} from "../types/ir";

/**
 * Transform markdown-it token stream into SlideIR[].
 * Uses `---` (hr) as slide separator.
 */
export function transformTokens(tokens: Token[]): SlideIR[] {
  const slides: SlideIR[] = [];
  let currentElements: SlideElement[] = [];

  function pushSlide() {
    slides.push({ elements: currentElements });
    currentElements = [];
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "hr") {
      pushSlide();
      i++;
      continue;
    }

    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const inlineToken = tokens[i + 1];
      const runs = inlineToken ? parseInlineRuns(inlineToken.children || []) : [];
      currentElements.push({ type: "heading", level, runs });
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    if (token.type === "paragraph_open") {
      const inlineToken = tokens[i + 1];
      const runs = inlineToken ? parseInlineRuns(inlineToken.children || []) : [];
      currentElements.push({ type: "paragraph", runs });
      i += 3;
      continue;
    }

    if (token.type === "fence") {
      const lang = token.info.trim().toLowerCase();
      if (lang === "tikz") {
        currentElements.push({
          type: "tikz",
          code: token.content,
        });
      } else if (lang === "algorithm" || lang === "pseudocode") {
        currentElements.push({
          type: "algorithm",
          code: token.content,
        });
      } else {
        currentElements.push({
          type: "code_block",
          language: token.info.trim(),
          code: token.content,
        });
      }
      i++;
      continue;
    }

    if (token.type === "code_block") {
      currentElements.push({
        type: "code_block",
        language: "",
        code: token.content,
      });
      i++;
      continue;
    }

    // Handle block-level math (display math) from various delimiters:
    // - $$...$$ (dollars)
    // - \\[...\\] (brackets)
    // - \\begin{...}...\\end{...} (beg_end)
    if (token.type === "math_block" || token.type === "math_block_eqno") {
      const content = token.content.trim();
      // Detect algorithm/algorithmic environments inside math blocks
      if (content.includes("\\begin{algorithm}") || content.includes("\\begin{algorithmic}")) {
        currentElements.push({ type: "algorithm", code: content });
      } else {
        currentElements.push({ type: "block_math", latex: content });
      }
      i++;
      continue;
    }

    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const ordered = token.type === "ordered_list_open";
      const closeType = ordered ? "ordered_list_close" : "bullet_list_close";
      // Detect task list (markdown-it-task-lists adds class="contains-task-list")
      const isTaskList = token.attrGet("class")?.includes("task-list") ?? false;
      if (isTaskList && !ordered) {
        const result = parseTaskList(tokens, i + 1);
        currentElements.push(result.element);
        i = result.nextIndex + 1;
      } else {
        const result = parseList(tokens, i + 1, closeType, ordered);
        currentElements.push(result.element);
        i = result.nextIndex + 1;
      }
      continue;
    }

    if (token.type === "blockquote_open") {
      const result = parseBlockquote(tokens, i + 1);
      // Check if this is a GitHub-style admonition: first element is paragraph starting with [!TYPE]
      const admonition = tryParseAdmonition(result.element);
      if (admonition) {
        currentElements.push(admonition);
      } else {
        currentElements.push(result.element);
      }
      i = result.nextIndex + 1;
      continue;
    }

    if (token.type === "table_open") {
      const result = parseTable(tokens, i + 1);
      currentElements.push(result.element);
      i = result.nextIndex + 1;
      continue;
    }

    if (token.type === "html_block") {
      const htmlContent = token.content.trim();
      if (htmlContent) {
        currentElements.push({
          type: "paragraph",
          runs: [{ type: "html", html: htmlContent }],
        });
      }
      i++;
      continue;
    }

    i++;
  }

  // Push remaining content as last slide
  if (currentElements.length > 0) {
    pushSlide();
  }

  return slides;
}

const EXPLICIT_BREAK_PATTERN = /\[br\]/gi;

function processTextWithExplicitBreaks(text: string, bold?: boolean, italic?: boolean, underline?: boolean, strikethrough?: boolean): InlineRun[] {
  const runs: InlineRun[] = [];
  const parts = text.split(EXPLICIT_BREAK_PATTERN);
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      runs.push({
        type: "text",
        text: parts[i],
        bold: bold || undefined,
        italic: italic || undefined,
        underline: underline || undefined,
        strikethrough: strikethrough || undefined,
      });
    }
    if (i < parts.length - 1) {
      runs.push({ type: "explicit_break" });
    }
  }
  
  return runs;
}

/** Parse inline tokens into InlineRun[] */
function parseInlineRuns(children: Token[]): InlineRun[] {
  const runs: InlineRun[] = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let linkHref: string | null = null;

  for (const child of children) {
    switch (child.type) {
      case "strong_open":
        bold = true;
        break;
      case "strong_close":
        bold = false;
        break;
      case "em_open":
        italic = true;
        break;
      case "em_close":
        italic = false;
        break;
      case "ins_open":
        underline = true;
        break;
      case "ins_close":
        underline = false;
        break;
      case "s_open":
        strikethrough = true;
        break;
      case "s_close":
        strikethrough = false;
        break;
      case "link_open":
        linkHref = child.attrGet("href") || "";
        break;
      case "link_close":
        linkHref = null;
        break;
      case "text":
        if (linkHref !== null) {
          const linkText = child.content;
          if (EXPLICIT_BREAK_PATTERN.test(linkText)) {
            const parts = linkText.split(EXPLICIT_BREAK_PATTERN);
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].length > 0) {
                runs.push({ type: "link", href: linkHref, text: parts[i] });
              }
              if (i < parts.length - 1) {
                runs.push({ type: "explicit_break" });
              }
            }
          } else {
            runs.push({ type: "link", href: linkHref, text: linkText });
          }
        } else {
          const textRuns = processTextWithExplicitBreaks(child.content, bold, italic, underline, strikethrough);
          runs.push(...textRuns);
        }
        break;
      case "softbreak":
        runs.push({ type: "text", text: "\n" });
        break;
      case "hardbreak":
        runs.push({ type: "explicit_break" });
        break;
      case "code_inline":
        runs.push({ type: "inline_code", code: child.content });
        break;
      case "math_inline":
        runs.push({ type: "inline_math", latex: child.content });
        break;
      case "math_inline_double":
        runs.push({ type: "inline_math", latex: child.content, displayMode: true });
        break;
      case "image":
        runs.push({
          type: "inline_image",
          src: child.attrGet("src") || "",
          alt: child.content || child.attrGet("alt") || "",
        });
        break;
      case "html_inline":
        runs.push({ type: "html", html: child.content });
        break;
      default:
        if (child.content) {
          const defaultRuns = processTextWithExplicitBreaks(child.content, bold, italic, underline, strikethrough);
          runs.push(...defaultRuns);
        }
        break;
    }
  }
  return runs;
}

/** Parse list tokens */
function parseList(
  tokens: Token[],
  start: number,
  closeType: string,
  ordered: boolean
): { element: ListElement; nextIndex: number } {
  const items: ListItem[] = [];
  let i = start;

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === "list_item_open") {
      i++;
      const itemRuns: InlineRun[] = [];
      let childList: ListElement | undefined;

      while (i < tokens.length && tokens[i].type !== "list_item_close") {
        if (tokens[i].type === "paragraph_open") {
          const inlineToken = tokens[i + 1];
          if (inlineToken) {
            itemRuns.push(...parseInlineRuns(inlineToken.children || []));
          }
          i += 3;
        } else if (
          tokens[i].type === "bullet_list_open" ||
          tokens[i].type === "ordered_list_open"
        ) {
          const subOrdered = tokens[i].type === "ordered_list_open";
          const subClose = subOrdered ? "ordered_list_close" : "bullet_list_close";
          const sub = parseList(tokens, i + 1, subClose, subOrdered);
          childList = sub.element;
          i = sub.nextIndex + 1;
        } else {
          i++;
        }
      }

      items.push({ runs: itemRuns, children: childList });
      i++; // skip list_item_close
    } else {
      i++;
    }
  }

  return {
    element: { type: "list", ordered, items },
    nextIndex: i,
  };
}

/** Parse blockquote tokens */
function parseBlockquote(
  tokens: Token[],
  start: number
): { element: SlideElement; nextIndex: number } {
  const innerTokens: Token[] = [];
  let depth = 1;
  let i = start;

  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === "blockquote_open") depth++;
    else if (tokens[i].type === "blockquote_close") {
      depth--;
      if (depth === 0) break;
    }
    innerTokens.push(tokens[i]);
    i++;
  }

  // Recursively transform inner tokens
  const innerSlides = transformTokens(innerTokens);
  const elements = innerSlides.flatMap((s) => s.elements);

  return {
    element: { type: "blockquote", elements },
    nextIndex: i,
  };
}

/** Parse table tokens */
function parseTable(
  tokens: Token[],
  start: number
): { element: SlideElement; nextIndex: number } {
  const headers: InlineRun[][] = [];
  const rows: InlineRun[][][] = [];
  let i = start;
  let inHead = false;
  let inBody = false;
  let currentRow: InlineRun[][] = [];

  while (i < tokens.length && tokens[i].type !== "table_close") {
    const t = tokens[i];
    if (t.type === "thead_open") { inHead = true; i++; continue; }
    if (t.type === "thead_close") { inHead = false; i++; continue; }
    if (t.type === "tbody_open") { inBody = true; i++; continue; }
    if (t.type === "tbody_close") { inBody = false; i++; continue; }
    if (t.type === "tr_open") { currentRow = []; i++; continue; }
    if (t.type === "tr_close") {
      if (inHead) {
        // Each cell is a header column
        for (const cell of currentRow) headers.push(cell);
      } else {
        rows.push(currentRow);
      }
      i++;
      continue;
    }
    if (t.type === "th_open" || t.type === "td_open") {
      const inline = tokens[i + 1];
      const runs = inline ? parseInlineRuns(inline.children || []) : [];
      currentRow.push(runs);
      i += 3; // open, inline, close
      continue;
    }
    i++;
  }

  return {
    element: { type: "table", headers, rows },
    nextIndex: i,
  };
}

/** Parse task list (- [ ] / - [x]) */
function parseTaskList(
  tokens: Token[],
  start: number
): { element: SlideElement; nextIndex: number } {
  const items: { checked: boolean; runs: InlineRun[] }[] = [];
  let i = start;

  while (i < tokens.length && tokens[i].type !== "bullet_list_close") {
    if (tokens[i].type === "list_item_open") {
      const checked = tokens[i].attrGet("class")?.includes("task-list-item-checked") ?? false;
      i++;
      const itemRuns: InlineRun[] = [];
      while (i < tokens.length && tokens[i].type !== "list_item_close") {
        if (tokens[i].type === "paragraph_open") {
          const inlineToken = tokens[i + 1];
          if (inlineToken?.children) {
            // Skip the checkbox input token if present
            const children = inlineToken.children.filter(
              (c) => !(c.type === "html_inline" && c.content.includes('type="checkbox"'))
            );
            itemRuns.push(...parseInlineRuns(children));
          }
          i += 3;
        } else {
          i++;
        }
      }
      items.push({ checked, runs: itemRuns });
      i++; // skip list_item_close
    } else {
      i++;
    }
  }

  return {
    element: { type: "task_list", items },
    nextIndex: i,
  };
}

const ADMONITION_TYPES = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

/** Try to convert a blockquote into an admonition if it starts with [!TYPE] */
function tryParseAdmonition(bq: SlideElement): SlideElement | null {
  if (bq.type !== "blockquote" || bq.elements.length === 0) return null;

  const first = bq.elements[0];
  if (first.type !== "paragraph" || first.runs.length === 0) return null;

  const firstRun = first.runs[0];
  if (firstRun.type !== "text") return null;

  const match = firstRun.text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return null;

  const admonitionType = match[1].toUpperCase() as AdmonitionType;

  // Remove the [!TYPE] prefix from the first run
  const remainingText = firstRun.text.slice(match[0].length);
  const modifiedRuns = [...first.runs];
  if (remainingText) {
    modifiedRuns[0] = { ...firstRun, text: remainingText };
  } else {
    modifiedRuns.shift();
  }

  // Build the admonition content
  const elements: SlideElement[] = [];
  if (modifiedRuns.length > 0) {
    elements.push({ type: "paragraph", runs: modifiedRuns });
  }
  elements.push(...bq.elements.slice(1));

  return { type: "admonition", admonitionType, elements };
}
