/**
 * Persistent storage for Markdown source per slide.
 * Uses Office Document Settings API to persist data in the .pptx file.
 * Falls back to in-memory storage when Settings API is unavailable.
 */

const SOURCE_PREFIX = "slideMD_src_";
const memoryStore = new Map<string, string>();

let settingsAvailable = false;

export function initSourceStore(): void {
  try {
    settingsAvailable = !!Office.context?.document?.settings;
  } catch {
    settingsAvailable = false;
  }
}

/** Save Markdown source for a slide (by slide ID) */
export async function saveSlideSource(
  slideId: string,
  markdown: string
): Promise<void> {
  if (!settingsAvailable) {
    memoryStore.set(slideId, markdown);
    return;
  }

  Office.context.document.settings.set(SOURCE_PREFIX + slideId, markdown);
  return new Promise<void>((resolve, reject) => {
    Office.context.document.settings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(result.error?.message || "保存源内容失败"));
    });
  });
}

/** Load Markdown source for a slide (by slide ID). Returns null if none stored. */
export function loadSlideSource(slideId: string): string | null {
  if (!settingsAvailable) {
    return memoryStore.get(slideId) ?? null;
  }
  return Office.context.document.settings.get(
    SOURCE_PREFIX + slideId
  ) as string | null;
}

/** Get the current slide's unique ID */
export async function getCurrentSlideId(): Promise<string> {
  return PowerPoint.run(async (context) => {
    const slide = context.presentation.getSelectedSlides().getItemAt(0);
    slide.load("id");
    await context.sync();
    return slide.id;
  });
}
