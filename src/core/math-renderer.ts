import katex from "katex";
import html2canvas from "html2canvas";
import type { MathRenderResult } from "../types/ir";
import {
  getRenderScale,
  getRenderQuality,
  HTML2CANVAS_OPTIONS,
  canvasToBase64,
  pixelsToPoints,
  autoCropCanvas,
} from "./render-config";

const cache = new Map<string, MathRenderResult>();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

let fontsReady = false;
let fontLoadPromise: Promise<void> | null = null;
let katexCssText: string | null = null;

const KATEX_FONT_FAMILIES = [
  "KaTeX_Main",
  "KaTeX_Math",
  "KaTeX_Size1",
  "KaTeX_Size2",
  "KaTeX_Size3",
  "KaTeX_Size4",
  "KaTeX_AMS",
  "KaTeX_Caligraphic",
  "KaTeX_Fraktur",
  "KaTeX_SansSerif",
  "KaTeX_Script",
  "KaTeX_Typewriter",
];

async function waitForSpecificFonts(): Promise<void> {
  if (!document.fonts) return;
  
  const fontPromises: Promise<void>[] = [];
  for (const family of KATEX_FONT_FAMILIES) {
    try {
      const loadedFonts = await document.fonts.check(`16px "${family}"`);
      if (!loadedFonts) {
        fontPromises.push(
          document.fonts.load(`16px "${family}"`).then(() => {}).catch(() => {})
        );
      }
    } catch {
      // Font API not fully supported
    }
  }
  
  if (fontPromises.length > 0) {
    await Promise.all(fontPromises);
  }
}

export async function preloadMathFonts(): Promise<void> {
  if (fontsReady) return;
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      const testFormulas = [
        "x^2+y^2=z^2",
        "\\sum_{i=1}^{n} \\frac{a}{b}",
        "\\int \\alpha \\beta \\gamma",
        "\\mathbb{R} \\mathcal{L}",
        "\\sqrt{x^2+y^2}",
        "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}",
        "\\mathbf{ABCD}",
        "\\mathsf{sans}",
        "\\mathtt{mono}",
        "\\mathscr{Script}",
        "\\mathfrak{Fraktur}",
        "\\begin{Bmatrix}a&b\\\\c&d\\end{Bmatrix}",
        "\\left\\{\\frac{a}{b}\\right\\}",
        "\\begin{cases}x>0&y\\\\x<0&-y\\end{cases}",
      ];

      const testDiv = document.createElement("div");
      testDiv.style.cssText =
        "position:fixed;left:0;top:0;opacity:0;pointer-events:none;font-size:24pt;z-index:-1;";

      for (const formula of testFormulas) {
        try {
          const formulaDiv = document.createElement("div");
          formulaDiv.innerHTML = katex.renderToString(formula, {
            displayMode: true,
            throwOnError: false,
            output: "html",
          });
          testDiv.appendChild(formulaDiv);
        } catch { /* ignore */ }
      }
      document.body.appendChild(testDiv);

      await waitForSpecificFonts();

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await new Promise((r) => setTimeout(r, 800));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      await waitForSpecificFonts();

      document.body.removeChild(testDiv);
      fontsReady = true;
    } catch (e) {
      console.warn("KaTeX font preload failed:", e);
      fontsReady = true;
    }
  })();

  return fontLoadPromise;
}

/**
 * Wait for fonts to be ready before rasterization.
 */
