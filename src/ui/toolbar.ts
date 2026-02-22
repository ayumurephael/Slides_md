import { getFontState, setFontSize, setFontColor } from "../fonts/font-manager";
import { createFontSelector } from "./font-selector";
import { ICONS } from "./icons";
import {
  RENDER_QUALITY_PRESETS,
  getCurrentRenderQuality,
  setRenderQuality,
} from "../core/render-config";

export interface ToolbarCallbacks {
  onRender: () => void;
  onNewSlide: () => void;
  onLoadFromSlide: () => void;
  onSyncAll?: () => void;
}

function createIconButton(
  id: string,
  icon: string,
  text: string,
  btnClass: string, // e.g., 'btn-primary'
  callback: () => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = id;
  btn.className = `btn ${btnClass}`;
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

  // ── Font size (stepper) ──
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "toolbar-group";
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "字号";
  sizeLabel.htmlFor = "font-size";
  sizeGroup.appendChild(sizeLabel);

  const stepper = document.createElement("div");
  stepper.className = "stepper";

  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.id = "font-size";
  sizeInput.min = "8";
  sizeInput.max = "72";
  sizeInput.value = String(getFontState().fontSize);

  const applySize = () => {
    const v = Math.min(72, Math.max(8, parseInt(sizeInput.value, 10) || 18));
    sizeInput.value = String(v);
    setFontSize(v);
  };
  sizeInput.addEventListener("change", applySize);
  sizeInput.addEventListener("input", applySize);
  stepper.appendChild(sizeInput);

  const arrows = document.createElement("div");
  arrows.className = "stepper-arrows";

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "stepper-btn stepper-up";
  upBtn.tabIndex = -1;
  upBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  upBtn.addEventListener("click", () => {
    const cur = parseInt(sizeInput.value, 10) || 18;
    if (cur < 72) { sizeInput.value = String(cur + 1); applySize(); }
  });

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "stepper-btn stepper-down";
  downBtn.tabIndex = -1;
  downBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  downBtn.addEventListener("click", () => {
    const cur = parseInt(sizeInput.value, 10) || 18;
    if (cur > 8) { sizeInput.value = String(cur - 1); applySize(); }
  });

  arrows.appendChild(upBtn);
  arrows.appendChild(downBtn);
  stepper.appendChild(arrows);
  sizeGroup.appendChild(stepper);
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

  // ── Action buttons ──
  const loadBtn = createIconButton(
    "load-from-slide-btn",
    ICONS.load,
    "加载",
    "btn-tertiary",
    callbacks.onLoadFromSlide
  );
  row.appendChild(loadBtn);

  const newSlideBtn = createIconButton(
    "new-slide-btn",
    ICONS.newSlide,
    "新幻灯片",
    "btn-secondary",
    callbacks.onNewSlide
  );
  row.appendChild(newSlideBtn);

  const renderBtn = createIconButton("render-btn", ICONS.render, "渲染", "btn-primary", callbacks.onRender);
  renderBtn.style.marginLeft = "auto"; // Push to the far right
  row.appendChild(renderBtn);

  toolbar.appendChild(row);
  container.appendChild(toolbar);
}
