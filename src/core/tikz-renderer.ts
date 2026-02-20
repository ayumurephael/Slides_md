import html2canvas from "html2canvas";
import {
  getRenderScale,
  getRenderQuality,
  HTML2CANVAS_OPTIONS,
  canvasToBase64Raw,
  pixelsToPoints,
} from "./render-config";

export interface TikZRenderResult {
  base64: string; // raw base64 (no data URL prefix)
  widthPt: number;
  heightPt: number;
}

const TIKZJAX_TIMEOUT = 45000;
const cache = new Map<string, TikZRenderResult>();

/**
 * Render TikZ code to a PNG image.
 *
 * Strategy: compile TikZ → SVG inside a hidden iframe where tikzjax
 * is loaded fresh and processes the element on its initial scan.
 * Then rasterise the SVG → PNG via html2canvas in the main document.
 */
export async function renderTikZ(code: string): Promise<TikZRenderResult> {
  const cached = cache.get(code);
  if (cached) return cached;

  let tikzCode = code.trim();
  if (!tikzCode.includes("\\begin{tikzpicture}")) {
    tikzCode = `\\begin{tikzpicture}\n${tikzCode}\n\\end{tikzpicture}`;
  }

  const svg = await compileTikZToSVG(tikzCode);
  const result = await svgToPng(svg);
  cache.set(code, result);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Compile TikZ → SVG via iframe-isolated tikzjax                    */
/* ------------------------------------------------------------------ */

/**
 * tikzjax only processes <script type="text/tikz"> elements that exist
 * when it first loads.  To render on-demand we spin up a hidden iframe
 * whose HTML already contains both the TikZ source and the tikzjax
 * <script> tag, so tikzjax's initial scan picks it up every time.
 */
async function compileTikZToSVG(tikzCode: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;height:600px;border:none;";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);

    let settled = false;
    let onMessage: ((ev: MessageEvent) => void) | null = null;

    const cleanup = () => {
      if (onMessage) {
        window.removeEventListener("message", onMessage);
        onMessage = null;
      }
      if (iframe.parentNode) document.body.removeChild(iframe);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("TikZ 渲染超时（tikzjax 未能在规定时间内完成编译）"));
      }
    }, TIKZJAX_TIMEOUT);

    // Listen for the iframe to post the SVG back
    onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframe.contentWindow) return;
      const data = ev.data;
      if (data?.type === "tikz-svg" && !settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(data.svg as string);
      } else if (data?.type === "tikz-error" && !settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error(data.message || "TikZ 编译失败"));
      }
    };
    window.addEventListener("message", onMessage);

    // Escape the TikZ code for safe embedding in HTML
    const escaped = tikzCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Write the iframe document — tikzjax loads AFTER the tikz script
    // element exists, so its initial scan will find and process it.
    const html = `<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
</head><body>
<script type="text/tikz">${escaped}</script>
<script src="https://tikzjax.com/v1/tikzjax.js"><\/script>
<script>
// Poll for the SVG that tikzjax creates
var attempts = 0;
var poll = setInterval(function() {
  var svg = document.querySelector("svg");
  if (svg) {
    clearInterval(poll);
    parent.postMessage({ type: "tikz-svg", svg: svg.outerHTML }, "*");
  } else if (++attempts > 300) {
    clearInterval(poll);
    parent.postMessage({ type: "tikz-error", message: "SVG not produced" }, "*");
  }
}, 150);
<\/script>
</body></html>`;

    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    } else {
      // Fallback: use srcdoc
      iframe.srcdoc = html;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  SVG → PNG rasterisation                                           */
/* ------------------------------------------------------------------ */

async function svgToPng(svgString: string): Promise<TikZRenderResult> {
  const scale = getRenderScale();
  const quality = getRenderQuality();

  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-9999px;top:0;background:white;padding:8px;";
  container.innerHTML = svgString;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      ...HTML2CANVAS_OPTIONS,
      scale,
    });
    const raw = canvasToBase64Raw(canvas, quality);
    const widthPt = pixelsToPoints(canvas.width, scale);
    const heightPt = pixelsToPoints(canvas.height, scale);

    return { base64: raw, widthPt, heightPt };
  } finally {
    document.body.removeChild(container);
  }
}

export function clearTikZCache(): void {
  cache.clear();
}