async function ensureFontsReady(): Promise<void> {
  if (!fontsReady) {
    await preloadMathFonts();
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * Create an off-screen container suitable for html2canvas capture.
 * Uses position:fixed + opacity:0 instead of left:-9999px so the
 * browser still performs full layout and font shaping.
 */
function createOffscreenContainer(extraStyles?: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "0";
  el.style.top = "0";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "-9999";
  el.style.background = "white";
  el.style.padding = "8px 16px";
  el.style.whiteSpace = "nowrap";
  el.style.overflow = "visible";
  if (extraStyles) {
    for (const [k, v] of Object.entries(extraStyles)) {
      (el.style as any)[k] = v;
    }
  }
  return el;
}

/**
 * Measure the true visual bounding box of a container, including all
 * overflowing descendants (e.g. KaTeX SVG delimiters that extend beyond
 * their vlist parents).  Then expand the container so that html2canvas
 * and foreignObject capture the full content without clipping.
 */
function expandContainerToFitOverflow(container: HTMLElement): void {
  const containerRect = container.getBoundingClientRect();

  let minX = containerRect.left;
  let minY = containerRect.top;
  let maxX = containerRect.right;
  let maxY = containerRect.bottom;

  // Measure every descendant's bounding rect
  const descendants = container.querySelectorAll('*');
  descendants.forEach((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    // Skip zero-size elements (hidden, collapsed, etc.)
    if (rect.width === 0 && rect.height === 0) return;
    if (rect.left < minX) minX = rect.left;
    if (rect.top < minY) minY = rect.top;
    if (rect.right > maxX) maxX = rect.right;
    if (rect.bottom > maxY) maxY = rect.bottom;
  });

  // Also check SVGs specifically — their bounding rect may differ
  const svgs = container.querySelectorAll('svg');
  svgs.forEach((svg) => {
    try {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.left < minX) minX = rect.left;
      if (rect.top < minY) minY = rect.top;
      if (rect.right > maxX) maxX = rect.right;
      if (rect.bottom > maxY) maxY = rect.bottom;
    } catch { /* SVG getBoundingClientRect can throw in some browsers */ }
  });

  // Calculate how much the content overflows the container
  const overflowTop = containerRect.top - minY;
  const overflowBottom = maxY - containerRect.bottom;
  const overflowLeft = containerRect.left - minX;
  const overflowRight = maxX - containerRect.right;

  // Expand the container with extra padding to encompass overflow
  if (overflowTop > 0 || overflowBottom > 0 || overflowLeft > 0 || overflowRight > 0) {
    const currentPaddingTop = parseFloat(getComputedStyle(container).paddingTop) || 0;
    const currentPaddingBottom = parseFloat(getComputedStyle(container).paddingBottom) || 0;
    const currentPaddingLeft = parseFloat(getComputedStyle(container).paddingLeft) || 0;
    const currentPaddingRight = parseFloat(getComputedStyle(container).paddingRight) || 0;

    // Add a small safety margin (2px)
    const safetyMargin = 2;
    container.style.paddingTop = `${currentPaddingTop + Math.ceil(overflowTop) + safetyMargin}px`;
    container.style.paddingBottom = `${currentPaddingBottom + Math.ceil(overflowBottom) + safetyMargin}px`;
    container.style.paddingLeft = `${currentPaddingLeft + Math.ceil(overflowLeft) + safetyMargin}px`;
    container.style.paddingRight = `${currentPaddingRight + Math.ceil(overflowRight) + safetyMargin}px`;
  }
}

/**
 * Render an HTML element to a high-res PNG via html2canvas.
 * Waits for fonts to load before capturing.
 */
async function renderToCanvas(container: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  await waitForSpecificFonts();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 200));

  return html2canvas(container, {
    ...HTML2CANVAS_OPTIONS,
    scale,
    windowWidth: container.offsetWidth + 100,
    windowHeight: container.offsetHeight + 100,
    onclone: (clonedDoc) => {
      const clonedContainer = clonedDoc.body.querySelector('[style*="position: fixed"]') as HTMLElement;
      if (clonedContainer) {
        clonedContainer.style.position = 'absolute';
        clonedContainer.style.left = '0';
        clonedContainer.style.top = '0';
        clonedContainer.style.opacity = '1';
      }

      applyKatexCloneFixes(clonedDoc);

      const style = clonedDoc.createElement('style');
      style.textContent = getKatexInlineStyles();
      if (clonedDoc.head.firstChild) {
        clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
      } else {
        clonedDoc.head.appendChild(style);
      }
    },
  });
}

/**
 * Apply fixes to a cloned document (or SVG foreignObject clone) so that
 * html2canvas / foreignObject rasterisation captures KaTeX delimiters
 * correctly.
 *
 * Design principles:
 *  1. NEVER remove or reset KaTeX's `top` offsets inside vlists – they are
 *     the authoritative positioning data for stacked delimiter pieces.
 *  2. NEVER change `display` of vlist spans to `block` – KaTeX relies on
 *     the table-cell / inline-block flow.
 *  3. DO convert SVG `height` attributes from `em` to `px` because
 *     html2canvas cannot resolve `height: inherit` on SVG elements.
 *  4. DO set `overflow: visible` on every container in the clipping chain.
 *  5. DO convert em-based inline widths/heights on SVG wrapper spans to px.
 */
