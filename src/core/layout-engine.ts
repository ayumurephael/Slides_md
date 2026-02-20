/** Slide layout constants (in points, 10" x 7.5" = 720 x 540 pt) */

export const SLIDE = {
  WIDTH: 720,
  HEIGHT: 540,
  MARGIN_LEFT: 48,
  MARGIN_RIGHT: 48,
  MARGIN_TOP: 48,
  MARGIN_BOTTOM: 36,
};

export const CONTENT_WIDTH = SLIDE.WIDTH - SLIDE.MARGIN_LEFT - SLIDE.MARGIN_RIGHT; // 624pt

/** Font sizes for heading levels (in points) */
export const HEADING_SIZES: Record<number, number> = {
  1: 36,
  2: 28,
  3: 24,
  4: 20,
  5: 18,
  6: 16,
};

/** Spacing after each element type (in points) */
export const ELEMENT_SPACING: Record<string, number> = {
  heading: 16,
  paragraph: 12,
  code_block: 14,
  blockquote: 14,
  list: 12,
  block_math: 16,
  image: 14,
  table: 14,
};

/** List indentation per level */
export const LIST_INDENT = 24; // pt

/** Blockquote bar width */
export const QUOTE_BAR_WIDTH = 4;
export const QUOTE_BAR_COLOR = "#4A90D9";
export const QUOTE_INDENT = 20;

/** Code block styling */
export const CODE_BG_COLOR = "#F5F5F5";
export const CODE_PADDING = 12;
