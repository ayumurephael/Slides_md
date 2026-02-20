import { getFontState, setZhFont, setEnFont, setCodeFont } from "../fonts/font-manager";
import type { FontEntry } from "../fonts/font-catalog";

/** Create font selector dropdowns: Chinese, English, Code */
export function createFontSelector(
  container: HTMLElement,
): void {
  const state = getFontState();

  // Chinese font
  addFontGroup(container, "中文字体", "zh-font-select", state.zhFonts, state.selectedZhFont, (v) => {
    setZhFont(v);
  });

  // English font
  addFontGroup(container, "英文字体", "en-font-select", state.enFonts, state.selectedEnFont, (v) => {
    setEnFont(v);
  });

  // Code font
  addFontGroup(container, "代码字体", "code-font-select", state.monoFonts, state.selectedCodeFont, (v) => {
    setCodeFont(v);
  });
}

function addFontGroup(
  container: HTMLElement,
  labelText: string,
  id: string,
  fonts: FontEntry[],
  selected: string,
  onSelect: (value: string) => void
): void {
  const group = document.createElement("div");
  group.className = "toolbar-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  label.htmlFor = id;
  group.appendChild(label);

  const select = document.createElement("select");
  select.id = id;
  for (const font of fonts) {
    const opt = document.createElement("option");
    opt.value = font.name;
    opt.textContent = font.name;
    opt.style.fontFamily = `"${font.name}"`;
    if (font.name === selected) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onSelect(select.value));
  group.appendChild(select);

  container.appendChild(group);
}
