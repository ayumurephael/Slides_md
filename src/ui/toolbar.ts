import { getFontState, setFontSize, setFontColor } from "../fonts/font-manager";
import { createFontSelector } from "./font-selector";

export interface ToolbarCallbacks {
  onRender: () => void;
  onNewSlide: () => void;
  onLoadFromSlide: () => void;
}

/** Create toolbar with all controls in a single horizontal row. */
export function createToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): void {
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  // Single row: fonts + size + color + buttons
  const row = document.createElement("div");
  row.className = "toolbar-row";

  // Font selectors (Chinese, English, Code) — appended inline
  createFontSelector(row);

  // Font size
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

  // Font color
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

  // Load from slide button
  const loadBtn = document.createElement("button");
  loadBtn.id = "load-from-slide-btn";
  loadBtn.textContent = "从幻灯片加载";
  loadBtn.addEventListener("click", callbacks.onLoadFromSlide);
  row.appendChild(loadBtn);

  // New slide button
  const newSlideBtn = document.createElement("button");
  newSlideBtn.id = "new-slide-btn";
  newSlideBtn.textContent = "新建空白幻灯片";
  newSlideBtn.addEventListener("click", callbacks.onNewSlide);
  row.appendChild(newSlideBtn);

  // Render button
  const renderBtn = document.createElement("button");
  renderBtn.id = "render-btn";
  renderBtn.textContent = "渲染到幻灯片";
  renderBtn.addEventListener("click", callbacks.onRender);
  row.appendChild(renderBtn);

  toolbar.appendChild(row);
  container.appendChild(toolbar);
}
