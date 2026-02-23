/**
 * Slide layout management module
 * Handles layout types, detection, and slide creation with specific layouts
 */

export type LayoutType =
  | "title"
  | "titleAndContent"
  | "sectionHeader"
  | "twoContent"
  | "comparison"
  | "titleOnly"
  | "blank";

export interface LayoutInfo {
  type: LayoutType;
  name: string;
  description: string;
}

export const LAYOUT_OPTIONS: LayoutInfo[] = [
  { type: "title", name: "标题幻灯片", description: "适用于演示文稿的开头，包含标题和副标题" },
  { type: "titleAndContent", name: "标题和内容", description: "包含标题和单一内容区域" },
  { type: "sectionHeader", name: "节标题", description: "适用于分隔演示文稿的不同部分" },
  { type: "twoContent", name: "两栏内容", description: "包含标题和两个并排的内容区域" },
  { type: "comparison", name: "比较", description: "包含标题和两个用于比较的内容区域" },
  { type: "titleOnly", name: "仅标题", description: "只包含标题，其余区域为空白" },
  { type: "blank", name: "空白", description: "完全空白的幻灯片" },
];

const LAYOUT_NAME_PATTERNS: Record<LayoutType, RegExp[]> = {
  title: [
    /title\s*slide/i,
    /^title$/i,
    /标题幻灯片/,
    /^标题$/,
    /封面/,
    /首页/,
    /title\s*page/i,
    /slide\s*title/i,
  ],
  titleAndContent: [
    /title\s*and\s*content/i,
    /title\s*&\s*content/i,
    /title,?\s*content/i,
    /标题和内容/,
    /标题与内容/,
    /标题内容/,
    /title\s*content/i,
    /内容/,
  ],
  sectionHeader: [
    /section\s*header/i,
    /section\s*title/i,
    /节标题/,
    /章节标题/,
    /section/i,
    /章节/,
    /分隔/,
    /transition/i,
  ],
  twoContent: [
    /two\s*content/i,
    /two\s*column/i,
    /两栏内容/,
    /两栏/,
    /双栏/,
    /two\s*text/i,
    /2\s*content/i,
    /双内容/,
    /并列/,
  ],
  comparison: [
    /comparison/i,
    /比较/,
    /对比/,
    /compare/i,
    /对比内容/,
    /对照/,
  ],
  titleOnly: [
    /title\s*only/i,
    /仅标题/,
    /只有标题/,
    /纯标题/,
    /单标题/,
  ],
  blank: [
    /blank/i,
    /空白/,
    /empty/i,
    /无内容/,
    /clean/i,
  ],
};

/** Check specific layout types before generic ones to avoid false matches */
const MATCH_ORDER: LayoutType[] = [
  "titleAndContent",
  "sectionHeader",
  "twoContent",
  "comparison",
  "titleOnly",
  "blank",
  "title",
];

/** Standard PowerPoint layout index positions (built-in themes) */
const LAYOUT_INDEX_FALLBACK: Record<LayoutType, number> = {
  title: 0,
  titleAndContent: 1,
  sectionHeader: 2,
  twoContent: 3,
  comparison: 4,
  titleOnly: 5,
  blank: 6,
};

const LAYOUT_ID_HINTS: Record<LayoutType, string[]> = {
  title: ["title", "1"],
  titleAndContent: ["titleandcontent", "content", "2"],
  sectionHeader: ["section", "header", "3"],
  twoContent: ["twocontent", "twocolumn", "4"],
  comparison: ["comparison", "5"],
  titleOnly: ["titleonly", "6"],
  blank: ["blank", "7"],
};

export function matchLayoutType(layoutName: string): LayoutType {
  const lowerName = layoutName.toLowerCase();

  // Match specific types first to avoid false positives (e.g. "标题" matching "标题和内容")
  for (const type of MATCH_ORDER) {
    for (const pattern of LAYOUT_NAME_PATTERNS[type]) {
      if (pattern.test(layoutName)) {
        return type;
      }
    }
  }

  for (const type of MATCH_ORDER) {
    for (const hint of LAYOUT_ID_HINTS[type]) {
      if (lowerName.includes(hint.toLowerCase())) {
        return type;
      }
    }
  }

  return "titleAndContent";
}

