/**
 * Incremental rendering: fingerprint computation and diff detection.
 * Compares element fingerprints between renders to determine
 * the minimal set of elements that need re-rendering.
 */

import type { SlideElement, InlineRun, RenderOptions } from "../types/ir";

/** Stored state from the previous render of a slide */
export interface RenderState {
  fingerprints: string[];
  nextYs: number[];
  elementCount: number;
  optionsHash: string;
}

export type DiffKind = "no_change" | "full_rebuild" | "incremental";

export interface DiffResult {
  kind: DiffKind;
  /** Index of the first changed element (only for "incremental") */
  firstChangedIndex?: number;
  /** The cursorY to resume rendering from (only for "incremental") */
  startY?: number;
}

/** Simple string hash (djb2) — fast, no crypto needed */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Serialize an InlineRun to a stable string */
function serializeRun(run: InlineRun): string {
  switch (run.type) {
    case "text":
      return `T:${run.text}|${run.bold ? "b" : ""}${run.italic ? "i" : ""}${run.underline ? "u" : ""}${run.strikethrough ? "s" : ""}`;
    case "inline_math":
      return `M:${run.latex}|${run.displayMode ? "d" : ""}`;
    case "inline_code":
      return `C:${run.code}`;
    case "link":
      return `L:${run.href}|${run.text}`;
    case "inline_image":
      return `I:${run.src}|${run.alt}`;
  }
}
/** Recursively serialize a SlideElement to a stable string */
function serializeElement(el: SlideElement): string {
  switch (el.type) {
    case "heading":
      return `H${el.level}:${el.runs.map(serializeRun).join(",")}`;
    case "paragraph":
      return `P:${el.runs.map(serializeRun).join(",")}`;
    case "code_block":
      return `CB:${el.language}|${el.code}`;
    case "block_math":
      return `BM:${el.latex}`;
    case "image":
      return `IMG:${el.src}|${el.alt}`;
    case "list":
      return `LIST:${el.ordered ? "o" : "u"}|${el.items.map((item) => {
        const runs = item.runs.map(serializeRun).join(",");
        const children = item.children ? serializeElement(item.children) : "";
        return `${runs}[${children}]`;
      }).join(";")}`;
    case "blockquote":
      return `BQ:${el.elements.map(serializeElement).join(";")}`;
    case "table":
      return `TBL:${el.headers.map((h) => h.map(serializeRun).join(",")).join("|")}::${el.rows.map((r) => r.map((c) => c.map(serializeRun).join(",")).join("|")).join(";")}`;
    case "task_list":
      return `TL:${el.items.map((i) => `${i.checked ? "x" : "o"}:${i.runs.map(serializeRun).join(",")}`).join(";")}`;
    case "admonition":
      return `ADM:${el.admonitionType}|${el.elements.map(serializeElement).join(";")}`;
    case "tikz":
      return `TIKZ:${el.code}`;
    case "algorithm":
      return `ALG:${el.code}`;
    default:
      return `UNK:${JSON.stringify(el)}`;
  }
}

/** Compute a fingerprint string for a single SlideElement */
export function fingerprintElement(el: SlideElement): string {
  return djb2(serializeElement(el));
}

/** Compute a hash of RenderOptions (font/size changes require full rebuild) */
export function hashRenderOptions(opts: RenderOptions): string {
  const key = `${opts.fontFamily}|${opts.fontSize}|${opts.fontColor}|${opts.codeFontFamily}|${opts.zhFontFamily}|${opts.enFontFamily}`;
  return djb2(key);
}

/**
 * Compare previous render state with new fingerprints.
 * Returns the diff result indicating what needs to be re-rendered.
 */
export function computeDiff(
  oldState: RenderState | null,
  newFingerprints: string[],
  newOptionsHash: string
): DiffResult {
  // No previous state → full rebuild
  if (!oldState) {
    return { kind: "full_rebuild" };
  }

  // Render options changed → full rebuild
  if (oldState.optionsHash !== newOptionsHash) {
    return { kind: "full_rebuild" };
  }

  // Find first differing element
  const minLen = Math.min(oldState.fingerprints.length, newFingerprints.length);
  let firstChanged = -1;

  for (let i = 0; i < minLen; i++) {
    if (oldState.fingerprints[i] !== newFingerprints[i]) {
      firstChanged = i;
      break;
    }
  }

  // All common elements match
  if (firstChanged === -1) {
    if (oldState.fingerprints.length === newFingerprints.length) {
      // Exactly the same
      return { kind: "no_change" };
    }
    // Elements added or removed at the end
    firstChanged = minLen;
  }

  // Determine startY from the previous render state
  const startY = firstChanged === 0
    ? undefined  // Will use default MARGIN_TOP
    : oldState.nextYs[firstChanged - 1];

  return {
    kind: "incremental",
    firstChangedIndex: firstChanged,
    startY,
  };
}