function applyKatexCloneFixes(root: Document | HTMLElement): void {
  // Helper: parse "NNNem" → px
  const emToPx = (emValue: string, baseFontSize: number): number => {
    const match = emValue.match(/^(-?[\d.]+)em$/);
    return match ? parseFloat(match[1]) * baseFontSize : 0;
  };

  // Helper: walk up to find an explicit font-size
  const getFontSize = (el: Element): number => {
    let current: Element | null = el;
    while (current) {
      const style = (current as HTMLElement).style?.fontSize;
      if (style) {
        const pxMatch = style.match(/^([\d.]+)px$/);
        if (pxMatch) return parseFloat(pxMatch[1]);
        const ptMatch = style.match(/^([\d.]+)pt$/);
        if (ptMatch) return parseFloat(ptMatch[1]) * 96 / 72;
      }
      current = current.parentElement;
    }
    return 16;
  };

  // Collect per-katex-root font sizes
  const katexRoots = root.querySelectorAll('.katex');
  const katexFontSizes = new Map<Element, number>();
  katexRoots.forEach((k) => katexFontSizes.set(k, getFontSize(k)));

  // --- Pass 1: Convert SVG em dimensions to px ---
  // html2canvas cannot resolve `height: inherit` on SVGs.  We convert the
  // KaTeX-authored `height="X.XXem"` attribute to an explicit px style
  // while PRESERVING the element's position within its vlist span.
  root.querySelectorAll('.katex svg').forEach((svg) => {
    const svgEl = svg as SVGElement;
    const katexRoot = svg.closest('.katex');
    if (!katexRoot) return;
    const fontSize = katexFontSizes.get(katexRoot) || 16;

    const hAttr = svgEl.getAttribute('height');
    const hPx = hAttr ? emToPx(hAttr, fontSize) : 0;
    if (hPx <= 0) return;

    // Compute width from viewBox aspect ratio
    const viewBox = svgEl.getAttribute('viewBox');
    let wPx = 0;
    if (viewBox) {
      const parts = viewBox.split(' ').map(Number);
      if (parts.length === 4 && parts[3] > 0) {
        wPx = hPx * (parts[2] / parts[3]);
      }
    }

    // Replace em attributes with px styles
    svgEl.style.height = `${hPx}px`;
    svgEl.removeAttribute('height');
    if (wPx > 0) {
      svgEl.style.width = `${wPx}px`;
      svgEl.removeAttribute('width');
    }

    // Convert the immediate parent span's em width/height to px as well
    const parentSpan = svg.parentElement;
    if (parentSpan && parentSpan.tagName === 'SPAN') {
      const ps = (parentSpan as HTMLElement).style;
      const inH = ps.height;
      if (inH && inH.includes('em')) {
        const inHPx = emToPx(inH, fontSize);
        if (inHPx > 0) ps.height = `${inHPx}px`;
      }
      const inW = ps.width;
      if (inW && inW.includes('em')) {
        const inWPx = emToPx(inW, fontSize);
        if (inWPx > 0) ps.width = `${inWPx}px`;
      }
      ps.overflow = 'visible';
    }
  });

  // --- Pass 2: overflow:visible on the entire clipping chain ---
  // NOTE: .stretchy and .hide-tail are intentionally EXCLUDED — they use
  // overflow:hidden to clip 400em-wide SVGs horizontally.  Their vertical
  // overflow is handled by expandContainerToFitOverflow() instead.
  const overflowSelectors = [
    '.katex',
    '.katex-html',
    '.base',
    '.strut',
    '.minner',
    '.mopen',
    '.mclose',
    '.mord',
    '.delimsizing',
    '.delimsizing.mult',
    '.delimcenter',
    '.nulldelimiter',
    '.vlist-t',
    '.vlist-t2',
    '.vlist-r',
    '.vlist-s',
    '.vlist',
    '.vlist > span',
    '.mtable',
    '.svg-align',
    '.pstrut',
    '.arraycolsep',
    '.col-align-c',
    '.col-align-l',
    '.col-align-r',
  ];
  overflowSelectors.forEach((sel) => {
    root.querySelectorAll(sel).forEach((el) => {
      (el as HTMLElement).style.overflow = 'visible';
    });
  });

  // --- Pass 3: Convert em-based top/height on vlist > span to px ---
  // KaTeX positions each row of a vlist with `top: -X.XXem`.  html2canvas
  // sometimes mis-resolves em units in cloned documents, so convert to px.
  root.querySelectorAll('.vlist > span').forEach((span) => {
    const el = span as HTMLElement;
    const katexRoot = span.closest('.katex');
    const fontSize = katexRoot ? katexFontSizes.get(katexRoot) || 16 : 16;

    const topVal = el.style.top;
    if (topVal && topVal.includes('em')) {
      const topPx = emToPx(topVal, fontSize);
      el.style.top = `${topPx}px`;
    }
  });

  // --- Pass 4: Convert vlist inline height from em to px ---
  root.querySelectorAll('.vlist').forEach((vlist) => {
    const el = vlist as HTMLElement;
    const katexRoot = vlist.closest('.katex');
    const fontSize = katexRoot ? katexFontSizes.get(katexRoot) || 16 : 16;

    const hVal = el.style.height;
    if (hVal && hVal.includes('em')) {
      const hPx = emToPx(hVal, fontSize);
      if (hPx > 0) el.style.height = `${hPx}px`;
    }
  });

  // --- Pass 5: Convert pstrut heights from em to px ---
  root.querySelectorAll('.pstrut').forEach((pstrut) => {
    const el = pstrut as HTMLElement;
    const katexRoot = pstrut.closest('.katex');
    const fontSize = katexRoot ? katexFontSizes.get(katexRoot) || 16 : 16;

    const hVal = el.style.height;
    if (hVal && hVal.includes('em')) {
      const hPx = emToPx(hVal, fontSize);
      if (hPx > 0) el.style.height = `${hPx}px`;
    }
  });

  // --- Pass 6: Convert strut heights from em to px ---
  root.querySelectorAll('.strut').forEach((strut) => {
    const el = strut as HTMLElement;
    const katexRoot = strut.closest('.katex');
    const fontSize = katexRoot ? katexFontSizes.get(katexRoot) || 16 : 16;

    const hVal = el.style.height;
    if (hVal && hVal.includes('em')) {
      const hPx = emToPx(hVal, fontSize);
      if (hPx > 0) el.style.height = `${hPx}px`;
    }
  });

  // --- Pass 7: Fix .delimsizing.mult (multi-part braces) ---
  // These use font-based Unicode characters (⎧⎨⎩ etc.) stacked via vlist.
  // We must NOT alter the vlist structure — just ensure visibility and
  // convert any remaining em units.
  root.querySelectorAll('.delimsizing.mult').forEach((delim) => {
    const el = delim as HTMLElement;
    el.style.overflow = 'visible';
    el.style.display = 'inline-block';
    el.style.verticalAlign = 'middle';

    // Ensure delimsizinginner spans are visible
    delim.querySelectorAll('.delimsizinginner').forEach((inner) => {
      (inner as HTMLElement).style.overflow = 'visible';
    });
  });
}

