import type {
  SlideIR,
  SlideElement,
  InlineRun,
  RenderOptions,
  MathRenderResult,
  HeadingElement,
  ParagraphElement,
  ListElement,
  CodeBlockElement,
  BlockQuoteElement,
  ImageElement,
  BlockMathElement,
  TableElement,
  TaskListElement,
  AdmonitionElement,
  AdmonitionType,
  TikZElement,
  AlgorithmElement,
} from "../types/ir";
import {
  SLIDE,
  CONTENT_WIDTH,
  HEADING_SIZES,
  ELEMENT_SPACING,
  LIST_INDENT,
  QUOTE_BAR_WIDTH,
  QUOTE_BAR_COLOR,
  QUOTE_INDENT,
  CODE_BG_COLOR,
  CODE_PADDING,
} from "./layout-engine";
import { renderMath, renderMixedParagraph } from "./math-renderer";
import katex from "katex";
import { renderTikZ } from "./tikz-renderer";
import { renderAlgorithm } from "./algorithm-renderer";
import { stripDataUrl, fetchImageAsBase64 } from "./image-utils";
import { parseMarkdown } from "./markdown-parser";
import { transformTokens } from "./ast-transformer";
import {
  fingerprintElement,
  hashRenderOptions,
  computeDiff,
  type RenderState,
  type DiffResult,
} from "./diff-engine";
import {
  getCurrentSlideId,
  saveRenderState,
  loadRenderState,
  loadSlideSource,
  saveSlideSource,
} from "./source-store";
import { getRenderOptions } from "../fonts/font-manager";
import { preloadMathFonts } from "./math-renderer";

type ProgressCallback = (msg: string) => void;

/** Prefix used to identify shapes created by SlideMD */
export const SHAPE_NAME_PREFIX = "SlideMD_";

/** Clear all shapes created by SlideMD on the current slide */
export async function clearSlideMDShapes(onProgress?: ProgressCallback): Promise<number> {
  onProgress?.("清除旧内容...");
  let deletedCount = 0;

  await PowerPoint.run(async (context) => {
    const slide = context.presentation.getSelectedSlides().getItemAt(0);
    slide.shapes.load("items/name");
    await context.sync();

    const shapesToDelete: PowerPoint.Shape[] = [];
    for (const shape of slide.shapes.items) {
      const name = shape.name || "";
      if (name.startsWith(SHAPE_NAME_PREFIX)) {
        shapesToDelete.push(shape);
      }
    }

    for (const shape of shapesToDelete) {
      shape.delete();
      deletedCount++;
    }

    if (deletedCount > 0) {
      await context.sync();
    }
  });

  return deletedCount;
}

/** Clear shapes created by SlideMD with element index >= fromIndex */
export async function clearSlideMDShapesFrom(
  fromIndex: number,
  onProgress?: ProgressCallback
): Promise<number> {
  onProgress?.(`清除元素 ${fromIndex} 及之后的内容...`);
  let deletedCount = 0;

  await PowerPoint.run(async (context) => {
    const slide = context.presentation.getSelectedSlides().getItemAt(0);
    slide.shapes.load("items/name");
    await context.sync();

    const shapesToDelete: PowerPoint.Shape[] = [];
    const newPrefix = `${SHAPE_NAME_PREFIX}e`;

    for (const shape of slide.shapes.items) {
      const name = shape.name || "";
      if (!name.startsWith(SHAPE_NAME_PREFIX)) continue;

      // New naming: SlideMD_e{idx}_s{n} or SlideMD_e{idx}_i{n}
      if (name.startsWith(newPrefix)) {
        const match = name.match(/^SlideMD_e(\d+)_/);
        if (match) {
          const elemIdx = parseInt(match[1], 10);
          if (elemIdx >= fromIndex) {
            shapesToDelete.push(shape);
          }
        }
      }
      // Old naming (SlideMD_0, SlideMD_img_0) — can't determine element index,
      // so these are only cleaned up by clearSlideMDShapes() during full_rebuild
    }

    for (const shape of shapesToDelete) {
      shape.delete();
      deletedCount++;
    }

    if (deletedCount > 0) {
      await context.sync();
    }
  });

  return deletedCount;
}

/** Pending image to insert after PowerPoint.run completes */
interface PendingImage {
  base64: string; // raw base64 without data URL prefix
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Insert a single image via Common API on the current slide */
function insertImageCommonAPI(img: PendingImage): Promise<void> {
  return new Promise((resolve, reject) => {
    Office.context.document.setSelectedDataAsync(
      img.base64,
      {
        coercionType: Office.CoercionType.Image,
        imageLeft: img.left,
        imageTop: img.top,
        imageWidth: img.width,
        imageHeight: img.height,
      } as any,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
        else reject(new Error(result.error?.message || "Image insertion failed"));
      }
    );
  });
}

/**
 * Build slide content on the CURRENT slide from SlideIR[].
 * Only the first SlideIR is used (renders onto current slide).
 * Text/shapes via PowerPoint.run, then images via Common API.
 *
 * @param incrementalOpts If provided, only render elements starting from startFromIndex
 * @returns BuildResult with nextYs for each element (for state tracking)
 */
