import "./taskpane.css";
import "katex/dist/katex.min.css";
import { createEditor } from "../ui/editor";
import type { EditorAdapter } from "../ui/editor";
import { setGlobalEditor } from "../ui/editor-state";
import { createToolbar } from "../ui/toolbar";
import { initFontManager } from "../fonts/font-manager";
import { renderMarkdownIncremental } from "../core/slide-builder";
import { preloadMathFonts } from "../core/math-renderer";
import { registerRibbonCommands } from "../commands/ribbon-commands";
import { ICONS } from "../ui/icons";
import {
  initSourceStore,
  loadSlideSource,
  getCurrentSlideId,
} from "../core/source-store";
import { createSlideNavigator, parseSlideSections } from "../ui/slide-navigator";
import type { SlideNavigatorController } from "../ui/slide-navigator";
import { syncAllSlides } from "../core/slide-sync";
import {
  insertSlideWithLayout,
  getCurrentSlideLayout,
  getAvailableLayouts,
  LAYOUT_OPTIONS,
  type LayoutType,
} from "../core/slide-layouts";
import { setSelectedLayoutType } from "../ui/toolbar";

let statusBar: HTMLElement;
let renderBtn: HTMLButtonElement | null = null;
let editor: EditorAdapter;
let notificationBar: HTMLElement;
let loadingOverlay: HTMLElement;
let loadingText: HTMLElement;
let isPowerPoint = false;
let navigator: SlideNavigatorController | null = null;

/** ID of the slide whose source is currently loaded in the editor */
let activeSourceSlideId: string | null = null;

function setStatus(msg: string, type: "" | "error" | "success" | "rendering" = "") {
  statusBar.textContent = msg;
  statusBar.className = type;
}

function showLoading(msg: string) {
  loadingText.textContent = msg;
  loadingOverlay.classList.add("visible");
}

function hideLoading() {
  loadingOverlay.classList.remove("visible");
}

async function handleRender() {
  if (!isPowerPoint) {
    setStatus("渲染功能需在 PowerPoint 中使用", "error");
    return;
  }

  const markdown = editor.getValue().trim();
  if (!markdown) {
    setStatus("请先输入 Markdown 内容", "error");
    return;
  }

  if (renderBtn) renderBtn.disabled = true;
  setStatus("准备渲染...", "rendering");
  showLoading("准备渲染...");

  try {
    const progress = (msg: string) => {
      setStatus(msg, "rendering");
      showLoading(msg);
    };

    const result = await renderMarkdownIncremental(markdown, progress);

    const slideId = await getCurrentSlideId();
    activeSourceSlideId = slideId;

    hideLoading();
    switch (result.kind) {
      case "no_change":
        setStatus("内容无变化，跳过渲染", "success");
        break;
      case "full_rebuild":
        setStatus("渲染完成！（完整重建）", "success");
        break;
      case "incremental":
        setStatus("渲染完成！（增量更新）", "success");
        break;
    }
  } catch (err: any) {
    console.error("Render error:", err);
    hideLoading();
    setStatus(`渲染失败: ${err.message || err}`, "error");
  } finally {
    if (renderBtn) renderBtn.disabled = false;
  }
}

async function handleNewSlide(layoutType: LayoutType) {
  const { from, to } = editor.getSelection();
  const doc = editor.getValue();
  const before = doc.substring(0, from);
  const after = doc.substring(to);
  const separator = "\n\n---\n\n";
  editor.setValue(before + separator + after);
  editor.focus();

  navigator?.update(editor.getValue());

  if (isPowerPoint) {
    try {
      if (Office.context.requirements.isSetSupported("PowerPointApi", "1.5")) {
        const layoutDisplayName = LAYOUT_OPTIONS.find(l => l.type === layoutType)?.name || layoutType;
        setStatus(`正在插入新幻灯片（版式: ${layoutDisplayName}）...`, "rendering");
        
        const newSlideId = await insertSlideWithLayout(layoutType, true);
        if (newSlideId) {
          setStatus(`已插入分隔符和新幻灯片（版式: ${layoutDisplayName}）`, "success");
        } else {
          setStatus("已插入分隔符，但创建幻灯片失败。请检查 PowerPoint 母版是否包含所需版式。", "error");
        }
      } else {
        setStatus("已插入分隔符。创建幻灯片需要 PowerPoint API 1.5 或更高版本。", "error");
      }
    } catch (err: any) {
      console.warn("Could not insert PowerPoint slide:", err);
      const errorMsg = err.message || String(err);
      if (errorMsg.includes("layout") || errorMsg.includes("Layout")) {
        setStatus(`分隔符已插入，但版式匹配失败。请检查演示文稿母版是否包含所需版式。`, "error");
      } else {
        setStatus(`分隔符已插入，但创建幻灯片失败: ${errorMsg}`, "error");
      }
    }
  } else {
    setStatus("已插入分隔符（浏览器预览模式，幻灯片创建功能需在 PowerPoint 中使用）", "success");
  }
}

