import { getFontState, setFontSize, setFontColor } from "../fonts/font-manager";
import { createFontSelector } from "./font-selector";
import { ICONS } from "./icons";

export interface ToolbarCallbacks {
  onRender: () => void;
  onNewSlide: () => void;
  onLoadFromSlide: () => void;
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

  // ── Action buttons ──
  const loadBtn = createIconButton("load-from-slide-btn", ICONS.load, "加载", callbacks.onLoadFromSlide);
  row.appendChild(loadBtn);

  const newSlideBtn = createIconButton("new-slide-btn", ICONS.newSlide, "新幻灯片", callbacks.onNewSlide);
  row.appendChild(newSlideBtn);

  const renderBtn = createIconButton("render-btn", ICONS.render, "渲染", callbacks.onRender);
  row.appendChild(renderBtn);

  toolbar.appendChild(row);
  container.appendChild(toolbar);
}
