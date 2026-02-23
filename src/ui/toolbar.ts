import { getFontState, setFontSize, setFontColor } from "../fonts/font-manager";
import { createFontSelector } from "./font-selector";
import { ICONS } from "./icons";
import {
  RENDER_QUALITY_PRESETS,
  getCurrentRenderQuality,
  setRenderQuality,
} from "../core/render-config";
import {
  LAYOUT_OPTIONS,
  type LayoutType,
} from "../core/slide-layouts";

export interface ToolbarCallbacks {
  onRender: () => void;
  onNewSlide: (layoutType: LayoutType) => void;
  onLoadFromSlide: () => void;
}

let selectedLayoutType: LayoutType = "titleAndContent";
let layoutSelect: HTMLSelectElement | null = null;

export function getSelectedLayoutType(): LayoutType {
  return selectedLayoutType;
}

export function setSelectedLayoutType(layoutType: LayoutType): void {
  selectedLayoutType = layoutType;
  if (layoutSelect) {
    layoutSelect.value = layoutType;
    updateLayoutHighlight();
  }
}

function updateLayoutHighlight(): void {
  if (!layoutSelect) return;
  
  const options = layoutSelect.querySelectorAll("option");
  options.forEach((opt) => {
    if (opt.value === selectedLayoutType) {
      opt.style.fontWeight = "bold";
      opt.style.backgroundColor = "#e3f2fd";
    } else {
      opt.style.fontWeight = "normal";
      opt.style.backgroundColor = "";
    }
  });
}

function createIconButton(id: string, icon: string, text: string, callback: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = id;
  btn.className = "icon-button";
  btn.innerHTML = `${icon}<span>${text}</span>`;
  btn.addEventListener("click", callback);
  return btn;
}

function divider(): HTMLElement {
  const el = document.createElement("div");
  el.className = "toolbar-divider";
  return el;
}

/** Create toolbar with all controls in a single horizontal row. */
export function createToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): void {
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const row = document.createElement("div");
  row.className = "toolbar-row";

  // ── Font selectors (Chinese, English, Code) ──
  createFontSelector(row);

  row.appendChild(divider());

  // ── Font size ──
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "toolbar-group";
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "字号";
  sizeLabel.htmlFor = "font-size";
  sizeGroup.appendChild(sizeLabel);

  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.id = "font-size";
  sizeInput.min = "8";
  sizeInput.max = "72";
  sizeInput.value = String(getFontState().fontSize);
  sizeInput.addEventListener("change", () => {
    setFontSize(parseInt(sizeInput.value, 10) || 18);
  });
  sizeGroup.appendChild(sizeInput);
  row.appendChild(sizeGroup);

  // ── Font color ──
  const colorGroup = document.createElement("div");
  colorGroup.className = "toolbar-group";
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "颜色";
  colorLabel.htmlFor = "font-color";
  colorGroup.appendChild(colorLabel);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.id = "font-color";
  colorInput.value = getFontState().fontColor;
  colorInput.addEventListener("change", () => {
    setFontColor(colorInput.value);
  });
  colorGroup.appendChild(colorInput);
  row.appendChild(colorGroup);

  row.appendChild(divider());

  // ── Render quality selector ──
  const qualityGroup = document.createElement("div");
  qualityGroup.className = "toolbar-group";
  const qualityLabel = document.createElement("label");
  qualityLabel.textContent = "渲染质量";
  qualityLabel.htmlFor = "render-quality";
  qualityGroup.appendChild(qualityLabel);

  const qualitySelect = document.createElement("select");
  qualitySelect.id = "render-quality";
  const currentQuality = getCurrentRenderQuality();
  for (const [key, preset] of Object.entries(RENDER_QUALITY_PRESETS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.name;
    if (preset.name === currentQuality.name) {
      option.selected = true;
    }
    qualitySelect.appendChild(option);
  }
  qualitySelect.addEventListener("change", () => {
    setRenderQuality(qualitySelect.value);
  });
  qualityGroup.appendChild(qualitySelect);
  row.appendChild(qualityGroup);

  row.appendChild(divider());

  // ── Slide layout selector ──
  const layoutGroup = document.createElement("div");
  layoutGroup.className = "toolbar-group layout-group";
  const layoutLabel = document.createElement("label");
  layoutLabel.textContent = "版式";
  layoutLabel.htmlFor = "slide-layout";
  layoutGroup.appendChild(layoutLabel);

  layoutSelect = document.createElement("select");
  layoutSelect.id = "slide-layout";
  layoutSelect.title = "选择新幻灯片的版式";
  
  for (const layout of LAYOUT_OPTIONS) {
    const option = document.createElement("option");
    option.value = layout.type;
    option.textContent = layout.name;
    option.title = layout.description;
    if (layout.type === selectedLayoutType) {
      option.selected = true;
    }
    layoutSelect.appendChild(option);
  }
  
  layoutSelect.addEventListener("change", () => {
    selectedLayoutType = layoutSelect!.value as LayoutType;
    updateLayoutHighlight();
  });
  
  updateLayoutHighlight();
  
  layoutGroup.appendChild(layoutSelect);
  row.appendChild(layoutGroup);

  row.appendChild(divider());

  // ── Action buttons ──
  const loadBtn = createIconButton("load-from-slide-btn", ICONS.load, "加载", callbacks.onLoadFromSlide);
  row.appendChild(loadBtn);

  const newSlideBtn = createIconButton("new-slide-btn", ICONS.newSlide, "新幻灯片", () => {
    callbacks.onNewSlide(selectedLayoutType);
  });
  newSlideBtn.title = `在当前幻灯片后插入新幻灯片（版式: ${LAYOUT_OPTIONS.find(l => l.type === selectedLayoutType)?.name || selectedLayoutType}）`;
  row.appendChild(newSlideBtn);

  // Update button tooltip when layout changes
  layoutSelect.addEventListener("change", () => {
    const layoutName = LAYOUT_OPTIONS.find(l => l.type === selectedLayoutType)?.name || selectedLayoutType;
    newSlideBtn.title = `在当前幻灯片后插入新幻灯片（版式: ${layoutName}）`;
  });

  const renderBtn = createIconButton("render-btn", ICONS.render, "渲染", callbacks.onRender);
  row.appendChild(renderBtn);

  toolbar.appendChild(row);
  container.appendChild(toolbar);
}
