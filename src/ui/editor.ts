/** CodeMirror 6 Markdown editor component */

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { foldGutter, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tags } from "@lezer/highlight";

export interface EditorAdapter {
  getValue(): string;
  setValue(text: string): void;
  getCursorOffset(): number;
  getSelection(): { from: number; to: number };
  replaceSelection(text: string): void;
  focus(): void;
  getContainer(): HTMLElement;
  onContentChange(cb: () => void): void;
  scrollToOffset(offset: number): void;
  onCursorChange(cb: (offset: number) => void): void;
}

/* ── Markdown syntax highlight style ── */
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.4em", color: "#4338CA" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.25em", color: "#4F46E5" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.1em", color: "#6366F1" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "600", color: "#818CF8" },
  { tag: tags.strong, fontWeight: "700", color: "#1E293B" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#475569" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#94A3B8" },
  { tag: tags.link, color: "#4F46E5", textDecoration: "underline" },
  { tag: tags.url, color: "#7C3AED" },
  { tag: tags.monospace, color: "#C2410C", background: "rgba(194,65,12,0.06)", borderRadius: "3px" },
  { tag: tags.quote, color: "#64748B", fontStyle: "italic" },
  { tag: tags.list, color: "#6366F1" },
  { tag: [tags.processingInstruction, tags.inserted], color: "#15803D" },
  { tag: tags.contentSeparator, color: "#CBD5E1" },
  { tag: tags.meta, color: "#94A3B8" },
]);

/* ── Custom theme matching the design system ── */
const customTheme = EditorView.theme({
  "&": {
    flex: "1",
    fontSize: "13px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflowY: "auto",
    overflowX: "auto",
    lineHeight: "1.65",
    fontFamily: `"JetBrains Mono", "黑体", "SimHei", Consolas, monospace`,
  },
  ".cm-gutters": {
    background: "#F8FAFC",
    borderRight: "1px solid #E2E8F0",
    color: "#94A3B8",
    fontSize: "11px",
    minWidth: "36px",
  },
  ".cm-activeLineGutter": {
    background: "#EEF2FF",
    color: "#4F46E5",
  },
  ".cm-activeLine": {
    background: "rgba(99, 102, 241, 0.04)",
  },
  ".cm-content": {
    padding: "16px 0",
    caretColor: "#6366F1",
    fontFamily: `"JetBrains Mono", "黑体", "SimHei", Consolas, monospace`,
  },
  ".cm-line": {
    padding: "0 20px 0 16px",
  },
  ".cm-cursor": {
    borderLeftColor: "#6366F1",
  },
  ".cm-selectionBackground": {
    background: "#C7D2FE !important",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px",
    cursor: "pointer",
  },
  ".cm-placeholder": {
    color: "#94A3B8",
    fontFamily: `"JetBrains Mono", "黑体", "SimHei", Georgia, serif`,
    fontSize: "12px",
  },
});

