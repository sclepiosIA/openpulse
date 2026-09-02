import { describe, it, expect, vi } from 'vitest';

// Mock du chargeur dynamique d'Excel libs — évite de charger le vrai bundle xlsx.
vi.mock('@/lib/export/dynamicPdfImport', () => {
  const XLSX = {
    read: (_buffer: ArrayBuffer) => ({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {
          '!ref': 'A1:B2',
          '!cols': [{ wch: 12 }, { wpx: 80 }],
          A1: { v: 'Nom', w: 'Nom', s: { font: { bold: true } } },
          B1: { v: 'Total', w: 'Total' },
          A2: { v: 42, w: '42' },
          B2: { f: 'A2*2', v: 84, w: '84' },
        },
      },
    }),
    utils: {
      decode_range: (ref: string) => {
        const [start, end] = ref.split(':');
        const parse = (r: string) => {
          const m = r.match(/^([A-Z]+)(\d+)$/)!;
          const col = m[1].charCodeAt(0) - 65;
          return { r: parseInt(m[2]) - 1, c: col };
        };
        return { s: parse(start), e: parse(end) };
      },
      encode_cell: ({ r, c }: { r: number; c: number }) =>
        `${String.fromCharCode(65 + c)}${r + 1}`,
    },
  };
  return { loadExcelLibs: async () => ({ XLSX }) };
});

import { importXlsx } from './importXlsx';

describe('importXlsx (anti-régression)', () => {
  it('mappe cellules, formules, styles et largeurs de colonnes', async () => {
    const file = {
      arrayBuffer: async () => new Uint8Array([0, 0]).buffer,
    } as unknown as File;
    const res = await importXlsx(file);

    expect(res.data.A1.value).toBe('Nom');
    expect(res.data.A1.format?.bold).toBe(true);
    expect(res.data.A2.value).toBe('42');
    expect(res.data.B2.formula).toBe('=A2*2');
    expect(res.data.B2.value).toBe('');

    expect(res.colCount).toBeGreaterThanOrEqual(26);
    expect(res.rowCount).toBeGreaterThanOrEqual(100);
    expect(res.colWidths[0]).toBeGreaterThan(0);
    expect(res.colWidths[1]).toBe(80);
  });
});
