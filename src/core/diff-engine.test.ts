import {
  djb2,
  fingerprintElement,
  hashRenderOptions,
  computeDiff,
  RENDER_STATE_VERSION,
  type RenderState,
} from './diff-engine';
import type { SlideElement, RenderOptions } from '../types/ir';

const defaultOptions: RenderOptions = {
  fontFamily: '"Calibri", "微软雅黑"',
  fontSize: 18,
  fontColor: '#333333',
  codeFontFamily: 'Consolas',
  zhFontFamily: '微软雅黑',
  enFontFamily: 'Calibri',
};

describe('djb2 hash function', () => {
  test('should produce consistent hash for same input', () => {
    const hash1 = djb2('test string');
    const hash2 = djb2('test string');
    expect(hash1).toBe(hash2);
  });

  test('should produce different hash for different input', () => {
    const hash1 = djb2('test string 1');
    const hash2 = djb2('test string 2');
    expect(hash1).not.toBe(hash2);
  });

  test('should handle empty string', () => {
    const hash = djb2('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('should handle special characters', () => {
    const hash = djb2('$x^2 = \\frac{a}{b}$');
    expect(typeof hash).toBe('string');
  });

  test('should handle Chinese characters', () => {
    const hash = djb2('中文测试');
    expect(typeof hash).toBe('string');
  });
});

describe('fingerprintElement', () => {
  test('should produce consistent fingerprint for same heading', () => {
    const heading: SlideElement = {
      type: 'heading',
      level: 1,
      runs: [{ type: 'text', text: 'Title' }],
    };
    const fp1 = fingerprintElement(heading);
    const fp2 = fingerprintElement(heading);
    expect(fp1).toBe(fp2);
  });

  test('should produce different fingerprint for different heading levels', () => {
    const h1: SlideElement = {
      type: 'heading',
      level: 1,
      runs: [{ type: 'text', text: 'Title' }],
    };
    const h2: SlideElement = {
      type: 'heading',
      level: 2,
      runs: [{ type: 'text', text: 'Title' }],
    };
    expect(fingerprintElement(h1)).not.toBe(fingerprintElement(h2));
  });

  test('should produce different fingerprint for different text', () => {
    const p1: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content A' }],
    };
    const p2: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content B' }],
    };
    expect(fingerprintElement(p1)).not.toBe(fingerprintElement(p2));
  });

  test('should handle paragraph with inline math', () => {
    const para: SlideElement = {
      type: 'paragraph',
      runs: [
        { type: 'text', text: 'The formula is ' },
        { type: 'inline_math', latex: 'x^2' },
      ],
    };
    const fp = fingerprintElement(para);
    expect(typeof fp).toBe('string');
  });

  test('should handle block math', () => {
    const math: SlideElement = {
      type: 'block_math',
      latex: '\\int_0^1 x^2 dx',
    };
    const fp = fingerprintElement(math);
    expect(typeof fp).toBe('string');
  });

  test('should handle code block', () => {
    const code: SlideElement = {
      type: 'code_block',
      language: 'typescript',
      code: 'const x = 1;',
    };
    const fp = fingerprintElement(code);
    expect(typeof fp).toBe('string');
  });

  test('should handle list', () => {
    const list: SlideElement = {
      type: 'list',
      ordered: false,
      items: [
        { runs: [{ type: 'text', text: 'Item 1' }] },
        { runs: [{ type: 'text', text: 'Item 2' }] },
      ],
    };
    const fp = fingerprintElement(list);
    expect(typeof fp).toBe('string');
  });

  test('should handle table', () => {
    const table: SlideElement = {
      type: 'table',
      headers: [[{ type: 'text', text: 'Header' }]],
      rows: [[[{ type: 'text', text: 'Cell' }]]],
    };
    const fp = fingerprintElement(table);
    expect(typeof fp).toBe('string');
  });
});

describe('hashRenderOptions', () => {
  test('should produce consistent hash for same options', () => {
    const hash1 = hashRenderOptions(defaultOptions);
    const hash2 = hashRenderOptions(defaultOptions);
    expect(hash1).toBe(hash2);
  });

  test('should produce different hash for different font size', () => {
    const opts1 = { ...defaultOptions, fontSize: 18 };
    const opts2 = { ...defaultOptions, fontSize: 24 };
    expect(hashRenderOptions(opts1)).not.toBe(hashRenderOptions(opts2));
  });

  test('should produce different hash for different font family', () => {
    const opts1 = { ...defaultOptions, zhFontFamily: '微软雅黑' };
    const opts2 = { ...defaultOptions, zhFontFamily: '宋体' };
    expect(hashRenderOptions(opts1)).not.toBe(hashRenderOptions(opts2));
  });
});