export async function buildSlides(
  slides: SlideIR[],
  options: RenderOptions,
  onProgress?: ProgressCallback,
  incrementalOpts?: IncrementalOpts
): Promise<BuildResult> {
  if (slides.length === 0) return { nextYs: [] };

  const allElements = slides.flatMap((s) => s.elements);
  const startIdx = incrementalOpts?.startFromIndex ?? 0;

  onProgress?.("渲染公式和图片...");
  const pendingImages: { base64: string; left: number; top: number; width: number; height: number; elementIndex: number }[] = [];
  const elementResults: { result: ElementResult; elementIndex: number }[] = [];
  const nextYs: number[] = [];
  let cursorY = incrementalOpts?.startY ?? SLIDE.MARGIN_TOP;

  // For incremental: fill nextYs for skipped elements from previous state
  // (caller should have preserved these from the old RenderState)

  for (let i = startIdx; i < allElements.length; i++) {
    const images: PendingImage[] = [];
    const result = await prepareElement(allElements[i], cursorY, options, images);
    elementResults.push({ result, elementIndex: i });
    for (const img of images) {
      pendingImages.push({ ...img, elementIndex: i });
    }
    nextYs[i] = result.nextY;
    cursorY = result.nextY;
  }

  onProgress?.("添加文本内容...");

  // Track shape and image counts per element for naming
  const shapeCountPerElement = new Map<number, number>();
  const imageCountPerElement = new Map<number, number>();

  await PowerPoint.run(async (context) => {
    const slide = context.presentation.getSelectedSlides().getItemAt(0);

    for (const { result, elementIndex } of elementResults) {
      let shapeCount = 0;
      for (const op of result.shapeOps) {
        op(slide, context);
        shapeCount++;
      }
      shapeCountPerElement.set(elementIndex, shapeCount);
    }
    await context.sync();

    // Name the shapes we just created
    // We need to find them — they are the unnamed shapes or shapes at the end
    slide.shapes.load("items/name");
    await context.sync();

    // Collect all shapes that don't have a SlideMD_ name yet (newly created)
    const unnamed: PowerPoint.Shape[] = [];
    for (const shape of slide.shapes.items) {
      const name = shape.name || "";
      if (!name.startsWith(SHAPE_NAME_PREFIX)) {
        unnamed.push(shape);
      }
    }

    // Assign names in order: the shapes were added in elementResults order
    let unnamedIdx = 0;
    for (const { elementIndex } of elementResults) {
      const count = shapeCountPerElement.get(elementIndex) || 0;
      for (let s = 0; s < count; s++) {
        if (unnamedIdx < unnamed.length) {
          unnamed[unnamedIdx].name = `${SHAPE_NAME_PREFIX}e${elementIndex}_s${s}`;
          unnamedIdx++;
        }
      }
    }
    await context.sync();
  });

  if (pendingImages.length > 0) {
    onProgress?.("插入图片...");

    for (const img of pendingImages) {
      const elemIdx = img.elementIndex;
      const imgIdx = imageCountPerElement.get(elemIdx) || 0;
      imageCountPerElement.set(elemIdx, imgIdx + 1);

      await insertImageCommonAPI(img);

      // Name the image shape just inserted
      await PowerPoint.run(async (context) => {
        const slide = context.presentation.getSelectedSlides().getItemAt(0);
        slide.shapes.load("items/name");
        await context.sync();

        // The last shape without a SlideMD_ name is the one we just inserted
        const items = slide.shapes.items;
        for (let j = items.length - 1; j >= 0; j--) {
          const name = items[j].name || "";
          if (!name.startsWith(SHAPE_NAME_PREFIX)) {
            items[j].name = `${SHAPE_NAME_PREFIX}e${elemIdx}_i${imgIdx}`;
            break;
          }
        }
        await context.sync();
      });
    }
  }

  return { nextYs };
}

type ShapeOp = (slide: PowerPoint.Slide, context: PowerPoint.RequestContext) => void;

interface ElementResult {
  nextY: number;
  shapeOps: ShapeOp[];
}

/** Options for incremental rendering */
export interface IncrementalOpts {
  startFromIndex: number;
  startY: number;
}

/** Result returned by buildSlides for state tracking */
export interface BuildResult {
  nextYs: number[];
}

/** Convert inline runs to plain text (preserving math delimiters for readability) */
function runsToText(runs: InlineRun[]): string {
  return runs.map((r) => {
    switch (r.type) {
      case "text": return r.text;
      case "inline_code": return r.code;
      case "inline_math": return r.displayMode ? `$$${r.latex}$$` : `$${r.latex}$`;
      case "link": return r.text;
      default: return "";
    }
  }).join("");
}

/** Check if any run contains inline math */
function containsMath(runs: InlineRun[]): boolean {
  return runs.some((r) => r.type === "inline_math");
}

/** Check if any run contains inline code */
function containsInlineCode(runs: InlineRun[]): boolean {
  return runs.some((r) => r.type === "inline_code");
}

/** Escape HTML special characters */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Content width in CSS pixels (pt × 96/72) */
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH * (96 / 72));