/**
 * Validate that a rendered canvas produced meaningful content.
 * Samples multiple regions across the canvas to avoid missing content
 * that falls outside a single corner.
 */
function isCanvasValid(canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const stripH = Math.min(8, Math.floor(canvas.height / 4));
  const positions = [
    0,
    Math.floor(canvas.height * 0.25),
    Math.floor(canvas.height * 0.5),
    Math.floor(canvas.height * 0.75),
  ];

  for (const yPos of positions) {
    if (yPos + stripH > canvas.height) continue;
    const w = Math.min(canvas.width, 600);
    try {
      const data = ctx.getImageData(0, yPos, w, stripH).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
          return true;
        }
      }
    } catch {
      continue;
    }
  }
  return false;
}

function collectAllCSS(): string {
  if (katexCssText) return katexCssText;
  
  let cssText = "";
  const styleSheets = Array.from(document.styleSheets);
  
  for (const sheet of styleSheets) {
    try {
      const rules = sheet.cssRules || sheet.rules;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        cssText += rule.cssText + "\n";
        
        if (rule.type === CSSRule.MEDIA_RULE) {
          const mediaRules = (rule as CSSMediaRule).cssRules;
          for (let j = 0; j < mediaRules.length; j++) {
            cssText += mediaRules[j].cssText + "\n";
          }
        }
      }
    } catch (e) {
      // Cross-origin stylesheet — skip but log
      console.debug("Could not access stylesheet:", sheet.href, e);
    }
  }
  
  katexCssText = cssText;
  return cssText;
}