/* ── Custom scrollbar helper ── */
function attachCustomScrollbar(wrapper: HTMLElement): void {
  const track = document.createElement("div");
  track.className = "editor-scrollbar-track";
  const thumb = document.createElement("div");
  thumb.className = "editor-scrollbar-thumb";
  track.appendChild(thumb);
  wrapper.appendChild(track);

  const scroller = wrapper.querySelector(".cm-scroller") as HTMLElement;
  if (!scroller) return;

  let isDragging = false;
  let dragStartY = 0;
  let dragStartScrollTop = 0;
  let rafId: number | null = null;
  let trackHovered = false;
  let thumbHovered = false;

  function updateThumbVisibility(): void {
    const { scrollHeight, clientHeight } = scroller;
    const canScroll = scrollHeight > clientHeight;
    
    if (canScroll || trackHovered || thumbHovered || isDragging) {
      track.style.opacity = "1";
    } else {
      track.style.opacity = "0";
    }
  }

  function update(): void {
    const { scrollHeight, clientHeight, scrollTop } = scroller;
    const canScroll = scrollHeight > clientHeight;

    if (!canScroll) {
      thumb.classList.add("disabled");
      thumb.style.height = "100%";
      thumb.style.transform = "translateY(0)";
      updateThumbVisibility();
      return;
    }

    thumb.classList.remove("disabled");

    const ratio = clientHeight / scrollHeight;
    const thumbH = Math.max(ratio * clientHeight, 30);
    const maxScroll = scrollHeight - clientHeight;
    const maxTop = clientHeight - thumbH;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0;

    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
    updateThumbVisibility();
  }

  function scheduleUpdate(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      update();
    });
  }

  scroller.addEventListener("scroll", scheduleUpdate, { passive: true });

  track.addEventListener("mouseenter", () => {
    trackHovered = true;
    updateThumbVisibility();
  });

  track.addEventListener("mouseleave", () => {
    trackHovered = false;
    if (!isDragging) {
      scheduleUpdate();
    }
  });

  thumb.addEventListener("mouseenter", () => {
    thumbHovered = true;
    updateThumbVisibility();
  });

  thumb.addEventListener("mouseleave", () => {
    thumbHovered = false;
    if (!isDragging) {
      scheduleUpdate();
    }
  });

  thumb.addEventListener("mousedown", (e: MouseEvent) => {
    const { scrollHeight, clientHeight } = scroller;
    if (scrollHeight <= clientHeight) return;
    
    e.preventDefault();
    isDragging = true;
    dragStartY = e.clientY;
    dragStartScrollTop = scroller.scrollTop;
    thumb.classList.add("active");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const dy = e.clientY - dragStartY;
    const { scrollHeight, clientHeight } = scroller;
    const ratio = clientHeight / scrollHeight;
    const thumbH = Math.max(ratio * clientHeight, 30);
    const maxTop = clientHeight - thumbH;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxTop > 0) {
      scroller.scrollTop = dragStartScrollTop + (dy / maxTop) * maxScroll;
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    thumb.classList.remove("active");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    scheduleUpdate();
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  track.addEventListener("mousedown", (e: MouseEvent) => {
    const { scrollHeight, clientHeight } = scroller;
    if (scrollHeight <= clientHeight) return;
    if (e.target === thumb) return;
    
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clientHeight / scrollHeight;
    const thumbH = Math.max(ratio * clientHeight, 30);
    const thumbTop = parseFloat(thumb.style.transform?.replace("translateY(", "").replace("px)", "") || "0");
    const thumbCenter = thumbTop + thumbH / 2;
    
    const page = clientHeight * 0.9;
    const targetScroll = scroller.scrollTop + (clickY < thumbCenter ? -page : page);
    
    scroller.scrollTo({
      top: targetScroll,
      behavior: "smooth"
    });
  });

  const ro = new ResizeObserver(scheduleUpdate);
  ro.observe(scroller);
  
  const content = scroller.querySelector(".cm-content");
  if (content) ro.observe(content);

  const mo = new MutationObserver(scheduleUpdate);
  mo.observe(scroller, { childList: true, subtree: true });

  wrapper.addEventListener("wheel", (e) => {
    if (e.target === track || e.target === thumb) {
      e.preventDefault();
      scroller.scrollTop += e.deltaY;
    }
  }, { passive: false });

  scheduleUpdate();
}

export function createEditor(container: HTMLElement): EditorAdapter {
  const wrapper = document.createElement("div");
  wrapper.id = "md-editor";
  container.appendChild(wrapper);

  const changeCallbacks: Array<() => void> = [];
  const cursorCallbacks: Array<(offset: number) => void> = [];

  const state = EditorState.create({
    doc: "",
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLine(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, indentWithTab]),
      markdown({ codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(markdownHighlightStyle),
      placeholder("在此输入 Markdown 内容..."),
      customTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          for (const cb of changeCallbacks) cb();
        }
        if (update.selectionSet) {
          const offset = update.state.selection.main.head;
          for (const cb of cursorCallbacks) cb(offset);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent: wrapper });

  /* Attach custom scrollbar after CM has rendered */
  attachCustomScrollbar(wrapper);

  return {
    getValue(): string {
      return view.state.doc.toString();
    },
    setValue(text: string): void {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
    },
    getCursorOffset(): number {
      return view.state.selection.main.head;
    },
    getSelection(): { from: number; to: number } {
      const sel = view.state.selection.main;
      return { from: sel.from, to: sel.to };
    },
    replaceSelection(text: string): void {
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length },
      });
    },
    focus(): void {
      view.focus();
    },
    getContainer(): HTMLElement {
      return wrapper;
    },
    onContentChange(cb: () => void): void {
      changeCallbacks.push(cb);
    },
    scrollToOffset(offset: number): void {
      view.dispatch({
        selection: { anchor: Math.min(offset, view.state.doc.length) },
        scrollIntoView: true,
      });
    },
    onCursorChange(cb: (offset: number) => void): void {
      cursorCallbacks.push(cb);
    },
  };
}