/** Convert InlineRun[] to HTML string with KaTeX-rendered math */
function runsToHTML(runs: InlineRun[], opts: RenderOptions): string {
  return runs.map((run) => {
    switch (run.type) {
      case "text": {
        let html = escapeHTML(run.text).replace(/\n/g, "<br>");
        if (run.bold) html = `<b>${html}</b>`;
        if (run.italic) html = `<i>${html}</i>`;
        if (run.underline) html = `<u>${html}</u>`;
        if (run.strikethrough) html = `<s>${html}</s>`;
        return html;
      }
      case "inline_math":
        try {
          return katex.renderToString(run.latex, {
            displayMode: run.displayMode || false,
            throwOnError: false,
            output: "html",
            strict: false,
            trust: true,
          });
        } catch (e) {
          console.warn("KaTeX renderToString failed for:", run.latex.substring(0, 60), e);
          return `<code style="font-family:${opts.codeFontFamily},Consolas,monospace;color:#8B4513;font-style:italic;background:#fff8e8;padding:1px 4px;border-radius:3px;">${escapeHTML(run.latex)}</code>`;
        }
      case "inline_code":
        return `<code style="font-family:${opts.codeFontFamily},Consolas,monospace;background:#f5f5f5;padding:1px 4px;border-radius:3px;color:#C7254E;">${escapeHTML(run.code)}</code>`;
      case "link":
        return `<span style="color:#0563C1;text-decoration:underline;">${escapeHTML(run.text)}</span>`;
      case "inline_image":
        return `[${escapeHTML(run.alt || "image")}]`;
      default:
        return "";
    }
  }).join("");
}

/** Render InlineRun[] containing math as a PNG image */
async function renderRunsAsImage(
  runs: InlineRun[],
  opts: RenderOptions,
  fontSize: number,
  maxWidthPx: number = CONTENT_WIDTH_PX,
  fontColor: string = opts.fontColor,
  extraWrapHTML?: { open: string; close: string }
): Promise<MathRenderResult> {
  let html = runsToHTML(runs, opts);
  if (extraWrapHTML) {
    html = extraWrapHTML.open + html + extraWrapHTML.close;
  }
  const fontFamily = `"${opts.enFontFamily}", "${opts.zhFontFamily}", sans-serif`;
  return renderMixedParagraph(html, fontSize, fontFamily, maxWidthPx, fontColor);
}

/** Test if a character is CJK (Chinese/Japanese/Korean) */
function isCJK(ch: string): boolean {
  const code = ch.codePointAt(0) || 0;
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0x3000 && code <= 0x303F) ||   // CJK Symbols and Punctuation
    (code >= 0xFF00 && code <= 0xFFEF) ||   // Fullwidth Forms
    (code >= 0x2E80 && code <= 0x2EFF) ||   // CJK Radicals
    (code >= 0x3100 && code <= 0x312F) ||   // Bopomofo
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK Compatibility Forms
    (code >= 0x20000 && code <= 0x2A6DF)    // CJK Extension B
  );
}

/** Split text into segments of same font type, apply zhFont or enFont */
function applyDualFont(
  textRange: PowerPoint.TextRange,
  startPos: number,
  text: string,
  zhFont: string,
  enFont: string,
  fontSize: number,
  color: string,
  extraFn?: (sub: PowerPoint.TextRange) => void
): void {
  if (text.length === 0) return;
  let segStart = 0;
  let prevIsCJK = isCJK(text[0]);

  for (let i = 1; i <= text.length; i++) {
    const curIsCJK = i < text.length ? isCJK(text[i]) : !prevIsCJK; // force flush at end
    if (curIsCJK !== prevIsCJK || i === text.length) {
      const segLen = i - segStart;
      const sub = textRange.getSubstring(startPos + segStart, segLen);
      sub.font.name = prevIsCJK ? zhFont : enFont;
      sub.font.size = fontSize;
      sub.font.color = color;
      if (extraFn) extraFn(sub);
      segStart = i;
      prevIsCJK = curIsCJK;
    }
  }
}

/** Apply dual font to entire text box content */
function setTextBoxDualFont(tb: PowerPoint.Shape, text: string, opts: RenderOptions, extraFn?: (sub: PowerPoint.TextRange) => void): void {
  tb.textFrame.autoSizeSetting = "AutoSizeShapeToFitText" as any;
  tb.textFrame.wordWrap = true;
  applyDualFont(tb.textFrame.textRange, 0, text, opts.zhFontFamily, opts.enFontFamily, opts.fontSize, opts.fontColor, extraFn);
}

/** Prepare an element: pre-render images, return shape operations */
async function prepareElement(
  el: SlideElement, cursorY: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  switch (el.type) {
    case "heading": return prepHeading(el, cursorY, opts, images);
    case "paragraph": return prepParagraph(el, cursorY, opts, images);
    case "code_block": return prepCodeBlock(el, cursorY, opts);
    case "blockquote": return prepBlockquote(el, cursorY, opts, images);
    case "list": return prepList(el, cursorY, opts, 0, images);
    case "block_math": return prepBlockMath(el, cursorY, opts, images);
    case "image": return prepImage(el, cursorY, images);
    case "table": return prepTable(el, cursorY, opts, images);
    case "task_list": return prepTaskList(el, cursorY, opts, images);
    case "admonition": return prepAdmonition(el, cursorY, opts, images);
    case "tikz": return prepTikZ(el, cursorY, opts, images);
    case "algorithm": return prepAlgorithm(el, cursorY, opts, images);
    default: return { nextY: cursorY, shapeOps: [] };
  }
}