function getKatexInlineStyles(): string {
  return `
    .katex { font: normal 1.21em KaTeX_Main, Times New Roman, serif; line-height: 1.2; text-indent: 0; text-rendering: auto; }
    .katex * { -ms-high-contrast-adjust: none !important; border-color: currentColor; }
    .katex .katex-mathml { position: absolute; clip: rect(1px,1px,1px,1px); padding: 0; border: 0; height: 1px; width: 1px; overflow: hidden; }
    .katex .katex-html > .newline { display: block; }
    .katex .base { position: relative; display: inline-block; white-space: nowrap; width: -webkit-min-content; width: -moz-min-content; width: min-content; }
    .katex .strut { display: inline-block; }
    .katex .textbf { font-weight: bold; }
    .katex .textit { font-style: italic; }
    .katex .textrm { font-family: KaTeX_Main; }
    .katex .mathnormal { font-family: KaTeX_Math; font-style: italic; }
    .katex .mathit { font-family: KaTeX_Main; font-style: italic; }
    .katex .mathrm { font-style: normal; }
    .katex .mathbf { font-family: KaTeX_Main; font-weight: bold; }
    .katex .boldsymbol { font-family: KaTeX_Math; font-weight: bold; font-style: italic; }
    .katex .amsrm { font-family: KaTeX_AMS; }
    .katex .mainrm { font-family: KaTeX_Main; font-style: normal; }
    .katex .mathsf, .katex .textsf { font-family: KaTeX_SansSerif; }
    .katex .mathbb, .katex .textbb { font-family: KaTeX_AMS; }
    .katex .mathcal { font-family: KaTeX_Caligraphic; }
    .katex .mathfrak, .katex .textfrak { font-family: KaTeX_Fraktur; }
    .katex .mathboldfrak, .katex .textboldfrak { font-family: KaTeX_Fraktur; font-weight: bold; }
    .katex .mathtt { font-family: KaTeX_Typewriter; }
    .katex .texttt { font-family: KaTeX_Typewriter; }
    .katex .mathscr, .katex .textscr { font-family: KaTeX_Script; }
    .katex .mathboldsf, .katex .textboldsf { font-family: KaTeX_SansSerif; font-weight: bold; }
    .katex .mathsfit, .katex .mathitsf, .katex .textitsf { font-family: KaTeX_SansSerif; font-style: italic; }
    .katex .vlist-t { display: inline-table; table-layout: fixed; border-collapse: collapse; }
    .katex .vlist-t2 { margin-right: -2px; }
    .katex .vlist-r { display: table-row; }
    .katex .vlist { display: table-cell; vertical-align: bottom; position: relative; }
    .katex .vlist > span { display: block; height: 0; position: relative; }
    .katex .vlist > span > span { display: inline-block; }
    .katex .vlist > span > .pstrut { overflow: hidden; width: 0; }
    .katex .vlist-s { display: table-cell; vertical-align: bottom; font-size: 1px; width: 2px; min-width: 2px; }
    .katex .vbox { display: inline-flex; flex-direction: column; align-items: baseline; }
    .katex .hbox { display: inline-flex; flex-direction: row; width: 100%; }
    .katex .thinbox { display: inline-flex; flex-direction: row; width: 0; max-width: 0; }
    .katex .msupsub { text-align: left; }
    .katex .mfrac > span > span { text-align: center; }
    .katex .mfrac .frac-line { display: inline-block; width: 100%; border-bottom-style: solid; }
    .katex .mspace { display: inline-block; }
    .katex .llap, .katex .rlap, .katex .clap { width: 0; position: relative; }
    .katex .llap > .inner, .katex .rlap > .inner, .katex .clap > .inner { position: absolute; }
    .katex .llap > .fix, .katex .rlap > .fix, .katex .clap > .fix { display: inline-block; }
    .katex .llap > .inner { right: 0; }
    .katex .rlap > .inner, .katex .clap > .inner { left: 0; }
    .katex .clap > .inner > span { margin-left: -50%; margin-right: 50%; }
    .katex .rule { display: inline-block; border: solid 0; position: relative; }
    .katex .overline .overline-line, .katex .underline .underline-line { display: inline-block; width: 100%; border-bottom-style: solid; }
    .katex .hline { display: inline-block; width: 100%; border-bottom-style: solid; }
    .katex .hdashline { display: inline-block; width: 100%; border-bottom-style: dashed; }
    .katex .mfrac .frac-line, .katex .overline .overline-line, .katex .underline .underline-line, .katex .hline, .katex .hdashline, .katex .rule { min-height: 1px; }
    .katex .sqrt > .root { margin-left: 0.27777em; margin-right: -0.55555em; }
    .katex .sizing, .katex .fontsize-ensurer { display: inline-block; }
    .katex .sizing.reset-size1.size1, .katex .fontsize-ensurer.reset-size1.size1 { font-size: 1em; }
    .katex .sizing.reset-size1.size2, .katex .fontsize-ensurer.reset-size1.size2 { font-size: 1.2em; }
    .katex .sizing.reset-size1.size3, .katex .fontsize-ensurer.reset-size1.size3 { font-size: 1.4em; }
    .katex .sizing.reset-size1.size4, .katex .fontsize-ensurer.reset-size1.size4 { font-size: 1.6em; }
    .katex .sizing.reset-size1.size5, .katex .fontsize-ensurer.reset-size1.size5 { font-size: 1.8em; }
    .katex .sizing.reset-size1.size6, .katex .fontsize-ensurer.reset-size1.size6 { font-size: 2em; }
    .katex .sizing.reset-size1.size7, .katex .fontsize-ensurer.reset-size1.size7 { font-size: 2.4em; }
    .katex .sizing.reset-size1.size8, .katex .fontsize-ensurer.reset-size1.size8 { font-size: 2.88em; }
    .katex .sizing.reset-size1.size9, .katex .fontsize-ensurer.reset-size1.size9 { font-size: 3.456em; }
    .katex .sizing.reset-size1.size10, .katex .fontsize-ensurer.reset-size1.size10 { font-size: 4.148em; }
    .katex .sizing.reset-size1.size11, .katex .fontsize-ensurer.reset-size1.size11 { font-size: 4.976em; }
    .katex .delimsizing { position: relative; }
    .katex .delimsizing.size1 { font-family: KaTeX_Size1; }
    .katex .delimsizing.size2 { font-family: KaTeX_Size2; }
    .katex .delimsizing.size3 { font-family: KaTeX_Size3; }
    .katex .delimsizing.size4 { font-family: KaTeX_Size4; }
    .katex .delimsizing.mult .delim-size1 > span { font-family: KaTeX_Size1; }
    .katex .delimsizing.mult .delim-size4 > span { font-family: KaTeX_Size4; }
    .katex .delimcenter { position: relative; }
    .katex .nulldelimiter { display: inline-block; width: 0.12em; }
    .katex .op-symbol { position: relative; }
    .katex .op-symbol.small-op { font-family: KaTeX_Size1; }
    .katex .op-symbol.large-op { font-family: KaTeX_Size2; }
    .katex .op-limits > .vlist-t { text-align: center; }
    .katex .accent > .vlist-t { text-align: center; }
    .katex .accent .accent-body { position: relative; }
    .katex .accent .accent-body:not(.accent-full) { width: 0; }
    .katex .overlay { display: block; }
    .katex .mtable .vertical-separator { display: inline-block; min-width: 1px; }
    .katex .mtable .arraycolsep { display: inline-block; }
    .katex .mtable .col-align-c > .vlist-t { text-align: center; }
    .katex .mtable .col-align-l > .vlist-t { text-align: left; }
    .katex .mtable .col-align-r > .vlist-t { text-align: right; }
    .katex .svg-align { text-align: left; }
    .katex svg { display: block; position: absolute; width: 100%; height: inherit; fill: currentColor; stroke: currentColor; fill-rule: nonzero; fill-opacity: 1; stroke-width: 1; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 4; stroke-dasharray: none; stroke-dashoffset: 0; stroke-opacity: 1; }
    .katex svg path { stroke: none; }
    .katex img { border-style: none; min-width: 0; min-height: 0; max-width: none; max-height: none; }
    .katex .stretchy { width: 100%; display: block; position: relative; overflow: hidden; }
    .katex .stretchy::before, .katex .stretchy::after { content: ""; }
    .katex .hide-tail { width: 100%; position: relative; overflow: hidden; }
    .katex .halfarrow-left { position: absolute; left: 0; width: 50.2%; overflow: hidden; }
    .katex .halfarrow-right { position: absolute; right: 0; width: 50.2%; overflow: hidden; }
    .katex .brace-left { position: absolute; left: 0; width: 25.1%; overflow: hidden; }
    .katex .brace-center { position: absolute; left: 25%; width: 50%; overflow: hidden; }
    .katex .brace-right { position: absolute; right: 0; width: 25.1%; overflow: hidden; }
    .katex .x-arrow-pad { padding: 0 0.5em; }
    .katex .cd-arrow-pad { padding: 0 0.55556em 0 0.27778em; }
    .katex .x-arrow, .katex .mover, .katex .munder { text-align: center; }
    .katex .boxpad { padding: 0 0.3em; }
    .katex .fbox, .katex .fcolorbox { box-sizing: border-box; border: 0.04em solid; }
    .katex .cancel-pad { padding: 0 0.2em; }
    .katex .cancel-lap { margin-left: -0.2em; margin-right: -0.2em; }
    .katex .sout { border-bottom-style: solid; border-bottom-width: 0.08em; }
    .katex .angl { box-sizing: border-box; border-top: 0.049em solid; border-right: 0.049em solid; margin-right: 0.03889em; }
    .katex .anglpad { padding: 0 0.03889em; }
    .katex .eqn-num::before { counter-increment: katexEqnNo; content: "(" counter(katexEqnNo) ")"; }
    .katex .mml-eqn-num::before { counter-increment: mmlEqnNo; content: "(" counter(mmlEqnNo) ")"; }
    .katex .mtr-glue { width: 50%; }
    .katex .cd-vert-arrow { display: inline-block; position: relative; }
    .katex .cd-label-left { display: inline-block; position: absolute; right: calc(50% + 0.3em); text-align: left; }
    .katex .cd-label-right { display: inline-block; position: absolute; left: calc(50% + 0.3em); text-align: right; }
    .katex-display { display: block; margin: 1em 0; text-align: center; }
    .katex-display > .katex { display: block; text-align: center; white-space: nowrap; }
    .katex-display > .katex > .katex-html { display: block; position: relative; }
    .katex-display > .katex > .katex-html > .tag { position: absolute; right: 0; }
    .katex-display.leqno > .katex > .katex-html > .tag { left: 0; right: auto; }
    .katex-display.fleqn > .katex { text-align: left; padding-left: 2em; }
    .katex .mlabel { position: relative; }
    .katex .mtable .mlabel { position: static; }
    body { counter-reset: katexEqnNo mmlEqnNo; }

    /* --- SlideMD fixes --- */

    /* Fix inline math font size: KaTeX defaults to 1.21em which makes inline
       math ~21% larger than surrounding text. Normalize to 1em inside mixed
       text+math paragraphs so they visually match. */
    .slidemd-mixed > .katex { font-size: 1em; }
    /* Keep display-mode math ($$...$$) at the standard KaTeX size */
    .slidemd-mixed > .katex-display > .katex { font-size: 1.21em; }

    /* Baseline alignment for inline KaTeX with CJK text. */
    .slidemd-mixed > .katex {
      vertical-align: -0.2ex;
      position: relative;
      top: -0.1ex;
    }
    .slidemd-mixed > .katex .base {
      line-height: inherit;
    }
    .slidemd-mixed > .katex-display { vertical-align: baseline; }

    /* Prevent clipping throughout the KaTeX element tree.
       This is the ONLY layout override we apply — everything else
       (display, position, top, height) is left to KaTeX.
       NOTE: .stretchy and .hide-tail are intentionally excluded —
       they use overflow:hidden to clip 400em-wide SVGs horizontally. */
    .katex .delimsizing,
    .katex .delimsizing.mult,
    .katex .delimcenter,
    .katex .minner,
    .katex .mopen,
    .katex .mclose,
    .katex .mord,
    .katex .base,
    .katex .strut,
    .katex .pstrut,
    .katex .vlist,
    .katex .vlist-t,
    .katex .vlist-t2,
    .katex .vlist-r,
    .katex .vlist-s,
    .katex .vlist > span,
    .katex .mtable,
    .katex .arraycolsep,
    .katex .col-align-c,
    .katex .col-align-l,
    .katex .col-align-r,
    .katex .svg-align,
    .katex .delimsizing.mult .vlist > span,
    .katex .delimsizinginner,
    .katex .nulldelimiter {
      overflow: visible !important;
    }

    /* Ensure SVG paths in delimiters are painted */
    .katex svg path { fill: currentColor; stroke: none; }
  `;
}