export async function getCurrentSlideLayout(): Promise<LayoutType | null> {
  try {
    return await PowerPoint.run(async (context) => {
      const selectedSlides = context.presentation.getSelectedSlides();
      selectedSlides.load("items");
      await context.sync();

      if (selectedSlides.items.length === 0) {
        return null;
      }

      const slide = selectedSlides.items[0];
      const layout = slide.layout;
      layout.load("name, id");
      await context.sync();

      const layoutName = layout.name || "";
      const layoutId = (layout as any).id || "";
      
      console.log(`Current layout - name: "${layoutName}", id: "${layoutId}"`);

      return matchLayoutType(layoutName);
    });
  } catch (err) {
    console.warn("Failed to get current slide layout:", err);
    return null;
  }
}

export async function getCurrentSlideIndex(): Promise<number> {
  try {
    return await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();

      const selectedSlides = context.presentation.getSelectedSlides();
      selectedSlides.load("items");
      await context.sync();

      if (selectedSlides.items.length === 0) {
        return slides.items.length;
      }

      const selectedSlide = selectedSlides.items[0];
      const selectedId = selectedSlide.id;
      selectedSlide.load("id");
      await context.sync();

      for (let i = 0; i < slides.items.length; i++) {
        slides.items[i].load("id");
      }
      await context.sync();

      for (let i = 0; i < slides.items.length; i++) {
        if (slides.items[i].id === selectedId) {
          return i;
        }
      }

      return slides.items.length;
    });
  } catch (err) {
    console.warn("Failed to get current slide index:", err);
    return 0;
  }
}

export async function getAvailableLayouts(): Promise<{ id: string; name: string }[]> {
  try {
    return await PowerPoint.run(async (context) => {
      const slideMaster = context.presentation.slideMasters.getItemAt(0);
      const layouts = slideMaster.layouts;
      layouts.load("items");
      await context.sync();

      const result: { id: string; name: string }[] = [];
      
      for (const layout of layouts.items) {
        layout.load("id, name");
      }
      await context.sync();

      for (const layout of layouts.items) {
        result.push({
          id: layout.id,
          name: layout.name || "",
        });
      }

      console.log("Available layouts:", result);
      return result;
    });
  } catch (err) {
    console.error("Failed to get available layouts:", err);
    return [];
  }
}

export async function insertSlideWithLayout(
  layoutType: LayoutType,
  insertAfterCurrent: boolean = true
): Promise<string | null> {
  try {
    return await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();

      let insertIndex = slides.items.length;
      let targetLayoutId: string | null = null;
      let matchedLayoutName: string | null = null;

      if (insertAfterCurrent) {
        const selectedSlides = context.presentation.getSelectedSlides();
        selectedSlides.load("items");
        await context.sync();

        if (selectedSlides.items.length > 0) {
          const currentSlide = selectedSlides.items[0];
          currentSlide.load("id");
          await context.sync();
          const currentId = currentSlide.id;

          for (let i = 0; i < slides.items.length; i++) {
            slides.items[i].load("id");
          }
          await context.sync();

          for (let i = 0; i < slides.items.length; i++) {
            if (slides.items[i].id === currentId) {
              insertIndex = i + 1;
              break;
            }
          }
        }
      }

      const slideMaster = context.presentation.slideMasters.getItemAt(0);
      const layouts = slideMaster.layouts;
      layouts.load("items");
      await context.sync();

      const layoutPatterns = LAYOUT_NAME_PATTERNS[layoutType];
      const layoutHints = LAYOUT_ID_HINTS[layoutType];
      
      for (const layout of layouts.items) {
        layout.load("id, name");
      }
      await context.sync();

      const availableLayouts = layouts.items.map(l => ({ id: l.id, name: l.name || "" }));
      console.log(`[Layout Match] Looking for "${layoutType}" among ${availableLayouts.length} layouts:`,
        availableLayouts.map(l => `"${l.name}"`).join(", "));

      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const layout of layouts.items) {
        const layoutName = layout.name || "";
        const layoutId = layout.id.toLowerCase();
        let score = 0;

        for (const pattern of layoutPatterns) {
          if (pattern.test(layoutName)) {
            score = Math.max(score, pattern.source.length > 5 ? 100 : 80);
            console.log(`[Layout Match] Pattern "${pattern}" matched layout "${layoutName}" (score: ${score})`);
          }
        }

        for (const hint of layoutHints) {
          if (layoutId.includes(hint.toLowerCase())) {
            score = Math.max(score, 50);
            console.log(`[Layout Match] ID hint "${hint}" matched layout ID "${layoutId}" (score: 50)`);
          }
          if (layoutName.toLowerCase().includes(hint.toLowerCase())) {
            score = Math.max(score, 60);
            console.log(`[Layout Match] Name hint "${hint}" matched layout name "${layoutName}" (score: 60)`);
          }
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: layout.id, name: layoutName, score };
        }
      }

      if (bestMatch && bestMatch.score >= 50) {
        targetLayoutId = bestMatch.id;
        matchedLayoutName = bestMatch.name;
        console.log(`[Layout Match] Best match for "${layoutType}": "${matchedLayoutName}" (score: ${bestMatch.score})`);
      }

      if (!targetLayoutId) {
        const fallbackIndex = LAYOUT_INDEX_FALLBACK[layoutType];
        if (fallbackIndex !== undefined && fallbackIndex < layouts.items.length) {
          targetLayoutId = layouts.items[fallbackIndex].id;
          matchedLayoutName = layouts.items[fallbackIndex].name || "";
          console.log(`[Layout Match] Using index fallback: index ${fallbackIndex} -> "${matchedLayoutName}"`);
        }
      }

      if (!targetLayoutId && layouts.items.length > 0) {
        targetLayoutId = layouts.items[0].id;
        matchedLayoutName = layouts.items[0].name || "";
        console.log(`[Layout Match] Using first available layout as last resort: "${matchedLayoutName}"`);
      }

      const addOptions: PowerPoint.AddSlideOptions = {};
      if (targetLayoutId) {
        addOptions.layoutId = targetLayoutId;
        console.log(`[Layout Match] Creating slide with layoutId: ${targetLayoutId} ("${matchedLayoutName}")`);
      } else {
        console.warn(`[Layout Match] No layout found for type "${layoutType}", using default`);
      }

      slides.add(addOptions);
      await context.sync();

      slides.load("items");
      await context.sync();

      const newSlide = slides.items[slides.items.length - 1];
      newSlide.load("id");
      await context.sync();

      const newSlideId = newSlide.id;

      if (insertIndex < slides.items.length - 1) {
        newSlide.moveTo(insertIndex);
        await context.sync();
      }

      console.log(`[Layout Match] Successfully created slide ${newSlideId} with layout "${layoutType}"`);
      return newSlideId;
    });
  } catch (err) {
    console.error("[Layout Match] Failed to insert slide with layout:", err);
    return null;
  }
}