async function prepHeading(el: HeadingElement, y: number, opts: RenderOptions, images: PendingImage[]): Promise<ElementResult> {
  const fontSize = HEADING_SIZES[el.level] || 18;
  const text = runsToText(el.runs);
  const h = fontSize * 1.6;
  const color = opts.fontColor;

  if (containsMath(el.runs) || containsInlineCode(el.runs)) {
    const result = await renderRunsAsImage(
      el.runs, opts, fontSize, CONTENT_WIDTH_PX, color,
      { open: "<b>", close: "</b>" }
    );
    const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
    const scale = imgW / result.widthPt;
    const imgH = result.heightPt * scale;
    images.push({ base64: stripDataUrl(result.base64), left: SLIDE.MARGIN_LEFT, top: y, width: imgW, height: imgH });
    return { nextY: y + imgH + ELEMENT_SPACING.heading, shapeOps: [] };
  }

  const ops: ShapeOp[] = [(slide) => {
    const tb = slide.shapes.addTextBox(text, { left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: h });
    tb.textFrame.autoSizeSetting = "AutoSizeShapeToFitText" as any;
    const tr = tb.textFrame.textRange;
    tr.font.bold = true;
    applyDualFont(tr, 0, text, opts.zhFontFamily, opts.enFontFamily, fontSize, color);
  }];
  return { nextY: y + h + ELEMENT_SPACING.heading, shapeOps: ops };
}

async function prepParagraph(
  el: ParagraphElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  if (el.runs.length === 0) return { nextY: y + 8, shapeOps: [] };

  // If paragraph contains inline math or inline code, render entire paragraph as image
  // (PowerPoint native text boxes cannot set background color for partial text)
  if (containsMath(el.runs) || containsInlineCode(el.runs)) {
    try {
      const result = await renderRunsAsImage(el.runs, opts, opts.fontSize);
      const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
      const scale = imgW / result.widthPt;
      const imgH = result.heightPt * scale;
      images.push({
        base64: stripDataUrl(result.base64),
        left: SLIDE.MARGIN_LEFT, top: y, width: imgW, height: imgH,
      });
      return { nextY: y + imgH + ELEMENT_SPACING.paragraph, shapeOps: [] };
    } catch (err) {
      console.error("Paragraph render failed, falling back to text. Content:",
        el.runs.map(r => r.type === 'text' ? r.text : `[${r.type}]`).join(""),
        "Error:", err);
      // Fall through to native text rendering below
    }
  }

  // No math (or math render failed): native text box for editability
  const text = runsToText(el.runs);
  const estH = Math.max(opts.fontSize * 1.6, Math.ceil(text.length / 60) * opts.fontSize * 1.6);
  const runs = el.runs;
  const ops: ShapeOp[] = [(slide) => {
    const tb = slide.shapes.addTextBox(text, { left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: estH });
    tb.textFrame.autoSizeSetting = "AutoSizeShapeToFitText" as any;
    tb.textFrame.wordWrap = true;
    let pos = 0;
    for (const run of runs) {
      if (run.type === "text" && run.text.length > 0) {
        applyDualFont(tb.textFrame.textRange, pos, run.text, opts.zhFontFamily, opts.enFontFamily, opts.fontSize, opts.fontColor, (sub) => {
          if (run.bold) sub.font.bold = true;
          if (run.italic) sub.font.italic = true;
          if (run.underline) sub.font.underline = "Single";
          if (run.strikethrough) sub.font.strikethrough = true;
        });
        pos += run.text.length;
      } else if (run.type === "inline_code" && run.code.length > 0) {
        const sub = tb.textFrame.textRange.getSubstring(pos, run.code.length);
        sub.font.name = opts.codeFontFamily;
        sub.font.size = opts.fontSize;
        sub.font.color = "#C7254E";
        pos += run.code.length;
      } else if (run.type === "link" && run.text.length > 0) {
        applyDualFont(tb.textFrame.textRange, pos, run.text, opts.zhFontFamily, opts.enFontFamily, opts.fontSize, "#0563C1", (sub) => {
          sub.font.underline = "Single";
        });
        pos += run.text.length;
      } else if (run.type === "inline_math" && run.latex.length > 0) {
        // Fallback: show LaTeX source with $ delimiters as styled text
        const display = run.displayMode ? `$$${run.latex}$$` : `$${run.latex}$`;
        const sub = tb.textFrame.textRange.getSubstring(pos, display.length);
        sub.font.name = opts.codeFontFamily;
        sub.font.size = opts.fontSize;
        sub.font.color = "#8B4513";
        sub.font.italic = true;
        pos += display.length;
      }
    }
  }];
  return { nextY: y + estH + ELEMENT_SPACING.paragraph, shapeOps: ops };
}

function prepCodeBlock(el: CodeBlockElement, y: number, opts: RenderOptions): ElementResult {
  const lines = el.code.split("\n");
  const lineH = 14 * 1.4;
  const h = lines.length * lineH + CODE_PADDING * 2;
  const ops: ShapeOp[] = [(slide) => {
    const bg = slide.shapes.addGeometricShape("Rectangle", {
      left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: h,
    });
    bg.fill.setSolidColor(CODE_BG_COLOR);
    bg.lineFormat.visible = false;
    const tb = slide.shapes.addTextBox(el.code, {
      left: SLIDE.MARGIN_LEFT + CODE_PADDING, top: y + CODE_PADDING,
      width: CONTENT_WIDTH - CODE_PADDING * 2, height: h - CODE_PADDING * 2,
    });
    tb.textFrame.textRange.font.name = opts.codeFontFamily;
    tb.textFrame.textRange.font.size = 14;
    tb.textFrame.textRange.font.color = "#333333";
  }];
  return { nextY: y + h + ELEMENT_SPACING.code_block, shapeOps: ops };
}

