import katex from "katex";
import html2canvas from "html2canvas";
import type { MathRenderResult } from "../types/ir";
import {
  getRenderScale,
  getRenderQuality,
  HTML2CANVAS_OPTIONS,
  canvasToBase64,
  pixelsToPoints,
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
  if (extraStyles) {
    for (const [k, v] of Object.entries(extraStyles)) {
      (el.style as any)[k] = v;
    }
  }
  return el;
}

/**
 * Render an HTML element to a high-res PNG via html2canvas.
 * Waits for fonts to load before capturing.
 */
async function renderToCanvas(container: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  await waitForSpecificFonts();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));

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
      
      const style = clonedDoc.createElement('style');
      style.textContent = getKatexInlineStyles();
      clonedDoc.head.appendChild(style);
    },
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
    .katex { font-size: 1em; line-height: 1.2; text-indent: 0; text-rendering: auto; }
    .katex * { -ms-high-contrast-adjust: none; border-color: currentColor; }
    .katex .katex-html { display: inline-block; }
    .katex .base { position: relative; display: inline-block; white-space: nowrap; width: min-content; }
    .katex .strut { display: inline-block; }
    .katex .textbf { font-weight: bold; }
    .katex .textit { font-style: italic; }
    .katex .textrm { font-family: KaTeX_Main; }
    .katex .mathsf { font-family: KaTeX_SansSerif; }
    .katex .textsf { font-family: KaTeX_SansSerif; }
    .katex .mathbb { font-family: KaTeX_AMS; }
    .katex .mathcal { font-family: KaTeX_Caligraphic; }
    .katex .mathfrak { font-family: KaTeX_Fraktur; }
    .katex .mathtt { font-family: KaTeX_Typewriter; }
    .katex .texttt { font-family: KaTeX_Typewriter; }
    .katex .mathscr { font-family: KaTeX_Script; }
    .katex .vlist-t { display: inline-table; table-layout: fixed; border-collapse: collapse; }
    .katex .vlist-r { display: table-row; }
    .katex .vlist { display: table-cell; vertical-align: bottom; position: relative; }
    .katex .vlist > span { display: block; height: 0; position: relative; }
    .katex .mord, .katex .mbin, .katex .mrel, .katex .mopen, .katex .mclose, .katex .mpunct, .katex .mfrac, .katex .mspace, .katex .msubsup, .katex .munderover, .katex .mop, .katex .mi, .katex .mn, .katex .mo, .katex .mtext { display: inline-block; }
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
    .katex .delimsizinginner { display: inline-block; }
    .katex .delim-size1 { font-family: KaTeX_Size1; }
    .katex .delim-size2 { font-family: KaTeX_Size2; }
    .katex .delim-size3 { font-family: KaTeX_Size3; }
    .katex .delim-size4 { font-family: KaTeX_Size4; }
    .katex .nulldelimiter { display: inline-block; }
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
    .katex .cd-arrow-pad { padding: 0 0.5556em; }
    .katex .mover, .katex .munder { text-align: center; }
    .katex .boxpad { padding: 0 0.3em; }
    .katex .fbox, .katex .fcolorbox { box-sizing: border-box; border: 0.04em solid; }
    .katex .cancel-pad { padding: 0 0.2em; }
    .katex .cancel-lap { margin-left: -0.2em; margin-right: -0.2em; }
    .katex .sout { border-bottom-style: solid; border-bottom-width: 0.08em; }
    .katex .angl { padding-right: 0.2778em; padding-left: 0; border-right: 0.049em solid; border-top: 0.049em solid; }
    .katex .anglpad { padding: 0 0.1111em; }
    .katex .eqn-num::before { counter-increment: katexEqnNo; content: "(" counter(katexEqnNo) ")"; }
    .katex .mlabel { position: relative; }
    .katex .mtable .mlabel { position: static; }
    .katex-eqn-num { counter-reset: katexEqnNo; }
  `;
}

async function renderViaForeignObject(
  container: HTMLElement,
  scale: number
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  await waitForSpecificFonts();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));

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

      const base64 = canvasToBase64(canvas, quality);
      const widthPt = pixelsToPoints(canvas.width, scale);
      const heightPt = pixelsToPoints(canvas.height, scale);

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
 * Render a mixed paragraph (text + inline math) as a single high-res PNG.
 * Uses html2canvas with SVG foreignObject fallback.
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
      maxWidth: `${maxWidthPx}px`,
      whiteSpace: "normal",
    });
    document.body.appendChild(container);

    try {
      container.innerHTML = html;

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 50));

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

      const base64 = canvasToBase64(canvas, quality);
      const widthPt = pixelsToPoints(canvas.width, scale);
      const heightPt = pixelsToPoints(canvas.height, scale);

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
