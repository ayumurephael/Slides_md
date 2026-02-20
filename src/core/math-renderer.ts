import katex from "katex";
import html2canvas from "html2canvas";
import type { MathRenderResult } from "../types/ir";

const cache = new Map<string, MathRenderResult>();

const RENDER_SCALE = 5; // 5x for ≥330 DPI (theoretical 480 DPI)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 200;

/** Track whether KaTeX fonts have been preloaded */
let fontsReady = false;

/**
 * Preload KaTeX fonts by rendering a test formula and waiting for fonts.
 * Call once at startup to warm the font cache.
 */
export async function preloadMathFonts(): Promise<void> {
  if (fontsReady) return;
  try {
    // Render a test formula to trigger font loading
    const testDiv = document.createElement("div");
    testDiv.style.cssText = "position:absolute;left:-9999px;top:0;font-size:16pt;";
    testDiv.innerHTML = katex.renderToString("x^2+y^2=z^2", {
      displayMode: false,
      throwOnError: false,
      output: "html",
    });
    document.body.appendChild(testDiv);

    // Wait for all fonts (including KaTeX fonts) to finish loading
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    // Additional delay to ensure fonts are fully rasterizable
    await new Promise((r) => setTimeout(r, 100));

    document.body.removeChild(testDiv);
    fontsReady = true;
  } catch (e) {
    console.warn("KaTeX font preload failed:", e);
    // Continue anyway — rendering may still work with fallback fonts
  }
}

/**
 * Wait for fonts to be ready before rasterization.
 */
async function ensureFontsReady(): Promise<void> {
  if (!fontsReady) {
    await preloadMathFonts();
  }
  // Always wait for document.fonts.ready as a safety net
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/**
 * Render an HTML element to a high-res PNG via html2canvas.
 * Waits for fonts to load before capturing.
 */
async function renderToCanvas(container: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  return html2canvas(container, {
    scale,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
  });
}

/**
 * Validate that a rendered canvas produced meaningful content.
 * A blank/white-only canvas indicates a rendering failure.
 */
function isCanvasValid(canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) return false;
  // Sample a few pixels to check if there's any non-white content
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
  for (let i = 0; i < data.length; i += 4) {
    // Check if any pixel is not white (R=255, G=255, B=255)
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
      return true;
    }
  }
  return false;
}

/**
 * Render LaTeX to a high-res PNG via KaTeX + html2canvas.
 * Returns base64 data URL and dimensions in points.
 * Retries on failure to handle transient font-loading issues.
 */
export async function renderMath(
  latex: string,
  displayMode: boolean,
  fontSize: number = 18
): Promise<MathRenderResult> {
  const cacheKey = `${latex}|${displayMode}|${fontSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Wait before retry, giving fonts more time to load
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      // Force re-check font readiness
      if (document.fonts?.ready) await document.fonts.ready;
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.fontSize = `${fontSize}pt`;
    container.style.lineHeight = "1.4";
    container.style.padding = "4px 8px";
    container.style.background = "white";
    document.body.appendChild(container);

    try {
      const html = katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: "html",
      });

      // Check if KaTeX returned an error span (class "katex-error")
      if (html.includes("katex-error")) {
        console.warn(`KaTeX parse error for: ${latex.substring(0, 80)}`);
      }

      container.innerHTML = html;

      const canvas = await renderToCanvas(container, RENDER_SCALE);

      if (!isCanvasValid(canvas)) {
        lastError = new Error("Canvas rendered blank — fonts may not be loaded");
        continue;
      }

      const base64 = canvas.toDataURL("image/png");
      const widthPt = canvas.width / RENDER_SCALE / 1.333;
      const heightPt = canvas.height / RENDER_SCALE / 1.333;

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
 * Retries on failure to handle transient font-loading issues.
 */
export async function renderMixedParagraph(
  html: string,
  fontSize: number = 18,
  fontFamily: string = "微软雅黑",
  maxWidthPx: number = 800,
  fontColor: string = "#333333"
): Promise<MathRenderResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      if (document.fonts?.ready) await document.fonts.ready;
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.fontSize = `${fontSize}pt`;
    container.style.fontFamily = fontFamily;
    container.style.color = fontColor;
    container.style.lineHeight = "1.6";
    container.style.padding = "4px 8px";
    container.style.background = "white";
    container.style.maxWidth = `${maxWidthPx}px`;
    document.body.appendChild(container);

    try {
      container.innerHTML = html;

      const canvas = await renderToCanvas(container, RENDER_SCALE);

      if (!isCanvasValid(canvas)) {
        lastError = new Error("Mixed paragraph canvas rendered blank");
        continue;
      }

      const base64 = canvas.toDataURL("image/png");
      const widthPt = canvas.width / RENDER_SCALE / 1.333;
      const heightPt = canvas.height / RENDER_SCALE / 1.333;

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