export async function insertSlideAtPosition(
  layoutType: LayoutType,
  position: number
): Promise<string | null> {
  try {
    return await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();

      let targetLayoutId: string | null = null;

      const slideMaster = context.presentation.slideMasters.getItemAt(0);
      const layouts = slideMaster.layouts;
      layouts.load("items");
      await context.sync();

      const layoutPatterns = LAYOUT_NAME_PATTERNS[layoutType];
      const layoutHints = LAYOUT_ID_HINTS[layoutType];
      
      for (const layout of layouts.items) {
        layout.load("id, name");
      }
      await context.sync();

      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const layout of layouts.items) {
        const layoutName = layout.name || "";
        const layoutId = layout.id.toLowerCase();
        let score = 0;

        for (const pattern of layoutPatterns) {
          if (pattern.test(layoutName)) {
            score = Math.max(score, pattern.source.length > 5 ? 100 : 80);
          }
        }

        for (const hint of layoutHints) {
          if (layoutId.includes(hint.toLowerCase())) {
            score = Math.max(score, 50);
          }
          if (layoutName.toLowerCase().includes(hint.toLowerCase())) {
            score = Math.max(score, 60);
          }
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: layout.id, name: layoutName, score };
        }
      }

      if (bestMatch && bestMatch.score >= 50) {
        targetLayoutId = bestMatch.id;
      }

      if (!targetLayoutId) {
        const fallbackIndex = LAYOUT_INDEX_FALLBACK[layoutType];
        if (fallbackIndex !== undefined && fallbackIndex < layouts.items.length) {
          targetLayoutId = layouts.items[fallbackIndex].id;
        }
      }

      if (!targetLayoutId && layouts.items.length > 0) {
        targetLayoutId = layouts.items[0].id;
      }

      const addOptions: PowerPoint.AddSlideOptions = {};
      if (targetLayoutId) {
        addOptions.layoutId = targetLayoutId;
      }

      slides.add(addOptions);
      await context.sync();

      slides.load("items");
      await context.sync();

      const newSlide = slides.items[slides.items.length - 1];
      newSlide.load("id");
      await context.sync();

      return newSlide.id;
    });
  } catch (err) {
    console.error("[Layout Match] Failed to insert slide at position:", err);
    return null;
  }
}
