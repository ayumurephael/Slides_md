import { parseMarkdown } from './markdown-parser';
import { transformTokens } from './ast-transformer';
import type { InlineRun, ParagraphElement, HeadingElement, ListElement, TableElement, TaskListElement, BlockQuoteElement } from '../types/ir';

function parseToRuns(markdown: string): InlineRun[] {
  const tokens = parseMarkdown(markdown);
  const slides = transformTokens(tokens);
  if (slides.length === 0) return [];
  const firstEl = slides[0].elements[0];
  if (!firstEl) return [];
  if (firstEl.type === 'paragraph' || firstEl.type === 'heading') {
    return (firstEl as ParagraphElement | HeadingElement).runs;
  }
  return [];
}

describe('Inline Code Parsing', () => {
  describe('Basic inline code', () => {
    test('should parse standalone inline code', () => {
      const runs = parseToRuns('`code`');
      expect(runs).toHaveLength(1);
      expect(runs[0].type).toBe('inline_code');
      expect((runs[0] as any).code).toBe('code');
    });

    test('should parse inline code with special characters', () => {
      const runs = parseToRuns('`int main() { return 0; }`');
      expect(runs).toHaveLength(1);
      expect(runs[0].type).toBe('inline_code');
      expect((runs[0] as any).code).toBe('int main() { return 0; }');
    });

    test('should parse inline code with backslash', () => {
      const runs = parseToRuns('`\\n\\t`');
      expect(runs).toHaveLength(1);
      expect(runs[0].type).toBe('inline_code');
    });
  });

  describe('Inline code mixed with text', () => {
    test('should parse inline code with preceding text', () => {
      const runs = parseToRuns('This is `code`');
      expect(runs).toHaveLength(2);
      expect(runs[0].type).toBe('text');
      expect((runs[0] as any).text).toBe('This is ');
      expect(runs[1].type).toBe('inline_code');
      expect((runs[1] as any).code).toBe('code');
    });

    test('should parse inline code with following text', () => {
      const runs = parseToRuns('`code` is here');
      expect(runs).toHaveLength(2);
      expect(runs[0].type).toBe('inline_code');
      expect((runs[0] as any).code).toBe('code');
      expect(runs[1].type).toBe('text');
      expect((runs[1] as any).text).toBe(' is here');
    });

    test('should parse inline code surrounded by text', () => {
      const runs = parseToRuns('This is `code` test');
      expect(runs).toHaveLength(3);
      expect(runs[0].type).toBe('text');
      expect((runs[0] as any).text).toBe('This is ');
      expect(runs[1].type).toBe('inline_code');
      expect((runs[1] as any).code).toBe('code');
      expect(runs[2].type).toBe('text');
      expect((runs[2] as any).text).toBe(' test');
    });
  });

  describe('Multiple inline codes', () => {
    test('should parse two consecutive inline codes', () => {
      const runs = parseToRuns('`const a = 1;` and `let b = 2;`');
      expect(runs.length).toBeGreaterThanOrEqual(3);
      const codeRuns = runs.filter(r => r.type === 'inline_code');
      expect(codeRuns).toHaveLength(2);
      expect((codeRuns[0] as any).code).toBe('const a = 1;');
      expect((codeRuns[1] as any).code).toBe('let b = 2;');
    });

    test('should parse three inline codes', () => {
      const runs = parseToRuns('`a` `b` `c`');
      const codeRuns = runs.filter(r => r.type === 'inline_code');
      expect(codeRuns).toHaveLength(3);
    });
  });

  describe('Inline code in different contexts', () => {
    test('should parse inline code in heading', () => {
      const tokens = parseMarkdown('# Title with `code`');
      const slides = transformTokens(tokens);
      const heading = slides[0].elements[0] as HeadingElement;
      expect(heading.type).toBe('heading');
      expect(heading.runs.some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should parse inline code in list', () => {
      const tokens = parseMarkdown('- Item with `code`');
      const slides = transformTokens(tokens);
      const list = slides[0].elements[0] as ListElement;
      expect(list.type).toBe('list');
      expect(list.items[0].runs.some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should parse inline code in blockquote', () => {
      const tokens = parseMarkdown('> Quote with `code`');
      const slides = transformTokens(tokens);
      const bq = slides[0].elements[0] as BlockQuoteElement;
      expect(bq.type).toBe('blockquote');
      const para = bq.elements[0] as ParagraphElement;
      expect(para.runs.some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should parse inline code in table', () => {
      const tokens = parseMarkdown('| Header |\n|--------|\n| `code` |');
      const slides = transformTokens(tokens);
      const table = slides[0].elements[0] as TableElement;
      expect(table.type).toBe('table');
      expect(table.rows[0][0].some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should parse inline code in task list', () => {
      const tokens = parseMarkdown('- [ ] Task with `code`');
      const slides = transformTokens(tokens);
      const taskList = slides[0].elements[0] as TaskListElement;
      expect(taskList.type).toBe('task_list');
      expect(taskList.items[0].runs.some(r => r.type === 'inline_code')).toBe(true);
    });
  });

  describe('Inline code with inline math', () => {
    test('should parse both inline code and inline math', () => {
      const runs = parseToRuns('Code `x = 1` and math $x^2$');
      expect(runs.some(r => r.type === 'inline_code')).toBe(true);
      expect(runs.some(r => r.type === 'inline_math')).toBe(true);
    });

    test('should parse inline code before inline math', () => {
      const runs = parseToRuns('`code` then $x^2$');
      const codeIdx = runs.findIndex(r => r.type === 'inline_code');
      const mathIdx = runs.findIndex(r => r.type === 'inline_math');
      expect(codeIdx).toBeLessThan(mathIdx);
    });

    test('should parse inline math before inline code', () => {
      const runs = parseToRuns('$x^2$ then `code`');
      const codeIdx = runs.findIndex(r => r.type === 'inline_code');
      const mathIdx = runs.findIndex(r => r.type === 'inline_math');
      expect(mathIdx).toBeLessThan(codeIdx);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty inline code', () => {
      const runs = parseToRuns('``');
      expect(runs.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle inline code with spaces', () => {
      const runs = parseToRuns('`  spaces  `');
      expect(runs).toHaveLength(1);
      expect(runs[0].type).toBe('inline_code');
    });

    test('should handle inline code with Chinese characters', () => {
      const runs = parseToRuns('这是 `代码` 测试');
      expect(runs.length).toBeGreaterThanOrEqual(3);
      expect(runs.some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should handle inline code in bold text', () => {
      const runs = parseToRuns('**bold `code` text**');
      expect(runs.some(r => r.type === 'inline_code')).toBe(true);
    });

    test('should handle inline code in italic text', () => {
      const runs = parseToRuns('*italic `code` text*');
      expect(runs.some(r => r.type === 'inline_code')).toBe(true);
    });
  });
});
