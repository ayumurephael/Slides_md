export interface RenderQuality {
  scale: number;
  dpi: number;
  quality: number;
  name: string;
  description: string;
}

export const RENDER_QUALITY_PRESETS: Record<string, RenderQuality> = {
  ultra: {
    scale: 10,
    dpi: 960,
    quality: 1.0,
    name: "超高质量",
    description: "10x 缩放，960 DPI，无损PNG，适合专业打印和4K显示",
  },
  very_high: {
    scale: 8,
    dpi: 768,
    quality: 1.0,
    name: "极高质量",
    description: "8x 缩放，768 DPI，无损PNG，适合高清打印",
  },
  high: {
    scale: 6,
    dpi: 576,
    quality: 1.0,
    name: "高质量",
    description: "6x 缩放，576 DPI，无损PNG，适合打印和高清显示",
  },
  medium: {
    scale: 4,
    dpi: 384,
    quality: 1.0,
    name: "中等质量",
    description: "4x 缩放，384 DPI，无损PNG，平衡文件大小和清晰度",
  },
  low: {
    scale: 2,
    dpi: 192,
    quality: 1.0,
    name: "标准质量",
    description: "2x 缩放，192 DPI，适合屏幕显示",
  },
};

const DEFAULT_QUALITY_KEY = "ultra";

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
  width: undefined as number | undefined,
  height: undefined as number | undefined,
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

export const AUTO_CROP_ENABLED = true;
export const AUTO_CROP_MARGIN = 2;
export const AUTO_CROP_BG_THRESHOLD = 250;

export function autoCropCanvas(canvas: HTMLCanvasElement, margin: number = AUTO_CROP_MARGIN): HTMLCanvasElement {
  if (!AUTO_CROP_ENABLED) return canvas;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  
  const width = canvas.width;
  const height = canvas.height;
  
  if (width === 0 || height === 0) return canvas;
  
  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    return canvas;
  }
  
  const data = imageData.data;
  
  const isBackgroundPixel = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r >= AUTO_CROP_BG_THRESHOLD && g >= AUTO_CROP_BG_THRESHOLD && b >= AUTO_CROP_BG_THRESHOLD;
  };
  
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  
  const stepX = Math.max(1, Math.floor(width / 800));
  const stepY = Math.max(1, Math.floor(height / 800));
  
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      if (!isBackgroundPixel(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  
  if (maxX < minX || maxY < minY) {
    return canvas;
  }
  
  if (stepX > 1 || stepY > 1) {
    const refineMinX = Math.max(0, Math.floor(minX / stepX) * stepX);
    const refineMaxX = Math.min(width - 1, Math.ceil((maxX + stepX) / stepX) * stepX);
    const refineMinY = Math.max(0, Math.floor(minY / stepY) * stepY);
    const refineMaxY = Math.min(height - 1, Math.ceil((maxY + stepY) / stepY) * stepY);
    
    minX = width;
    minY = height;
    maxX = 0;
    maxY = 0;
    
    for (let y = refineMinY; y <= refineMaxY; y++) {
      for (let x = refineMinX; x <= refineMaxX; x++) {
        if (!isBackgroundPixel(x, y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(width - 1, maxX + margin);
  maxY = Math.min(height - 1, maxY + margin);
  
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  
  if (cropWidth >= width - 4 && cropHeight >= height - 4) {
    return canvas;
  }
  
  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) return canvas;
  
  croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
  return croppedCanvas;
}

loadRenderQuality();