async function renderViaForeignObject(
  container: HTMLElement,
  scale: number
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  await waitForSpecificFonts();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 200));

  const width = container.offsetWidth;
  const height = container.offsetHeight;
  if (width === 0 || height === 0) {
    throw new Error("Container has zero dimensions");
  }

  const collectedCSS = collectAllCSS();
  const inlineKatexStyles = getKatexInlineStyles();
  const cssText = inlineKatexStyles + "\n" + collectedCSS;

  const clone = container.cloneNode(true) as HTMLElement;
  clone.style.position = "static";
  clone.style.opacity = "1";
  clone.style.left = "";
  clone.style.top = "";
  clone.style.background = "white";

  // Apply the shared KaTeX clone fixes (em→px conversion, overflow:visible)
  applyKatexCloneFixes(clone);

  const svgNS = "http://www.w3.org/2000/svg";
  const xhtmlNS = "http://www.w3.org/1999/xhtml";
  const svgWidth = width * scale;
  const svgHeight = height * scale;

  const escapedCSS = cssText
    .replace(/</g, "\\3c ")
    .replace(/>/g, "\\3e ")
    .replace(/&/g, "\\26 ");

  const svgMarkup = `<svg xmlns="${svgNS}" width="${svgWidth}" height="${svgHeight}">
    <foreignObject width="100%" height="100%" style="transform:scale(${scale});transform-origin:0 0;">
      <div xmlns="${xhtmlNS}" style="background:white;">
        <style>${escapedCSS}</style>
        ${clone.outerHTML}
      </div>
    </foreignObject>
  </svg>`;

  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = svgWidth;
      canvas.height = svgHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Cannot get 2d context")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, svgWidth, svgHeight);
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      console.error("SVG foreignObject image load failed:", e);
      reject(new Error("SVG foreignObject image load failed"));
    };
    img.src = url;
  });
}