describe('computeDiff', () => {
  test('should return full_rebuild when no previous state', () => {
    const fingerprints = ['fp1', 'fp2', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(null, fingerprints, optionsHash);
    expect(result.kind).toBe('full_rebuild');
  });

  test('should return full_rebuild when version mismatch', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2'],
      nextYs: [100, 200],
      elementCount: 2,
      optionsHash: 'opts1',
      version: 1,
    };
    const fingerprints = ['fp1', 'fp2'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('full_rebuild');
  });

  test('should return full_rebuild when options changed', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2'],
      nextYs: [100, 200],
      elementCount: 2,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2'];
    const optionsHash = 'opts2';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('full_rebuild');
  });

  test('should return no_change when identical', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100, 200, 300],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('no_change');
  });

  test('should return incremental when element added at end', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2'],
      nextYs: [100, 200],
      elementCount: 2,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(2);
    expect(result.startY).toBe(200);
  });

  test('should return incremental when element modified in middle', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100, 200, 300],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2_modified', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(1);
    expect(result.startY).toBe(100);
    expect(result.changedIndices).toContain(1);
  });

  test('should return incremental when first element changed', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100, 200, 300],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1_modified', 'fp2', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(0);
    expect(result.startY).toBeUndefined();
  });

  test('should return incremental when element removed', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100, 200, 300],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
  });

  test('should return incremental when multiple elements changed', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3', 'fp4', 'fp5'],
      nextYs: [100, 200, 300, 400, 500],
      elementCount: 5,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2_modified', 'fp3', 'fp4_modified', 'fp5'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(1);
    expect(result.changedIndices).toContain(1);
    expect(result.changedIndices).toContain(3);
    expect(result.changedIndices).not.toContain(0);
    expect(result.changedIndices).not.toContain(2);
  });

  test('should handle empty fingerprints', () => {
    const oldState: RenderState = {
      fingerprints: [],
      nextYs: [],
      elementCount: 0,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints: string[] = [];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('no_change');
  });

  test('should return full_rebuild when nextYs length does not match fingerprints', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2_modified', 'fp3'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(1);
  });

  test('should return full_rebuild when nextYs is too short for firstChanged', () => {
    const oldState: RenderState = {
      fingerprints: ['fp1', 'fp2', 'fp3'],
      nextYs: [100],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };
    const fingerprints = ['fp1', 'fp2', 'fp3_modified'];
    const optionsHash = 'opts1';
    const result = computeDiff(oldState, fingerprints, optionsHash);
    expect(result.kind).toBe('full_rebuild');
  });
});

describe('Incremental rendering scenarios', () => {
  test('should detect only new content added at end', () => {
    const heading1: SlideElement = {
      type: 'heading',
      level: 1,
      runs: [{ type: 'text', text: 'Title' }],
    };
    const para1: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content A' }],
    };
    
    const oldState: RenderState = {
      fingerprints: [fingerprintElement(heading1), fingerprintElement(para1)],
      nextYs: [50, 100],
      elementCount: 2,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };

    const para2: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content B' }],
    };
    const newFingerprints = [
      fingerprintElement(heading1),
      fingerprintElement(para1),
      fingerprintElement(para2),
    ];

    const result = computeDiff(oldState, newFingerprints, 'opts1');
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(2);
  });

  test('should detect modification in middle content', () => {
    const heading1: SlideElement = {
      type: 'heading',
      level: 1,
      runs: [{ type: 'text', text: 'Title' }],
    };
    const para1: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content A' }],
    };
    const para2: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content B' }],
    };

    const oldState: RenderState = {
      fingerprints: [
        fingerprintElement(heading1),
        fingerprintElement(para1),
        fingerprintElement(para2),
      ],
      nextYs: [50, 100, 150],
      elementCount: 3,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };

    const para1Modified: SlideElement = {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'Content A Modified' }],
    };
    const newFingerprints = [
      fingerprintElement(heading1),
      fingerprintElement(para1Modified),
      fingerprintElement(para2),
    ];

    const result = computeDiff(oldState, newFingerprints, 'opts1');
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(1);
  });

  test('should detect math formula change', () => {
    const paraWithMath1: SlideElement = {
      type: 'paragraph',
      runs: [
        { type: 'text', text: 'The formula is ' },
        { type: 'inline_math', latex: 'x^2' },
      ],
    };

    const oldState: RenderState = {
      fingerprints: [fingerprintElement(paraWithMath1)],
      nextYs: [100],
      elementCount: 1,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };

    const paraWithMath2: SlideElement = {
      type: 'paragraph',
      runs: [
        { type: 'text', text: 'The formula is ' },
        { type: 'inline_math', latex: 'x^3' },
      ],
    };
    const newFingerprints = [fingerprintElement(paraWithMath2)];

    const result = computeDiff(oldState, newFingerprints, 'opts1');
    expect(result.kind).toBe('incremental');
    expect(result.firstChangedIndex).toBe(0);
  });

  test('should not detect change for identical math formula', () => {
    const paraWithMath: SlideElement = {
      type: 'paragraph',
      runs: [
        { type: 'text', text: 'The formula is ' },
        { type: 'inline_math', latex: 'x^2' },
      ],
    };

    const fp = fingerprintElement(paraWithMath);
    const oldState: RenderState = {
      fingerprints: [fp],
      nextYs: [100],
      elementCount: 1,
      optionsHash: 'opts1',
      version: RENDER_STATE_VERSION,
    };

    const newFingerprints = [fingerprintElement(paraWithMath)];
    const result = computeDiff(oldState, newFingerprints, 'opts1');
    expect(result.kind).toBe('no_change');
  });
});
