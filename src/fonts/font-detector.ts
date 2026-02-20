/**
 * Detect font availability using canvas measurement technique.
 * Compares text width rendered in the target font vs a known fallback.
 */

const FALLBACK_FONTS = ["monospace", "sans-serif", "serif"];
const TEST_STRING = "mmmmmmmmmmlli1|WwQq@#中文测试";
const TEST_SIZE = "72px";

let canvas: HTMLCanvasElement | null = null;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  return canvas;
}

function measureWidth(fontFamily: string): number {
  const ctx = getCanvas().getContext("2d")!;
  ctx.font = `${TEST_SIZE} ${fontFamily}`;
  return ctx.measureText(TEST_STRING).width;
}

/** Check if a font is available on the system */
export function isFontAvailable(fontName: string): boolean {
  for (const fallback of FALLBACK_FONTS) {
    const fallbackWidth = measureWidth(fallback);
    const testWidth = measureWidth(`"${fontName}", ${fallback}`);
    if (Math.abs(testWidth - fallbackWidth) > 0.5) {
      return true;
    }
  }
  return false;
}

/** Filter a list of font names to only those available */
export function filterAvailableFonts(fontNames: string[]): string[] {
  return fontNames.filter(isFontAvailable);
}
