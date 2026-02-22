/** Shared editor accessor — breaks circular dependency between taskpane ↔ ribbon-commands */

import type { EditorAdapter } from "./editor";

let _editor: EditorAdapter | null = null;

export function setGlobalEditor(e: EditorAdapter): void {
  _editor = e;
}

export function getGlobalEditorValue(): string {
  return _editor?.getValue() ?? "";
}
