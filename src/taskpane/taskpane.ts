import "./taskpane.css";
import "katex/dist/katex.min.css";
import { createEditor } from "../ui/editor";
import { createToolbar } from "../ui/toolbar";
import { initFontManager, getRenderOptions } from "../fonts/font-manager";
import { parseMarkdown } from "../core/markdown-parser";
import { transformTokens } from "../core/ast-transformer";
import { buildSlides } from "../core/slide-builder";
import { preloadMathFonts } from "../core/math-renderer";
import { registerRibbonCommands } from "../commands/ribbon-commands";
import {
  initSourceStore,
  saveSlideSource,
  loadSlideSource,
  getCurrentSlideId,
} from "../core/source-store";

let statusBar: HTMLElement;
let renderBtn: HTMLButtonElement | null = null;
let editor: HTMLTextAreaElement;
let notificationBar: HTMLElement;
let isPowerPoint = false;

/** ID of the slide whose source is currently loaded in the editor */
let activeSourceSlideId: string | null = null;

function setStatus(msg: string, type: "" | "error" | "success" = "") {
  statusBar.textContent = msg;
  statusBar.className = type;
}

async function handleRender() {
  if (!isPowerPoint) {
    setStatus("渲染功能需在 PowerPoint 中使用", "error");
    return;
  }

  const markdown = editor.value.trim();
  if (!markdown) {
    setStatus("请先输入 Markdown 内容", "error");
    return;
  }

  if (renderBtn) renderBtn.disabled = true;
  setStatus("解析中...");

  try {
    const tokens = parseMarkdown(markdown);
    setStatus("转换中...");
    const slides = transformTokens(tokens);

    if (slides.length === 0) {
      setStatus("未检测到任何内容", "error");
      return;
    }

    const options = getRenderOptions();
    await buildSlides(slides, options, (msg) => setStatus(msg));

    // Persist Markdown source for this slide
    try {
      const slideId = await getCurrentSlideId();
      await saveSlideSource(slideId, markdown);
      activeSourceSlideId = slideId;
    } catch (e) {
      console.warn("Failed to save slide source:", e);
    }

    setStatus("渲染完成！新内容已追加到当前幻灯片", "success");
  } catch (err: any) {
    console.error("Render error:", err);
    setStatus(`渲染失败: ${err.message || err}`, "error");
  } finally {
    if (renderBtn) renderBtn.disabled = false;
  }
}

function handleNewSlide() {
  const pos = editor.selectionStart;
  const before = editor.value.substring(0, pos);
  const after = editor.value.substring(editor.selectionEnd);
  const separator = "\n\n---\n\n";
  editor.value = before + separator + after;
  const newPos = pos + separator.length;
  editor.selectionStart = editor.selectionEnd = newPos;
  editor.focus();
}

/** Load stored Markdown source from the current slide into the editor */
async function handleLoadFromSlide() {
  if (!isPowerPoint) {
    setStatus("此功能需在 PowerPoint 中使用", "error");
    return;
  }

  try {
    const slideId = await getCurrentSlideId();
    const source = loadSlideSource(slideId);
    if (source) {
      editor.value = source;
      activeSourceSlideId = slideId;
      // Visual feedback: flash the editor border
      editor.classList.remove("source-loaded");
      void editor.offsetWidth; // force reflow to restart animation
      editor.classList.add("source-loaded");
      editor.focus();
      hideNotification();
      setStatus("已从幻灯片加载源内容，可编辑后重新渲染", "success");
    } else {
      setStatus("当前幻灯片没有 SlideMD 源内容", "error");
    }
  } catch (err: any) {
    setStatus(`加载失败: ${err.message || err}`, "error");
  }
}

/** Show the notification bar when a slide with stored source is detected */
function showNotification() {
  notificationBar.classList.add("visible");
}

function hideNotification() {
  notificationBar.classList.remove("visible");
}

/** Check if the current slide has stored Markdown and show notification */
async function checkCurrentSlideSource() {
  if (!isPowerPoint) return;
  try {
    const slideId = await getCurrentSlideId();
    // Don't notify if this slide's source is already loaded in the editor
    if (slideId === activeSourceSlideId) {
      hideNotification();
      return;
    }
    const source = loadSlideSource(slideId);
    if (source) {
      showNotification();
    } else {
      hideNotification();
    }
  } catch {
    hideNotification();
  }
}

/** Debounced selection change handler */
let selectionTimer: ReturnType<typeof setTimeout> | null = null;
function onSelectionChanged() {
  if (selectionTimer) clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => checkCurrentSlideSource(), 300);
}

function init() {
  initFontManager();
  initSourceStore();

  // Preload KaTeX fonts in background (non-blocking)
  preloadMathFonts().catch((e) => console.warn("Font preload error:", e));

  const toolbarContainer = document.getElementById("toolbar")!;
  const editorContainer = document.getElementById("editor-container")!;
  statusBar = document.getElementById("status-bar")!;
  notificationBar = document.getElementById("source-notification")!;

  // Create editor
  editor = createEditor(editorContainer);

  // Create toolbar with font selectors, size, color, render button
  createToolbar(toolbarContainer, {
    onRender: handleRender,
    onNewSlide: handleNewSlide,
    onLoadFromSlide: handleLoadFromSlide,
  });

  // Get render button reference
  renderBtn = document.getElementById("render-btn") as HTMLButtonElement;

  // Wire up notification bar buttons
  document.getElementById("notification-load-btn")
    ?.addEventListener("click", handleLoadFromSlide);
  document.getElementById("notification-dismiss")
    ?.addEventListener("click", hideNotification);

  // Register selection change handler to detect slides with stored source
  if (isPowerPoint) {
    try {
      Office.context.document.addHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        onSelectionChanged
      );
    } catch {
      // Event handler not supported in this environment
    }
  }

  setStatus(
    isPowerPoint
      ? "就绪"
      : "就绪（浏览器预览模式，渲染功能需在 PowerPoint 中使用）"
  );
}

Office.onReady((info) => {
  isPowerPoint = info.host === Office.HostType.PowerPoint;

  // Register ribbon command handlers (shared runtime)
  try {
    registerRibbonCommands();
  } catch {
    // Not in shared runtime or Office.actions not available
  }

  init();
});