/**
 * Render LaTeX to a high-res PNG via KaTeX + html2canvas (with SVG
 * foreignObject fallback). Returns base64 data URL and dimensions in
 * points. Retries on failure to handle transient font-loading issues.
 */
export async function renderMath(
  latex: string,
  displayMode: boolean,
  fontSize: number = 18
): Promise<MathRenderResult> {
  const scale = getRenderScale();
  const quality = getRenderQuality();
  const cacheKey = `${latex}|${displayMode}|${fontSize}|${scale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await preloadMathFonts();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * attempt;
      await new Promise((r) => setTimeout(r, delay));
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const container = createOffscreenContainer({
      fontSize: `${fontSize}pt`,
      lineHeight: "1.4",
      padding: "12px 20px",
    });
    document.body.appendChild(container);

    try {
      const html = katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: "html",
        strict: false,
        trust: true,
      });

      if (html.includes("katex-error")) {
        console.warn(`KaTeX parse error for: ${latex.substring(0, 80)}`);
      }

      container.innerHTML = html;

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 50));

      // Expand container to encompass any overflowing KaTeX content
      // (e.g. tall SVG delimiters that extend beyond their vlist parents)
      expandContainerToFitOverflow(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      let canvas: HTMLCanvasElement;
      try {
        canvas = await renderToCanvas(container, scale);
        if (!isCanvasValid(canvas)) {
          canvas = await renderViaForeignObject(container, scale);
        }
      } catch {
        canvas = await renderViaForeignObject(container, scale);
      }

      if (!isCanvasValid(canvas)) {
        lastError = new Error("Canvas rendered blank");
        continue;
      }

      const croppedCanvas = autoCropCanvas(canvas);
      const base64 = canvasToBase64(croppedCanvas, quality);
      const widthPt = pixelsToPoints(croppedCanvas.width, scale);
      const heightPt = pixelsToPoints(croppedCanvas.height, scale);

      const result: MathRenderResult = { base64, widthPt, heightPt };
      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Math render attempt ${attempt + 1} failed:`, lastError.message);
    } finally {
      if (container.parentNode) document.body.removeChild(container);
    }
  }

  throw lastError || new Error("Math rendering failed after retries");
}

