declare module "markdown-it-texmath" {
  import MarkdownIt from "markdown-it";
  const plugin: MarkdownIt.PluginWithOptions;
  export default plugin;
}

declare module "markdown-it-ins" {
  import MarkdownIt from "markdown-it";
  const plugin: MarkdownIt.PluginSimple;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  import MarkdownIt from "markdown-it";
  const plugin: MarkdownIt.PluginWithOptions;
  export default plugin;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "markdown-it/lib/token.mjs" {
  export type Nesting = 1 | 0 | -1;
  export default class Token {
    type: string;
    tag: string;
    attrs: [string, string][] | null;
    map: [number, number] | null;
    nesting: Nesting;
    level: number;
    children: Token[] | null;
    content: string;
    markup: string;
    info: string;
    meta: any;
    block: boolean;
    hidden: boolean;
    constructor(type: string, tag: string, nesting: Nesting);
    attrIndex(name: string): number;
    attrPush(attrData: [string, string]): void;
    attrSet(name: string, value: string): void;
    attrGet(name: string): string | null;
    attrJoin(name: string, value: string): void;
  }
}

// Augment PowerPoint ShapeCollection with addImage (PowerPointApi 1.8+)
declare namespace PowerPoint {
  interface ShapeCollection {
    addImage(
      base64ImageString: string,
      options?: PowerPoint.ShapeAddOptions
    ): PowerPoint.Shape;
  }
}
