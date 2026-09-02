import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('mammoth', () => ({
  convertToHtml: vi.fn(async () => ({
    value: '<p>Hello <script>alert(1)</script><strong>world</strong></p>',
    messages: [{ type: 'warning', message: 'minor' }],
  })),
}));

vi.mock('html2pdf.js', () => ({
  default: () => {
    const chain: any = {
      set: () => chain,
      from: () => chain,
      save: vi.fn(async () => undefined),
    };
    return chain;
  },
}));

describe('documentExport', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('importDocx returns sanitized HTML stripped of scripts', async () => {
    const { importDocx } = await import('../documentExport');
    const file = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as File;
    const html = await importDocx(file);
    expect(html).toContain('Hello');
    expect(html).toContain('<strong>world</strong>');
    expect(html).not.toContain('<script>');
  });

  it('exportToPdf cleans up the temporary container even on success', async () => {
    const { exportToPdf } = await import('../documentExport');
    const before = document.body.children.length;
    await exportToPdf('<p>Hi</p>', 'report.txt');
    expect(document.body.children.length).toBe(before);
  });
});