async function prepBlockquote(
  el: BlockQuoteElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  const startY = y;
  const allOps: ShapeOp[] = [];
  let innerY = y;
  const innerLeft = SLIDE.MARGIN_LEFT + QUOTE_INDENT + QUOTE_BAR_WIDTH + 8;
  const innerWidth = CONTENT_WIDTH - QUOTE_INDENT - QUOTE_BAR_WIDTH - 8;

  for (const child of el.elements) {
    if (child.type === "paragraph") {
      const text = runsToText(child.runs);
      if (!text.trim() && !containsMath(child.runs) && !containsInlineCode(child.runs)) { innerY += 8; continue; }

      if (containsMath(child.runs) || containsInlineCode(child.runs)) {
        // Render paragraph with math or inline code as image
        try {
          const innerWidthPx = Math.round(innerWidth * (96 / 72));
          const result = await renderRunsAsImage(child.runs, opts, opts.fontSize, innerWidthPx, "#666666");
          const imgW = Math.min(result.widthPt, innerWidth);
          const scale = imgW / result.widthPt;
          const imgH = result.heightPt * scale;
          images.push({ base64: stripDataUrl(result.base64), left: innerLeft, top: innerY, width: imgW, height: imgH });
          innerY += imgH + 8;
          continue;
        } catch {
          // Fall through to text rendering
        }
      }

      const h = Math.max(opts.fontSize * 1.6, Math.ceil(text.length / 50) * opts.fontSize * 1.6);
      const capturedY = innerY;
      allOps.push((slide) => {
        const tb = slide.shapes.addTextBox(text, { left: innerLeft, top: capturedY, width: innerWidth, height: h });
        setTextBoxDualFont(tb, text, { ...opts, fontColor: "#666666" }, (sub) => {
          sub.font.italic = true;
        });
      });
      innerY += h + 8;
    } else {
      const r = await prepareElement(child, innerY, opts, images);
      allOps.push(...r.shapeOps);
      innerY = r.nextY;
    }
  }

  const totalH = innerY - startY;
  allOps.push((slide) => {
    const bar = slide.shapes.addGeometricShape("Rectangle", {
      left: SLIDE.MARGIN_LEFT + QUOTE_INDENT, top: startY,
      width: QUOTE_BAR_WIDTH, height: Math.max(totalH, 20),
    });
    bar.fill.setSolidColor(QUOTE_BAR_COLOR);
    bar.lineFormat.visible = false;
  });

  return { nextY: innerY + ELEMENT_SPACING.blockquote, shapeOps: allOps };
}

async function prepList(el: ListElement, y: number, opts: RenderOptions, depth: number, images: PendingImage[]): Promise<ElementResult> {
  const indent = SLIDE.MARGIN_LEFT + depth * LIST_INDENT;
  const itemW = CONTENT_WIDTH - depth * LIST_INDENT;
  const ops: ShapeOp[] = [];
  let curY = y;

  for (let idx = 0; idx < el.items.length; idx++) {
    const item = el.items[idx];
    const prefix = el.ordered ? `${idx + 1}. ` : "• ";

    if (containsMath(item.runs) || containsInlineCode(item.runs)) {
      // Render list item with math or inline code as image (include prefix)
      const prefixRuns: InlineRun[] = [{ type: "text", text: prefix }];
      const allRuns = [...prefixRuns, ...item.runs];
      const itemWidthPx = Math.round(itemW * (96 / 72));
      try {
        const result = await renderRunsAsImage(allRuns, opts, opts.fontSize, itemWidthPx);
        const imgW = Math.min(result.widthPt, itemW);
        const scale = imgW / result.widthPt;
        const imgH = result.heightPt * scale;
        images.push({ base64: stripDataUrl(result.base64), left: indent, top: curY, width: imgW, height: imgH });
        curY += imgH + 4;
      } catch {
        // Fallback to text
        const text = prefix + runsToText(item.runs);
        const h = opts.fontSize * 1.6;
        const capturedY = curY;
        ops.push((slide) => {
          const tb = slide.shapes.addTextBox(text, { left: indent, top: capturedY, width: itemW, height: h });
          setTextBoxDualFont(tb, text, opts);
        });
        curY += h + 4;
      }
    } else {
      const text = prefix + runsToText(item.runs);
      const h = opts.fontSize * 1.6;
      const capturedY = curY;
      ops.push((slide) => {
        const tb = slide.shapes.addTextBox(text, { left: indent, top: capturedY, width: itemW, height: h });
        setTextBoxDualFont(tb, text, opts);
      });
      curY += h + 4;
    }

    if (item.children) {
      const sub = await prepList(item.children, curY, opts, depth + 1, images);
      ops.push(...sub.shapeOps);
      curY = sub.nextY;
    }
  }
  return { nextY: curY + ELEMENT_SPACING.list - 4, shapeOps: ops };
}

