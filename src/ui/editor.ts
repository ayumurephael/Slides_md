/** CodeMirror 6 Markdown editor component */

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { foldGutter } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

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

/* ── Custom theme matching the design system ── */
const customTheme = EditorView.theme({
  "&": {
    flex: "1",
    fontSize: "13px",
    fontFamily: `"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace`,
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "1.65",
  },
  ".cm-gutters": {
    background: "var(--gray-50)",
    borderRight: "1px solid var(--gray-200)",
    color: "var(--gray-400)",
    fontSize: "11px",
    minWidth: "36px",
  },
  ".cm-activeLineGutter": {
    background: "var(--primary-50)",
    color: "var(--primary-600)",
  },
  ".cm-activeLine": {
    background: "rgba(99, 102, 241, 0.04)",
  },
  ".cm-content": {
    padding: "16px 0",
    caretColor: "var(--primary-500)",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--primary-500)",
  },
  ".cm-selectionBackground": {
    background: "var(--primary-200) !important",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px",
    cursor: "pointer",
  },
  ".cm-placeholder": {
    color: "var(--gray-400)",
    fontFamily: `"Lusitana", "华文中宋", "Segoe UI", system-ui, sans-serif`,
    fontSize: "12px",
  },
});

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
      placeholder("在此输入 Markdown 内容...\n\n支持：**粗体** *斜体* ++下划线++ ~~删除线~~\n$行内公式$ 和 $$块级公式$$\n代码块、列表、引用、图片\n用 --- 分隔幻灯片"),
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