async function handleSyncAll() {
  if (!isPowerPoint) {
    setStatus("同步功能需在 PowerPoint 中使用", "error");
    return;
  }

  const markdown = editor.getValue().trim();
  if (!markdown) {
    setStatus("请先输入 Markdown 内容", "error");
    return;
  }

  setStatus("同步全部幻灯片...", "rendering");
  showLoading("同步全部幻灯片...");

  try {
    const progress = (msg: string) => {
      setStatus(msg, "rendering");
      showLoading(msg);
    };

    const result = await syncAllSlides(markdown, progress);

    hideLoading();
    const parts: string[] = [];
    if (result.created > 0) parts.push(`创建 ${result.created}`);
    if (result.updated > 0) parts.push(`更新 ${result.updated}`);
    if (result.deleted > 0) parts.push(`删除 ${result.deleted}`);
    if (result.unchanged > 0) parts.push(`未变 ${result.unchanged}`);
    setStatus(`同步完成: ${parts.join(", ")} (共 ${result.totalSections} 张)`, "success");
  } catch (err: any) {
    console.error("Sync error:", err);
    hideLoading();
    setStatus(`同步失败: ${err.message || err}`, "error");
  }
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
      editor.setValue(source);
      activeSourceSlideId = slideId;
      // Visual feedback: flash the editor border
      const el = editor.getContainer();
      el.classList.remove("source-loaded");
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add("source-loaded");
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

    const currentLayout = await getCurrentSlideLayout();
    if (currentLayout) {
      setSelectedLayoutType(currentLayout);
      const layoutSelect = document.getElementById("slide-layout") as HTMLSelectElement;
      if (layoutSelect) {
        layoutSelect.value = currentLayout;
      }
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

function initHeader() {
  const header = document.getElementById("header-bar")!;
  header.innerHTML = `
    <div class="header-logo">${ICONS.logo}</div>
    <span class="header-title">Slides MD</span>
    <span class="header-badge">Markdown</span>
  `;
}

function init() {
  initFontManager();
  initSourceStore();

  preloadMathFonts()
    .catch((e) => console.warn("Background font preload error:", e));

  const toolbarContainer = document.getElementById("toolbar")!;
  const editorContainer = document.getElementById("editor-container")!;
  statusBar = document.getElementById("status-bar")!;
  notificationBar = document.getElementById("source-notification")!;
  loadingOverlay = document.getElementById("loading-overlay")!;
  loadingText = document.getElementById("loading-text")!;

  initHeader();

  editor = createEditor(editorContainer);
  setGlobalEditor(editor);

  // Create slide navigator
  const navigatorContainer = document.getElementById("slide-navigator-container")!;
  navigator = createSlideNavigator(navigatorContainer, editor, handleSyncAll);

  // Update navigator on content change
  editor.onContentChange(() => {
    navigator?.update(editor.getValue());
  });

  // Highlight active section on cursor move
  editor.onCursorChange((offset) => {
    const md = editor.getValue();
    const sections = parseSlideSections(md);
    for (let i = sections.length - 1; i >= 0; i--) {
      if (offset >= sections[i].startOffset) {
        navigator?.setActiveSection(i);
        break;
      }
    }
  });

  createToolbar(toolbarContainer, {
    onRender: handleRender,
    onNewSlide: handleNewSlide,
    onLoadFromSlide: handleLoadFromSlide,
  });

  renderBtn = document.getElementById("render-btn") as HTMLButtonElement;

  document.getElementById("notification-load-btn")
    ?.addEventListener("click", handleLoadFromSlide);
  document.getElementById("notification-dismiss")
    ?.addEventListener("click", hideNotification);

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
