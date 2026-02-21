/**
 * Ribbon command handlers for the SlideMD custom tab.
 * Shared runtime: these functions access the same global state as the taskpane.
 */
import { setZhFont, setEnFont } from "../fonts/font-manager";
import { renderMarkdownIncremental } from "../core/slide-builder";

export async function ribbonRender(): Promise<void> {
  const editor = document.getElementById("md-editor") as HTMLTextAreaElement | null;
  const markdown = editor?.value?.trim();
  if (!markdown) return;

  try {
    await renderMarkdownIncremental(markdown);
  } catch (err) {
    console.error("Ribbon render error:", err);
  }
}

// Chinese font setters
export function setZhFont_微软雅黑() { setZhFont("微软雅黑"); }
export function setZhFont_宋体() { setZhFont("宋体"); }
export function setZhFont_黑体() { setZhFont("黑体"); }
export function setZhFont_楷体() { setZhFont("楷体"); }
export function setZhFont_仿宋() { setZhFont("仿宋"); }
export function setZhFont_华文中宋() { setZhFont("华文中宋"); }
export function setZhFont_华文楷体() { setZhFont("华文楷体"); }
export function setZhFont_华文宋体() { setZhFont("华文宋体"); }

// English font setters
export function setEnFont_Calibri() { setEnFont("Calibri"); }
export function setEnFont_Arial() { setEnFont("Arial"); }
export function setEnFont_TimesNewRoman() { setEnFont("Times New Roman"); }
export function setEnFont_Verdana() { setEnFont("Verdana"); }
export function setEnFont_Georgia() { setEnFont("Georgia"); }
export function setEnFont_Tahoma() { setEnFont("Tahoma"); }
export function setEnFont_SegoeUI() { setEnFont("Segoe UI"); }
export function setEnFont_Cambria() { setEnFont("Cambria"); }

/** Register all ribbon command handlers with Office.actions */
export function registerRibbonCommands(): void {
  // Render
  Office.actions.associate("RenderToSlide", async () => {
    await ribbonRender();
  });

  // Chinese fonts
  Office.actions.associate("SetZhFont_MSYaHei", () => { setZhFont_微软雅黑(); });
  Office.actions.associate("SetZhFont_SimSun", () => { setZhFont_宋体(); });
  Office.actions.associate("SetZhFont_SimHei", () => { setZhFont_黑体(); });
  Office.actions.associate("SetZhFont_KaiTi", () => { setZhFont_楷体(); });
  Office.actions.associate("SetZhFont_FangSong", () => { setZhFont_仿宋(); });
  Office.actions.associate("SetZhFont_STZhongSong", () => { setZhFont_华文中宋(); });
  Office.actions.associate("SetZhFont_STKaiTi", () => { setZhFont_华文楷体(); });
  Office.actions.associate("SetZhFont_STSong", () => { setZhFont_华文宋体(); });

  // English fonts
  Office.actions.associate("SetEnFont_Calibri", () => { setEnFont_Calibri(); });
  Office.actions.associate("SetEnFont_Arial", () => { setEnFont_Arial(); });
  Office.actions.associate("SetEnFont_TimesNewRoman", () => { setEnFont_TimesNewRoman(); });
  Office.actions.associate("SetEnFont_Verdana", () => { setEnFont_Verdana(); });
  Office.actions.associate("SetEnFont_Georgia", () => { setEnFont_Georgia(); });
  Office.actions.associate("SetEnFont_Tahoma", () => { setEnFont_Tahoma(); });
  Office.actions.associate("SetEnFont_SegoeUI", () => { setEnFont_SegoeUI(); });
  Office.actions.associate("SetEnFont_Cambria", () => { setEnFont_Cambria(); });
}
