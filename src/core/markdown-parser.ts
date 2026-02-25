import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import ins from "markdown-it-ins";
import taskLists from "markdown-it-task-lists";
import katex from "katex";

let mdInstance: MarkdownIt | null = null;
let previewInstance: MarkdownIt | null = null;

const TEXMATH_DELIMITERS = ["dollars", "brackets", "beg_end"];

const KATEX_OPTIONS = {
  throwOnError: false,
  output: "html" as const,
  strict: false,
  trust: true,
};

function applyPlugins(md: MarkdownIt, useKatex: boolean): MarkdownIt {
  (texmath as any).katex = undefined;

  md.use(texmath, {
    engine: useKatex ? katex : { renderToString: (s: string) => s },
    delimiters: TEXMATH_DELIMITERS,
    ...(useKatex ? { katexOptions: KATEX_OPTIONS } : {}),
  });
  md.use(ins);
  md.use(taskLists, { enabled: true });
  return md;
}

export function getParser(): MarkdownIt {
  if (mdInstance) return mdInstance;
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  try {
    applyPlugins(md, false);
  } catch (err) {
    console.error("Failed to apply markdown-it plugins:", err);
    try {
      (texmath as any).katex = undefined;
      applyPlugins(md, false);
    } catch (retryErr) {
      console.error("Plugin retry also failed:", retryErr);
      return md;
    }
  }
  mdInstance = md;
  return mdInstance;
}

export function parseMarkdown(src: string): ReturnType<MarkdownIt["parse"]> {
  return getParser().parse(src, {});
}

export function renderMarkdownHTML(src: string): string {
  if (!previewInstance) {
    const md = new MarkdownIt({ html: true, linkify: true });
    try {
      applyPlugins(md, true);
    } catch (err) {
      console.error("Failed to apply preview plugins:", err);
      return md.render(src);
    }
    previewInstance = md;
  }
  return previewInstance.render(src);
}

export function resetParserCache(): void {
  mdInstance = null;
  previewInstance = null;
  (texmath as any).katex = undefined;
}
