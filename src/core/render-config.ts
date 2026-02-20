export interface RenderQuality {
  scale: number;
  dpi: number;
  quality: number;
  name: string;
  description: string;
}

export const RENDER_QUALITY_PRESETS: Record<string, RenderQuality> = {
  high: {
    scale: 6,
    dpi: 576,
    quality: 1.0,
    name: "高质量",
    description: "6x 缩放，576 DPI，无损压缩，适合打印和高清显示",
  },
  medium: {
    scale: 4,
    dpi: 384,
    quality: 0.95,
    name: "中等质量",
    description: "4x 缩放，384 DPI，高质量压缩，平衡文件大小和清晰度",
  },
  low: {
    scale: 2,
    dpi: 192,
    quality: 0.9,
    name: "标准质量",
    description: "2x 缩放，192 DPI，适合屏幕显示",
  },
};

const DEFAULT_QUALITY_KEY = "high";

let currentQualityKey = DEFAULT_QUALITY_KEY;

export function getCurrentRenderQuality(): RenderQuality {
  return RENDER_QUALITY_PRESETS[currentQualityKey] || RENDER_QUALITY_PRESETS.high;
}

export function setRenderQuality(qualityKey: string): void {
  if (RENDER_QUALITY_PRESETS[qualityKey]) {
    currentQualityKey = qualityKey;
    try {
      localStorage.setItem("slidemd_render_quality", qualityKey);
    } catch {
      // localStorage not available
    }
  }
}

export function loadRenderQuality(): void {
  try {
    const saved = localStorage.getItem("slidemd_render_quality");
    if (saved && RENDER_QUALITY_PRESETS[saved]) {
      currentQualityKey = saved;
    }
  } catch {
    // localStorage not available
  }
}

export function getRenderScale(): number {
  return getCurrentRenderQuality().scale;
}

export function getRenderDPI(): number {
  return getCurrentRenderQuality().dpi;
}

export function getRenderQuality(): number {
  return getCurrentRenderQuality().quality;
}

export const HTML2CANVAS_OPTIONS = {
  backgroundColor: "#ffffff",
  logging: false,
  useCORS: true,
  allowTaint: true,
  foreignObjectRendering: false,
  scrollX: 0,
  scrollY: 0,
  imageTimeout: 15000,
  removeContainer: true,
};

export function canvasToBase64(canvas: HTMLCanvasElement, quality: number = 1.0): string {
  if (quality >= 1.0) {
    return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/png", quality);
}

export function canvasToBase64Raw(canvas: HTMLCanvasElement, quality: number = 1.0): string {
  const dataUrl = canvasToBase64(canvas, quality);
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export function pixelsToPoints(pixels: number, scale: number): number {
  return pixels / scale / (96 / 72);
}

loadRenderQuality();
