/**
 * Sync engine — distributes markdown sections to PowerPoint slides.
 * Each --- separated section maps to one slide.
 */

import type { SlideIR, SlideMapping } from "../types/ir";
import { parseMarkdown } from "./markdown-parser";
import { transformTokens } from "./ast-transformer";
import { djb2, fingerprintElement } from "./diff-engine";
import { getRenderOptions } from "../fonts/font-manager";
import { preloadMathFonts } from "./math-renderer";
import {
  saveSlideMapping,
  loadSlideMapping,
  saveFullSource,
  saveSlideSource,
  saveRenderState,
  getAllSlideIds,
} from "./source-store";
import { buildSingleSlide, clearSlideMDShapesOnSlide } from "./slide-builder";
import { insertSlideWithLayout, type LayoutType } from "./slide-layouts";

export interface SyncResult {
  totalSections: number;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

type ProgressCallback = (msg: string) => void;

/** Compute a fingerprint for an entire section (all elements combined) */
function sectionFingerprint(slideIR: SlideIR): string {
  const parts = slideIR.elements.map(fingerprintElement);
  return djb2(parts.join("|"));
}

/** Split markdown by --- into raw section strings */
function splitMarkdownSections(markdown: string): string[] {
  return markdown.split(/^---$/m).map((s) => s.trim());
}

/** Sync all markdown sections to PowerPoint slides */
export async function syncAllSlides(
  markdown: string,
  onProgress?: ProgressCallback
): Promise<SyncResult> {
  await preloadMathFonts();
  const options = getRenderOptions();

  onProgress?.("解析 Markdown...");
  const rawSections = splitMarkdownSections(markdown);
  // Parse each section independently
  const slideIRs: SlideIR[] = rawSections.map((section) => {
    const tokens = parseMarkdown(section);
    const slides = transformTokens(tokens);
    return { elements: slides.flatMap((s) => s.elements) };
  });

  const totalSections = slideIRs.length;
  const newFingerprints = slideIRs.map(sectionFingerprint);

  onProgress?.("加载映射关系...");
  const oldMapping = loadSlideMapping();
  const existingSlideIds = await getAllSlideIds();
  const existingSet = new Set(existingSlideIds);

  // Validate old mapping — remove entries whose slides no longer exist
  const validOldIds: (string | null)[] = [];
  const validOldFingerprints: (string | null)[] = [];
  if (oldMapping) {
    for (let i = 0; i < oldMapping.sectionToSlideId.length; i++) {
      const id = oldMapping.sectionToSlideId[i];
      if (existingSet.has(id)) {
        validOldIds.push(id);
        validOldFingerprints.push(oldMapping.sectionFingerprints[i] ?? null);
      } else {
        validOldIds.push(null);
        validOldFingerprints.push(null);
      }
    }
  }

  const newSlideIds: string[] = [];
  let created = 0, updated = 0, unchanged = 0, deleted = 0;

  // Process each section
  for (let i = 0; i < totalSections; i++) {
    const slideIR = slideIRs[i];
    const fp = newFingerprints[i];
    const oldId = i < validOldIds.length ? validOldIds[i] : null;
    const oldFp = i < validOldFingerprints.length ? validOldFingerprints[i] : null;

    if (oldId && oldFp === fp) {
      // Unchanged
      onProgress?.(`幻灯片 ${i + 1}/${totalSections}: 无变化`);
      newSlideIds.push(oldId);
      unchanged++;
    } else if (oldId) {
      // Exists but changed — clear and rebuild
      onProgress?.(`幻灯片 ${i + 1}/${totalSections}: 更新中...`);
      await clearSlideMDShapesOnSlide(oldId);
      const buildResult = await buildSingleSlide(slideIR, options, oldId, onProgress);
      newSlideIds.push(oldId);
      // Save per-slide render state
      saveRenderState(oldId, {
        fingerprints: slideIR.elements.map(fingerprintElement),
        nextYs: buildResult.nextYs,
        elementCount: slideIR.elements.length,
        optionsHash: "",
      });
      await saveSlideSource(oldId, rawSections[i]);
      updated++;
    } else {
      // New section — create slide
      onProgress?.(`幻灯片 ${i + 1}/${totalSections}: 创建中...`);
      const newId = await insertSlideWithLayout("blank", false)
        ?? await PowerPoint.run(async (ctx) => {
          ctx.presentation.slides.add();
          await ctx.sync();
          const slides = ctx.presentation.slides;
          slides.load("items/id");
          await ctx.sync();
          return slides.items[slides.items.length - 1].id;
        });
      const buildResult = await buildSingleSlide(slideIR, options, newId, onProgress);
      newSlideIds.push(newId);
      saveRenderState(newId, {
        fingerprints: slideIR.elements.map(fingerprintElement),
        nextYs: buildResult.nextYs,
        elementCount: slideIR.elements.length,
        optionsHash: "",
      });
      await saveSlideSource(newId, rawSections[i]);
      created++;
    }
  }

  // Delete excess slides (old mapping had more sections)
  if (oldMapping) {
    for (let i = totalSections; i < validOldIds.length; i++) {
      const oldId = validOldIds[i];
      if (oldId && existingSet.has(oldId)) {
        onProgress?.(`删除多余幻灯片 ${i + 1}...`);
        try {
          await PowerPoint.run(async (ctx) => {
            const slide = ctx.presentation.slides.getItem(oldId);
            slide.delete();
            await ctx.sync();
          });
          deleted++;
        } catch (err) {
          console.warn("Failed to delete slide:", oldId, err);
        }
      }
    }
  }

  // Save updated mapping
  onProgress?.("保存映射关系...");
  const newMapping: SlideMapping = {
    sectionToSlideId: newSlideIds,
    sectionFingerprints: newFingerprints,
  };
  await saveSlideMapping(newMapping);
  await saveFullSource(markdown);

  return { totalSections, created, updated, deleted, unchanged };
}