async function prepBlockMath(
  el: BlockMathElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  try {
    const result = await renderMath(el.latex, true, opts.fontSize);
    const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
    const imgH = result.heightPt * (imgW / result.widthPt);
    const left = SLIDE.MARGIN_LEFT + (CONTENT_WIDTH - imgW) / 2;
    images.push({ base64: stripDataUrl(result.base64), left, top: y, width: imgW, height: imgH });
    return { nextY: y + imgH + ELEMENT_SPACING.block_math, shapeOps: [] };
  } catch (err) {
    console.error("Block math render failed:", el.latex.substring(0, 80), err);
    // Fallback: show LaTeX source in a styled text box with delimiters
    const text = `$$${el.latex}$$`;
    const h = Math.max(opts.fontSize * 1.6, Math.ceil(text.length / 60) * opts.fontSize * 1.6);
    const ops: ShapeOp[] = [(slide) => {
      const tb = slide.shapes.addTextBox(text, {
        left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: h,
      });
      tb.textFrame.autoSizeSetting = "AutoSizeShapeToFitText" as any;
      tb.textFrame.wordWrap = true;
      tb.textFrame.textRange.font.name = opts.codeFontFamily;
      tb.textFrame.textRange.font.size = opts.fontSize;
      tb.textFrame.textRange.font.color = "#8B4513";
      tb.textFrame.textRange.font.italic = true;
    }];
    return { nextY: y + h + ELEMENT_SPACING.block_math, shapeOps: ops };
  }
}

async function prepImage(
  el: ImageElement, y: number, images: PendingImage[]
): Promise<ElementResult> {
  try {
    const dataUrl = await fetchImageAsBase64(el.src);
    const base64 = stripDataUrl(dataUrl);
    const imgW = CONTENT_WIDTH * 0.8;
    const imgH = 200;
    const left = SLIDE.MARGIN_LEFT + (CONTENT_WIDTH - imgW) / 2;
    images.push({ base64, left, top: y, width: imgW, height: imgH });
    return { nextY: y + imgH + ELEMENT_SPACING.image, shapeOps: [] };
  } catch {
    const ops: ShapeOp[] = [(slide) => {
      const tb = slide.shapes.addTextBox(`[图片: ${el.alt || el.src}]`, {
        left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: 24,
      });
      tb.textFrame.textRange.font.color = "#999999";
      tb.textFrame.textRange.font.size = 14;
    }];
    return { nextY: y + 24 + ELEMENT_SPACING.image, shapeOps: ops };
  }
}

async function prepTable(el: TableElement, y: number, opts: RenderOptions, images: PendingImage[]): Promise<ElementResult> {
  const colCount = Math.max(el.headers.length, el.rows[0]?.length || 1);
  const colW = CONTENT_WIDTH / colCount;
  const colWidthPx = Math.round(colW * (96 / 72));
  const rowH = opts.fontSize * 1.8;
  const ops: ShapeOp[] = [];
  let curY = y;

  if (el.headers.length > 0) {
    const headerY = curY;
    for (let c = 0; c < el.headers.length; c++) {
      if (containsMath(el.headers[c]) || containsInlineCode(el.headers[c])) {
        try {
          const result = await renderRunsAsImage(el.headers[c], opts, opts.fontSize, colWidthPx);
          const imgW = Math.min(result.widthPt, colW);
          const scale = imgW / result.widthPt;
          const imgH = result.heightPt * scale;
          images.push({ base64: stripDataUrl(result.base64), left: SLIDE.MARGIN_LEFT + c * colW, top: headerY, width: imgW, height: imgH });
        } catch {
          // Fallback to text
          const text = runsToText(el.headers[c]);
          const col = c;
          ops.push((slide) => {
            const tb = slide.shapes.addTextBox(text, {
              left: SLIDE.MARGIN_LEFT + col * colW, top: headerY, width: colW, height: rowH,
            });
            setTextBoxDualFont(tb, text, opts, (sub) => { sub.font.bold = true; });
          });
        }
      } else {
        const text = runsToText(el.headers[c]);
        const col = c;
        ops.push((slide) => {
          const tb = slide.shapes.addTextBox(text, {
            left: SLIDE.MARGIN_LEFT + col * colW, top: headerY, width: colW, height: rowH,
          });
          setTextBoxDualFont(tb, text, opts, (sub) => {
            sub.font.bold = true;
          });
        });
      }
    }
    curY += rowH;
  }

  for (const row of el.rows) {
    const rowY = curY;
    for (let c = 0; c < row.length; c++) {
      if (containsMath(row[c]) || containsInlineCode(row[c])) {
        try {
          const result = await renderRunsAsImage(row[c], opts, opts.fontSize, colWidthPx);
          const imgW = Math.min(result.widthPt, colW);
          const scale = imgW / result.widthPt;
          const imgH = result.heightPt * scale;
          images.push({ base64: stripDataUrl(result.base64), left: SLIDE.MARGIN_LEFT + c * colW, top: rowY, width: imgW, height: imgH });
        } catch {
          const text = runsToText(row[c]);
          const col = c;
          ops.push((slide) => {
            const tb = slide.shapes.addTextBox(text, {
              left: SLIDE.MARGIN_LEFT + col * colW, top: rowY, width: colW, height: rowH,
            });
            setTextBoxDualFont(tb, text, opts);
          });
        }
      } else {
        const text = runsToText(row[c]);
        const col = c;
        ops.push((slide) => {
          const tb = slide.shapes.addTextBox(text, {
            left: SLIDE.MARGIN_LEFT + col * colW, top: rowY, width: colW, height: rowH,
          });
          setTextBoxDualFont(tb, text, opts);
        });
      }
    }
    curY += rowH;
  }

  return { nextY: curY + ELEMENT_SPACING.table, shapeOps: ops };
}

