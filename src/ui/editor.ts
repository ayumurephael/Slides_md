/** Markdown editor component (textarea with Tab support) */

export function createEditor(container: HTMLElement): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.id = "md-editor";
  textarea.placeholder = "在此输入 Markdown 内容...\n\n支持：\n- **粗体** *斜体* ++下划线++ ~~删除线~~\n- $行内公式$ 和 $$块级公式$$\n- 代码块、列表、引用、图片\n- 用 --- 分隔幻灯片";
  textarea.spellcheck = false;

  // Tab key support
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value =
        textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      textarea.dispatchEvent(new Event("input"));
    }
  });

  container.appendChild(textarea);
  return textarea;
}