/**
 * Dynamically calibrate inline math baseline alignment.
 *
 * Measures the actual baseline difference between the container's body font
 * and KaTeX_Main by rendering a probe element, then applies per-element
 * corrections to all inline .katex elements in the container.
 *
 * This handles the fundamental problem that CJK fonts (e.g. 微软雅黑) and
 * KaTeX_Main have very different ascender/descender ratios, making CSS
 * `vertical-align: baseline` visually misaligned.
 */
function calibrateInlineMathBaseline(
  container: HTMLElement,
  fontFamily: string,
  fontSize: number
): void {
  // Create a probe to measure baseline positions of both fonts
  const probe = document.createElement("span");
  probe.style.cssText = `
    position: absolute; left: 0; top: 0; opacity: 0; pointer-events: none;
    font-size: ${fontSize}pt; line-height: 1.6; white-space: nowrap;
  `;
  // Use an inline-block span for each font to measure their baselines
  probe.innerHTML = `
    <span id="__sm_probe_text" style="font-family: ${fontFamily}, sans-serif; display: inline;">Ag中文</span>
    <span id="__sm_probe_math" style="font-family: KaTeX_Main, serif; display: inline; font-size: 1em;">Ag</span>
  `;
  container.appendChild(probe);

  const textEl = probe.querySelector("#__sm_probe_text") as HTMLElement;
  const mathEl = probe.querySelector("#__sm_probe_math") as HTMLElement;

  if (textEl && mathEl) {
    const textRect = textEl.getBoundingClientRect();
    const mathRect = mathEl.getBoundingClientRect();

    // The baseline offset is approximated by comparing the bottom edges
    // of the two font probes (since both sit on the same baseline,
    // the difference in bottom position reflects descender difference).
    const baselineDiff = mathRect.bottom - textRect.bottom;

    // Only apply correction if the difference is meaningful (> 0.5px)
    if (Math.abs(baselineDiff) > 0.5) {
      const katexElements = container.querySelectorAll(":scope > .katex");
      katexElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Shift the KaTeX element up by the measured baseline difference
        htmlEl.style.position = "relative";
        htmlEl.style.top = `${-baselineDiff}px`;
        // Reset the CSS vertical-align since we're using position correction
        htmlEl.style.verticalAlign = "baseline";
      });
    }
  }

  container.removeChild(probe);
}

/**
 * Render a mixed paragraph (text + inline math) as a single high-res PNG.
 * Uses html2canvas with SVG foreignObject fallback.
 * 
 * NOTE: Auto-wrapping is DISABLED. Text will only wrap at explicit [br] markers
 * (converted to <br> tags). Long text without [br] will overflow the container.
 */
export async function renderMixedParagraph(
  html: string,
  fontSize: number = 18,
  fontFamily: string = "微软雅黑",
  maxWidthPx: number = 800,
  fontColor: string = "#333333"
): Promise<MathRenderResult> {
  const scale = getRenderScale();
  const quality = getRenderQuality();

  await preloadMathFonts();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * attempt;
      await new Promise((r) => setTimeout(r, delay));
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const container = createOffscreenContainer({
      fontSize: `${fontSize}pt`,
      fontFamily,
      color: fontColor,
      lineHeight: "1.6",
      whiteSpace: "nowrap",
    });
    container.classList.add("slidemd-mixed");
    document.body.appendChild(container);

    try {
      container.innerHTML = html;

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 50));

      // Dynamic baseline calibration: measure the actual baseline offset
      // between the body font and KaTeX elements, then apply correction.
      calibrateInlineMathBaseline(container, fontFamily, fontSize);

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 30));

      // Expand container to encompass any overflowing KaTeX content
      expandContainerToFitOverflow(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      let canvas: HTMLCanvasElement;
      try {
        canvas = await renderToCanvas(container, scale);
        if (!isCanvasValid(canvas)) {
          canvas = await renderViaForeignObject(container, scale);
        }
      } catch {
        canvas = await renderViaForeignObject(container, scale);
      }

      if (!isCanvasValid(canvas)) {
        lastError = new Error("Mixed paragraph canvas rendered blank");
        continue;
      }

      const croppedCanvas = autoCropCanvas(canvas);
      const base64 = canvasToBase64(croppedCanvas, quality);
      const widthPt = pixelsToPoints(croppedCanvas.width, scale);
      const heightPt = pixelsToPoints(croppedCanvas.height, scale);

      return { base64, widthPt, heightPt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Mixed paragraph render attempt ${attempt + 1} failed:`, lastError.message);
    } finally {
      if (container.parentNode) document.body.removeChild(container);
    }
  }

  throw lastError || new Error("Mixed paragraph rendering failed after retries");
}

export function clearMathCache(): void {
  cache.clear();
}