async function prepTaskList(el: TaskListElement, y: number, opts: RenderOptions, images: PendingImage[]): Promise<ElementResult> {
  const ops: ShapeOp[] = [];
  let curY = y;
  for (const item of el.items) {
    const prefix = item.checked ? "☑ " : "☐ ";

    if (containsMath(item.runs) || containsInlineCode(item.runs)) {
      const prefixRuns: InlineRun[] = [{ type: "text", text: prefix }];
      const allRuns = [...prefixRuns, ...item.runs];
      try {
        const result = await renderRunsAsImage(allRuns, opts, opts.fontSize);
        const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
        const scale = imgW / result.widthPt;
        const imgH = result.heightPt * scale;
        images.push({ base64: stripDataUrl(result.base64), left: SLIDE.MARGIN_LEFT, top: curY, width: imgW, height: imgH });
        curY += imgH + 4;
      } catch {
        const text = prefix + runsToText(item.runs);
        const h = opts.fontSize * 1.6;
        const capturedY = curY;
        ops.push((slide) => {
          const tb = slide.shapes.addTextBox(text, {
            left: SLIDE.MARGIN_LEFT, top: capturedY, width: CONTENT_WIDTH, height: h,
          });
          setTextBoxDualFont(tb, text, opts);
        });
        curY += h + 4;
      }
    } else {
      const text = prefix + runsToText(item.runs);
      const h = opts.fontSize * 1.6;
      const capturedY = curY;
      ops.push((slide) => {
        const tb = slide.shapes.addTextBox(text, {
          left: SLIDE.MARGIN_LEFT, top: capturedY, width: CONTENT_WIDTH, height: h,
        });
        setTextBoxDualFont(tb, text, opts);
      });
      curY += h + 4;
    }
  }
  return { nextY: curY + ELEMENT_SPACING.list - 4, shapeOps: ops };
}

const ADMONITION_STYLES: Record<AdmonitionType, { label: string; color: string; bgColor: string }> = {
  NOTE:      { label: "📝 注意",  color: "#1976D2", bgColor: "#E3F2FD" },
  TIP:       { label: "💡 建议",  color: "#388E3C", bgColor: "#E8F5E9" },
  IMPORTANT: { label: "❗ 重要",  color: "#7B1FA2", bgColor: "#F3E5F5" },
  WARNING:   { label: "⚠️ 警告", color: "#F57C00", bgColor: "#FFF3E0" },
  CAUTION:   { label: "🔴 注意", color: "#D32F2F", bgColor: "#FFEBEE" },
};

async function prepAdmonition(
  el: AdmonitionElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  const style = ADMONITION_STYLES[el.admonitionType];
  const allOps: ShapeOp[] = [];
  const startY = y;

  // Title bar
  const titleH = opts.fontSize * 1.8;
  const capturedTitleY = y;
  allOps.push((slide) => {
    const bg = slide.shapes.addGeometricShape("Rectangle", {
      left: SLIDE.MARGIN_LEFT, top: capturedTitleY, width: CONTENT_WIDTH, height: titleH,
    });
    bg.fill.setSolidColor(style.bgColor);
    bg.lineFormat.visible = false;
    const tb = slide.shapes.addTextBox(style.label, {
      left: SLIDE.MARGIN_LEFT + 10, top: capturedTitleY, width: CONTENT_WIDTH - 20, height: titleH,
    });
    setTextBoxDualFont(tb, style.label, { ...opts, fontColor: style.color }, (sub) => {
      sub.font.bold = true;
    });
  });
  y += titleH;

  // Content
  for (const child of el.elements) {
    const r = await prepareElement(child, y, opts, images);
    allOps.push(...r.shapeOps);
    y = r.nextY;
  }

  // Left accent bar
  const totalH = y - startY;
  allOps.push((slide) => {
    const bar = slide.shapes.addGeometricShape("Rectangle", {
      left: SLIDE.MARGIN_LEFT, top: startY, width: 4, height: totalH,
    });
    bar.fill.setSolidColor(style.color);
    bar.lineFormat.visible = false;
  });

  return { nextY: y + ELEMENT_SPACING.blockquote, shapeOps: allOps };
}

async function prepTikZ(
  el: TikZElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  try {
    const result = await renderTikZ(el.code);
    const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
    const scale = imgW / result.widthPt;
    const imgH = result.heightPt * scale;
    const left = SLIDE.MARGIN_LEFT + (CONTENT_WIDTH - imgW) / 2;
    images.push({ base64: result.base64, left, top: y, width: imgW, height: imgH });
    return { nextY: y + imgH + ELEMENT_SPACING.image, shapeOps: [] };
  } catch {
    // Fallback: render TikZ source as a code block
    const lines = el.code.split("\n");
    const lineH = 14 * 1.4;
    const h = lines.length * lineH + CODE_PADDING * 2 + 24;
    const ops: ShapeOp[] = [(slide) => {
      const bg = slide.shapes.addGeometricShape("Rectangle", {
        left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: h,
      });
      bg.fill.setSolidColor("#FFF3E0");
      bg.lineFormat.visible = false;
      // Error label
      const label = slide.shapes.addTextBox("[TikZ 渲染失败]", {
        left: SLIDE.MARGIN_LEFT + CODE_PADDING, top: y + 4,
        width: CONTENT_WIDTH - CODE_PADDING * 2, height: 20,
      });
      label.textFrame.textRange.font.size = 12;
      label.textFrame.textRange.font.color = "#F57C00";
      label.textFrame.textRange.font.bold = true;
      // Source code
      const tb = slide.shapes.addTextBox(el.code, {
        left: SLIDE.MARGIN_LEFT + CODE_PADDING, top: y + 24,
        width: CONTENT_WIDTH - CODE_PADDING * 2, height: h - CODE_PADDING * 2 - 24,
      });
      tb.textFrame.textRange.font.name = opts.codeFontFamily;
      tb.textFrame.textRange.font.size = 12;
      tb.textFrame.textRange.font.color = "#333333";
    }];
    return { nextY: y + h + ELEMENT_SPACING.code_block, shapeOps: ops };
  }
}

