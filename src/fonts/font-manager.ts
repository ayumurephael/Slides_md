import { enumerateSystemFonts, type FontEntry } from "./font-catalog";
import type { RenderOptions } from "../types/ir";
import { DEFAULT_RENDER_OPTIONS } from "../types/ir";

export interface FontState {
  zhFonts: FontEntry[];
  enFonts: FontEntry[];
  monoFonts: FontEntry[];
  selectedZhFont: string;
  selectedEnFont: string;
  selectedCodeFont: string;
  fontSize: number;
  fontColor: string;
}

let state: FontState = {
  zhFonts: [],
  enFonts: [],
  monoFonts: [],
  selectedZhFont: "微软雅黑",
  selectedEnFont: "Calibri",
  selectedCodeFont: DEFAULT_RENDER_OPTIONS.codeFontFamily,
  fontSize: DEFAULT_RENDER_OPTIONS.fontSize,
  fontColor: DEFAULT_RENDER_OPTIONS.fontColor,
};

const STORAGE_KEY = "slides-md-font-prefs";

/** Initialize font manager: enumerate system fonts */
export function initFontManager(): FontState {
  const all = enumerateSystemFonts();
  state.zhFonts = all.filter((f) => f.category === "zh");
  state.enFonts = all.filter((f) => f.category === "en");
  state.monoFonts = all.filter((f) => f.category === "mono");

  // Load saved preferences
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      if (p.selectedZhFont) state.selectedZhFont = p.selectedZhFont;
      if (p.selectedEnFont) state.selectedEnFont = p.selectedEnFont;
      if (p.selectedCodeFont) state.selectedCodeFont = p.selectedCodeFont;
      if (p.fontSize) state.fontSize = p.fontSize;
      if (p.fontColor) state.fontColor = p.fontColor;
    }
  } catch {
    // ignore
  }

  return state;
}

export function getFontState(): FontState {
  return state;
}

export function setZhFont(name: string): void {
  state.selectedZhFont = name;
  savePrefs();
}

export function setEnFont(name: string): void {
  state.selectedEnFont = name;
  savePrefs();
}

export function setCodeFont(fontName: string): void {
  state.selectedCodeFont = fontName;
  savePrefs();
}

export function setFontSize(size: number): void {
  state.fontSize = size;
  savePrefs();
}

export function setFontColor(color: string): void {
  state.fontColor = color;
  savePrefs();
}

export function getRenderOptions(): RenderOptions {
  return {
    fontFamily: `"${state.selectedEnFont}", "${state.selectedZhFont}"`,
    fontSize: state.fontSize,
    fontColor: state.fontColor,
    codeFontFamily: state.selectedCodeFont,
    zhFontFamily: state.selectedZhFont,
    enFontFamily: state.selectedEnFont,
  };
}

function savePrefs(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedZhFont: state.selectedZhFont,
        selectedEnFont: state.selectedEnFont,
        selectedCodeFont: state.selectedCodeFont,
        fontSize: state.fontSize,
        fontColor: state.fontColor,
      })
    );
  } catch {
    // ignore
  }
}
