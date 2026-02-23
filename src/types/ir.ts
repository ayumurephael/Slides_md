/** 幻灯片中间表示 (Intermediate Representation) */

export interface SlideIR {
  elements: SlideElement[];
}

export type SlideElement =
  | HeadingElement
  | ParagraphElement
  | ListElement
  | CodeBlockElement
  | BlockQuoteElement
  | ImageElement
  | BlockMathElement
  | TableElement
  | TaskListElement
  | AdmonitionElement
  | TikZElement
  | AlgorithmElement;

export interface HeadingElement {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  runs: InlineRun[];
}

export interface ParagraphElement {
  type: "paragraph";
  runs: InlineRun[];
}

export interface ListElement {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}

export interface ListItem {
  runs: InlineRun[];
  children?: ListElement;
}

export interface CodeBlockElement {
  type: "code_block";
  language: string;
  code: string;
}

export interface BlockQuoteElement {
  type: "blockquote";
  elements: SlideElement[];
}

export interface ImageElement {
  type: "image";
  src: string;
  alt: string;
}

export interface BlockMathElement {
  type: "block_math";
  latex: string;
}

export interface TaskListElement {
  type: "task_list";
  items: TaskListItem[];
}

export interface TaskListItem {
  checked: boolean;
  runs: InlineRun[];
}

export type AdmonitionType = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

export interface AdmonitionElement {
  type: "admonition";
  admonitionType: AdmonitionType;
  elements: SlideElement[];
}

export interface TikZElement {
  type: "tikz";
  code: string;
}

export interface AlgorithmElement {
  type: "algorithm";
  code: string;
}

export interface TableElement {
  type: "table";
  headers: InlineRun[][];
  rows: InlineRun[][][];
}

export type InlineRun = TextRun | InlineMathRun | InlineCodeRun | LinkRun | InlineImageRun | ExplicitBreakRun;

export interface TextRun {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface ExplicitBreakRun {
  type: "explicit_break";
}

export interface InlineMathRun {
  type: "inline_math";
  latex: string;
  displayMode?: boolean;
}

export interface InlineCodeRun {
  type: "inline_code";
  code: string;
}

export interface LinkRun {
  type: "link";
  href: string;
  text: string;
}

export interface InlineImageRun {
  type: "inline_image";
  src: string;
  alt: string;
}

/** 渲染选项 */
export interface RenderOptions {
  fontFamily: string; // CSS font-family string (e.g. '"Calibri", "微软雅黑"')
  fontSize: number; // points
  fontColor: string; // hex e.g. "#000000"
  headingFontFamily?: string;
  codeFontFamily: string;
  zhFontFamily: string; // Chinese font name for Office.js
  enFontFamily: string; // English font name for Office.js
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  fontFamily: '"Calibri", "微软雅黑"',
  fontSize: 18,
  fontColor: "#333333",
  headingFontFamily: undefined,
  codeFontFamily: "Consolas",
  zhFontFamily: "微软雅黑",
  enFontFamily: "Calibri",
};

/** Mapping between markdown sections and PowerPoint slide IDs */
export interface SlideMapping {
  sectionToSlideId: string[];      // index = markdown section index, value = slide ID
  sectionFingerprints: string[];   // per-section fingerprint for change detection
}

/** 数学公式渲染结果 */
export interface MathRenderResult {
  base64: string; // data:image/png;base64,...
  widthPt: number;
  heightPt: number;
}
