import { renderMarkdownHTML } from "../core/markdown-parser";

let previewEl: HTMLElement | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Initialize preview panel */
export function createPreview(container: HTMLElement): HTMLElement {
  previewEl = document.createElement("div");
  previewEl.id = "md-preview";
  previewEl.className = "preview-content";
  container.appendChild(previewEl);
  return previewEl;
}

/** Update preview with debounce */
export function updatePreview(markdown: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (previewEl) {
      previewEl.innerHTML = renderMarkdownHTML(markdown);
    }
  }, 300);
}
