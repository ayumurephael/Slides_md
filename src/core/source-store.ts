/**
 * Persistent storage for Markdown source per slide.
 * Uses Office Document Settings API to persist data in the .pptx file.
 * Falls back to in-memory storage when Settings API is unavailable.
 */

import type { RenderState } from "./diff-engine";
import type { SlideMapping } from "../types/ir";

const SOURCE_PREFIX = "slideMD_src_";
const MAPPING_KEY = "slideMD_mapping";
const FULL_SOURCE_KEY = "slideMD_fullSource";
const memoryStore = new Map<string, string>();

/** In-memory render state cache (session-only, not persisted to .pptx) */
const renderStateStore = new Map<string, RenderState>();

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

/** Save render state for a slide (session-only, not persisted) */
export function saveRenderState(slideId: string, state: RenderState): void {
  renderStateStore.set(slideId, state);
}

/** Load render state for a slide. Returns null if none stored. */
export function loadRenderState(slideId: string): RenderState | null {
  return renderStateStore.get(slideId) ?? null;
}

/** Clear render state for a slide (e.g. when shapes are manually deleted) */
export function clearRenderState(slideId: string): void {
  renderStateStore.delete(slideId);
}

// ── Slide mapping persistence ──

/** Save slide mapping (section → slide ID) */
export async function saveSlideMapping(mapping: SlideMapping): Promise<void> {
  const json = JSON.stringify(mapping);
  if (!settingsAvailable) {
    memoryStore.set(MAPPING_KEY, json);
    return;
  }
  Office.context.document.settings.set(MAPPING_KEY, json);
  return new Promise<void>((resolve, reject) => {
    Office.context.document.settings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(result.error?.message || "保存映射失败"));
    });
  });
}

/** Load slide mapping. Returns null if none stored. */
export function loadSlideMapping(): SlideMapping | null {
  let json: string | null;
  if (!settingsAvailable) {
    json = memoryStore.get(MAPPING_KEY) ?? null;
  } else {
    json = Office.context.document.settings.get(MAPPING_KEY) as string | null;
  }
  if (!json) return null;
  try {
    return JSON.parse(json) as SlideMapping;
  } catch {
    return null;
  }
}

/** Save full markdown source (for sync-all) */
export async function saveFullSource(markdown: string): Promise<void> {
  if (!settingsAvailable) {
    memoryStore.set(FULL_SOURCE_KEY, markdown);
    return;
  }
  Office.context.document.settings.set(FULL_SOURCE_KEY, markdown);
  return new Promise<void>((resolve, reject) => {
    Office.context.document.settings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(result.error?.message || "保存全量源内容失败"));
    });
  });
}

/** Load full markdown source. Returns null if none stored. */
export function loadFullSource(): string | null {
  if (!settingsAvailable) {
    return memoryStore.get(FULL_SOURCE_KEY) ?? null;
  }
  return Office.context.document.settings.get(FULL_SOURCE_KEY) as string | null;
}

/** Get all slide IDs in presentation order */
export async function getAllSlideIds(): Promise<string[]> {
  return PowerPoint.run(async (context) => {
    const slides = context.presentation.slides;
    slides.load("items/id");
    await context.sync();
    return slides.items.map((s) => s.id);
  });
}
