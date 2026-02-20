/** Font catalog — enumerates all system fonts via document.fonts API */

export interface FontEntry {
  name: string;
  category: "zh" | "en" | "mono";
}

// Known monospace fonts for classification
const KNOWN_MONO = new Set([
  "consolas", "courier new", "courier", "cascadia code", "cascadia mono",
  "fira code", "fira mono", "jetbrains mono", "source code pro",
  "monaco", "menlo", "lucida console", "sf mono", "ubuntu mono",
  "droid sans mono", "dejavu sans mono", "liberation mono", "inconsolata",
  "roboto mono", "noto sans mono", "hack", "iosevka",
]);

// CJK Unicode ranges for Chinese font detection
const CJK_TEST_CHAR = "中";

let canvas: HTMLCanvasElement | null = null;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) canvas = document.createElement("canvas");
  return canvas;
}

/** Test if a font can render CJK characters (differs from sans-serif fallback) */
function canRenderCJK(fontName: string): boolean {
  const ctx = getCanvas().getContext("2d")!;
  const size = "48px";
  ctx.font = `${size} sans-serif`;
  const fallbackWidth = ctx.measureText(CJK_TEST_CHAR).width;
  ctx.font = `${size} "${fontName}", sans-serif`;
  const testWidth = ctx.measureText(CJK_TEST_CHAR).width;
  return Math.abs(testWidth - fallbackWidth) > 0.5;
}

/** Classify a font into zh / en / mono */
function classifyFont(name: string): "zh" | "en" | "mono" {
  if (KNOWN_MONO.has(name.toLowerCase())) return "mono";
  // Heuristic: if the font name contains CJK characters, or can render CJK differently
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(name)) return "zh";
  if (canRenderCJK(name)) return "zh";
  return "en";
}

/**
 * Enumerate all available system fonts.
 * Uses document.fonts.check() with a comprehensive candidate list,
 * plus any fonts already loaded in document.fonts.
 */
export function enumerateSystemFonts(): FontEntry[] {
  const seen = new Set<string>();
  const results: FontEntry[] = [];

  function tryAdd(name: string) {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    // Check availability via document.fonts or canvas measurement
    const available =
      document.fonts.check(`12px "${name}"`) || isFontAvailableCanvas(name);
    if (!available) return;
    seen.add(key);
    results.push({ name, category: classifyFont(name) });
  }

  // 1) Collect fonts already loaded in the browser
  if (document.fonts && typeof document.fonts.forEach === "function") {
    document.fonts.forEach((face) => {
      // FontFace.family may have quotes
      const name = face.family.replace(/^["']|["']$/g, "");
      tryAdd(name);
    });
  }

  // 2) Probe a large list of common fonts
  for (const name of PROBE_LIST) {
    tryAdd(name);
  }

  // Sort: zh first, then en, then mono; alphabetical within each group
  const order = { zh: 0, en: 1, mono: 2 };
  results.sort((a, b) => order[a.category] - order[b.category] || a.name.localeCompare(b.name, "zh"));

  return results;
}

function isFontAvailableCanvas(fontName: string): boolean {
  const ctx = getCanvas().getContext("2d")!;
  const testStr = "mmmmmmmmlli1|WwQq@#中";
  const size = "72px";
  const fallbacks = ["monospace", "sans-serif", "serif"];
  for (const fb of fallbacks) {
    ctx.font = `${size} ${fb}`;
    const fbW = ctx.measureText(testStr).width;
    ctx.font = `${size} "${fontName}", ${fb}`;
    const testW = ctx.measureText(testStr).width;
    if (Math.abs(testW - fbW) > 0.5) return true;
  }
  return false;
}

// Comprehensive probe list — covers Windows, macOS, Linux common fonts
const PROBE_LIST: string[] = [
  // --- Chinese ---
  "微软雅黑", "Microsoft YaHei", "Microsoft YaHei UI",
  "宋体", "SimSun", "新宋体", "NSimSun",
  "黑体", "SimHei",
  "楷体", "KaiTi",
  "仿宋", "FangSong",
  "等线", "DengXian",
  "华文细黑", "STXihei", "华文黑体", "STHeiti",
  "华文楷体", "STKaiti", "华文宋体", "STSong",
  "华文仿宋", "STFangsong", "华文中宋", "STZhongsong",
  "华文彩云", "华文琥珀", "华文隶书", "华文行楷", "华文新魏",
  "方正舒体", "方正姚体", "方正粗黑宋简体",
  "苹方-简", "PingFang SC", "PingFang TC", "PingFang HK",
  "Hiragino Sans GB", "冬青黑体简体中文",
  "Noto Sans CJK SC", "Noto Serif CJK SC",
  "Source Han Sans SC", "Source Han Serif SC",
  "思源黑体", "思源宋体",
  "文泉驿微米黑", "WenQuanYi Micro Hei",
  "幼圆", "YouYuan", "隶书", "LiSu",
  // --- Japanese / Korean (often on CJK systems) ---
  "MS Gothic", "MS Mincho", "Yu Gothic", "Yu Mincho", "Meiryo",
  "Malgun Gothic", "Batang", "Gulim",
  // --- English / Latin ---
  "Arial", "Arial Black", "Arial Narrow", "Arial Rounded MT Bold",
  "Calibri", "Calibri Light",
  "Cambria", "Cambria Math",
  "Times New Roman", "Georgia",
  "Verdana", "Tahoma", "Trebuchet MS",
  "Segoe UI", "Segoe UI Light", "Segoe UI Semibold",
  "Helvetica", "Helvetica Neue",
  "Garamond", "Palatino Linotype", "Book Antiqua",
  "Century Gothic", "Century Schoolbook",
  "Franklin Gothic Medium", "Gill Sans MT",
  "Lucida Sans", "Lucida Sans Unicode", "Lucida Bright",
  "Impact", "Comic Sans MS",
  "Candara", "Constantia", "Corbel",
  "Bahnschrift", "Aptos",
  "San Francisco", "SF Pro", "SF Pro Display", "SF Pro Text",
  "Roboto", "Roboto Slab", "Roboto Condensed",
  "Open Sans", "Lato", "Montserrat", "Raleway", "Poppins",
  "Noto Sans", "Noto Serif",
  "Ubuntu", "Cantarell", "DejaVu Sans", "DejaVu Serif",
  "Liberation Sans", "Liberation Serif",
  // --- Monospace ---
  "Consolas", "Courier New", "Courier",
  "Cascadia Code", "Cascadia Mono",
  "Fira Code", "Fira Mono",
  "JetBrains Mono", "Source Code Pro",
  "Monaco", "Menlo", "SF Mono",
  "Lucida Console", "Ubuntu Mono",
  "Droid Sans Mono", "DejaVu Sans Mono",
  "Liberation Mono", "Inconsolata",
  "Roboto Mono", "Noto Sans Mono",
  "Hack", "Iosevka",
];
