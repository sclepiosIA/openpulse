/**
 * Import XLSX → SheetState (compatible SpreadsheetEditor).
 */
import { loadExcelLibs } from '@/lib/export/dynamicPdfImport';

export interface ImportedSheet {
  data: Record<string, { value: string; formula?: string; format?: any }>;
  colCount: number;
  rowCount: number;
  colWidths: Record<number, number>;
}

function colLabel(n: number): string {
  let s = '';
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

export async function importXlsx(file: File): Promise<ImportedSheet> {
  const { XLSX } = await loadExcelLibs();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true, cellFormula: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const data: ImportedSheet['data'] = {};
  const colWidths: Record<number, number> = {};

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      const key = `${colLabel(C)}${R + 1}`;
      const formula = cell.f ? `=${cell.f}` : undefined;
      const value = cell.w ?? (cell.v !== undefined ? String(cell.v) : '');
      const s = cell.s;
      data[key] = {
        value: formula ? '' : value,
        formula,
        format: s
          ? {
              bold: s.font?.bold || undefined,
              italic: s.font?.italic || undefined,
              align: s.alignment?.horizontal,
              bgColor: s.fill?.fgColor?.rgb ? `#${s.fill.fgColor.rgb}` : undefined,
              textColor: s.font?.color?.rgb ? `#${s.font.color.rgb}` : undefined,
            }
          : undefined,
      };
    }
  }

  const cols = ws['!cols'] as Array<{ wch?: number; wpx?: number }> | undefined;
  if (cols) {
    cols.forEach((col, i) => {
      if (col?.wpx) colWidths[i] = col.wpx;
      else if (col?.wch) colWidths[i] = Math.round(col.wch * 7);
    });
  }

  return {
    data,
    colCount: Math.max(26, range.e.c + 1),
    rowCount: Math.max(100, range.e.r + 1),
    colWidths,
  };
}
