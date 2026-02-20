import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import ins from "markdown-it-ins";
import taskLists from "markdown-it-task-lists";
import katex from "katex";

let mdInstance: MarkdownIt | null = null;
let previewInstance: MarkdownIt | null = null;

const TEXMATH_DELIMITERS = ["dollars", "brackets", "beg_end"];

function applyPlugins(md: MarkdownIt, useKatex: boolean): MarkdownIt {
  md.use(texmath, {
    engine: useKatex ? katex : { renderToString: (s: string) => s },
    delimiters: TEXMATH_DELIMITERS,
    ...(useKatex ? { katexOptions: { throwOnError: false } } : {}),
  });
  md.use(ins);
  md.use(taskLists, { enabled: true });
  return md;
}

export function getParser(): MarkdownIt {
  if (mdInstance) return mdInstance;
  mdInstance = new MarkdownIt({ html: false, linkify: true, typographer: false });
  applyPlugins(mdInstance, false);
  return mdInstance;
}

export function parseMarkdown(src: string): ReturnType<MarkdownIt["parse"]> {
  return getParser().parse(src, {});
}

/** Render markdown to HTML string (for preview) */
export function renderMarkdownHTML(src: string): string {
  if (!previewInstance) {
    previewInstance = new MarkdownIt({ html: false, linkify: true });
    applyPlugins(previewInstance, true);
  }
  return previewInstance.render(src);
}
