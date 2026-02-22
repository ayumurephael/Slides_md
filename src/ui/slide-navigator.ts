/** Slide navigator panel — parses --- sections, shows titles, click to jump */

import type { EditorAdapter } from "./editor";
import { ICONS } from "./icons";

export interface SlideSection {
  index: number;
  title: string;
  startOffset: number;
  endOffset: number;
}

export interface SlideNavigatorController {
  update(markdown: string): void;
  setActiveSection(index: number): void;
  destroy(): void;
}

/** Parse markdown into slide sections split by --- */
export function parseSlideSections(markdown: string): SlideSection[] {
  const sections: SlideSection[] = [];
  const separatorRe = /^---$/gm;
  const boundaries: number[] = [0];

  let match: RegExpExecArray | null;
  while ((match = separatorRe.exec(markdown)) !== null) {
    boundaries.push(match.index);
  }
  boundaries.push(markdown.length);

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = i === 0 ? boundaries[i] : boundaries[i] + 3; // skip "---"
    const end = boundaries[i + 1];
    const content = markdown.substring(start, end).trim();

    if (i > 0 && content === "" && start >= end) continue;

    // Extract title: first heading or first line
    let title = "";
    const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      const firstLine = content.split("\n")[0]?.trim() || "";
      title = firstLine.substring(0, 40) || `无标题幻灯片 ${i + 1}`;
    }

    sections.push({ index: i, title, startOffset: start, endOffset: end });
  }

  return sections;
}

/** Create the slide navigator UI component */
export function createSlideNavigator(
  container: HTMLElement,
  editor: EditorAdapter,
  onSyncAll: () => void
): SlideNavigatorController {
  const nav = document.createElement("div");
  nav.className = "slide-navigator";

  // Header
  const header = document.createElement("div");
  header.className = "slide-nav-header";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "slide-nav-toggle";
  toggleBtn.innerHTML = `${ICONS.chevronDown}<span class="slide-nav-count">幻灯片 (0)</span>`;
  toggleBtn.addEventListener("click", () => {
    nav.classList.toggle("collapsed");
  });
  header.appendChild(toggleBtn);

  const syncBtn = document.createElement("button");
  syncBtn.className = "btn btn-secondary slide-nav-sync-btn";
  syncBtn.innerHTML = `${ICONS.syncAll}<span>同步全部</span>`;
  syncBtn.addEventListener("click", onSyncAll);
  header.appendChild(syncBtn);

  nav.appendChild(header);

  // List
  const list = document.createElement("div");
  list.className = "slide-nav-list";
  nav.appendChild(list);

  container.appendChild(nav);

  let sections: SlideSection[] = [];
  let activeIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function render() {
    const countSpan = toggleBtn.querySelector(".slide-nav-count");
    if (countSpan) countSpan.textContent = `幻灯片 (${sections.length})`;

    list.innerHTML = "";
    for (const section of sections) {
      const item = document.createElement("div");
      item.className = "slide-nav-item" + (section.index === activeIndex ? " active" : "");
      item.innerHTML = `<span class="slide-nav-index">${section.index + 1}</span><span class="slide-nav-title">${escapeHtml(section.title)}</span>`;
      item.addEventListener("click", () => {
        editor.scrollToOffset(section.startOffset);
        editor.focus();
      });
      list.appendChild(item);
    }
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return {
    update(markdown: string) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        sections = parseSlideSections(markdown);
        render();
      }, 300);
    },
    setActiveSection(index: number) {
      if (index === activeIndex) return;
      activeIndex = index;
      const items = list.querySelectorAll(".slide-nav-item");
      items.forEach((el, i) => {
        el.classList.toggle("active", i === index);
      });
    },
    destroy() {
      if (debounceTimer) clearTimeout(debounceTimer);
      nav.remove();
    },
  };
}