async function prepAlgorithm(
  el: AlgorithmElement, y: number, opts: RenderOptions, images: PendingImage[]
): Promise<ElementResult> {
  try {
    const result = await renderAlgorithm(el.code, opts.fontSize);
    const imgW = Math.min(result.widthPt, CONTENT_WIDTH);
    const scale = imgW / result.widthPt;
    const imgH = result.heightPt * scale;
    const left = SLIDE.MARGIN_LEFT + (CONTENT_WIDTH - imgW) / 2;
    images.push({ base64: result.base64, left, top: y, width: imgW, height: imgH });
    return { nextY: y + imgH + ELEMENT_SPACING.image, shapeOps: [] };
  } catch {
    // Fallback: render as code block
    const lines = el.code.split("\n");
    const lineH = 14 * 1.4;
    const h = lines.length * lineH + CODE_PADDING * 2;
    const ops: ShapeOp[] = [(slide) => {
      const bg = slide.shapes.addGeometricShape("Rectangle", {
        left: SLIDE.MARGIN_LEFT, top: y, width: CONTENT_WIDTH, height: h,
      });
      bg.fill.setSolidColor("#F3E5F5");
      bg.lineFormat.visible = false;
      const tb = slide.shapes.addTextBox(el.code, {
        left: SLIDE.MARGIN_LEFT + CODE_PADDING, top: y + CODE_PADDING,
        width: CONTENT_WIDTH - CODE_PADDING * 2, height: h - CODE_PADDING * 2,
      });
      tb.textFrame.textRange.font.name = opts.codeFontFamily;
      tb.textFrame.textRange.font.size = 14;
      tb.textFrame.textRange.font.color = "#333333";
    }];
    return { nextY: y + h + ELEMENT_SPACING.code_block, shapeOps: ops };
  }
}

/** Result of the incremental render orchestration */
export interface IncrementalRenderResult {
  kind: "no_change" | "full_rebuild" | "incremental";
  /** Number of shapes deleted (0 for no_change) */
  deletedCount: number;
}

/**
 * Shared incremental rendering orchestration.
 * Called by both taskpane handleRender and ribbon ribbonRender.
 *
 * 1. Parse markdown → SlideIR[]
 * 2. Compute fingerprints and diff against previous render
 * 3. Clear only the changed shapes
 * 4. Render only the changed elements
 * 5. Save new render state
 */
export async function renderMarkdownIncremental(
  markdown: string,
  onProgress?: ProgressCallback
): Promise<IncrementalRenderResult> {
  await preloadMathFonts();

  const slideId = await getCurrentSlideId();
  const options = getRenderOptions();

  onProgress?.("解析 Markdown...");
  const tokens = parseMarkdown(markdown);
  const slides = transformTokens(tokens);
  if (slides.length === 0) {
    return { kind: "no_change", deletedCount: 0 };
  }

  const allElements = slides.flatMap((s) => s.elements);
  const newFingerprints = allElements.map(fingerprintElement);
  const newOptionsHash = hashRenderOptions(options);

  const oldState = loadRenderState(slideId);
  const diff = computeDiff(oldState, newFingerprints, newOptionsHash);

  let deletedCount = 0;

  if (diff.kind === "no_change") {
    return { kind: "no_change", deletedCount: 0 };
  }

  if (diff.kind === "full_rebuild") {
    onProgress?.("清除旧内容...");
    deletedCount = await clearSlideMDShapes(onProgress);

    const buildResult = await buildSlides(slides, options, onProgress);

    // Save render state
    saveRenderState(slideId, {
      fingerprints: newFingerprints,
      nextYs: buildResult.nextYs,
      elementCount: allElements.length,
      optionsHash: newOptionsHash,
    });

    await saveSlideSource(slideId, markdown);
    return { kind: "full_rebuild", deletedCount };
  }

  // Incremental
  const firstChanged = diff.firstChangedIndex!;
  const startY = diff.startY ?? SLIDE.MARGIN_TOP;

  onProgress?.(`增量更新：从元素 ${firstChanged} 开始...`);
  deletedCount = await clearSlideMDShapesFrom(firstChanged, onProgress);

  const buildResult = await buildSlides(slides, options, onProgress, {
    startFromIndex: firstChanged,
    startY,
  });

  // Merge nextYs: keep old values for unchanged elements, use new for changed
  const mergedNextYs: number[] = [];
  for (let i = 0; i < allElements.length; i++) {
    if (i < firstChanged && oldState) {
      mergedNextYs[i] = oldState.nextYs[i];
    } else {
      mergedNextYs[i] = buildResult.nextYs[i];
    }
  }

  saveRenderState(slideId, {
    fingerprints: newFingerprints,
    nextYs: mergedNextYs,
    elementCount: allElements.length,
    optionsHash: newOptionsHash,
  });

  await saveSlideSource(slideId, markdown);
  return { kind: "incremental", deletedCount };
}
