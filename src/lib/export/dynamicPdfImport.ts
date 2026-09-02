/**
 * Dynamic PDF and Excel imports for bundle optimization
 * 
 * These utilities load heavy libraries (jsPDF, xlsx-js-style, html2canvas)
 * only when needed, reducing the initial bundle size significantly.
 * 
 * @example
 * // Instead of:
 * import jsPDF from 'jspdf';
 * import autoTable from 'jspdf-autotable';
 * 
 * // Use:
 * const { jsPDF, autoTable } = await loadPdfLibs();
 */

import { debug } from '@/lib/debug';

export interface PdfLibs {
  jsPDF: typeof import('jspdf').default;
  autoTable: typeof import('jspdf-autotable').default;
}

export interface ExcelLibs {
  XLSX: typeof import('xlsx-js-style');
}

export interface Html2CanvasLib {
  html2canvas: typeof import('html2canvas').default;
}

let pdfLibsCache: PdfLibs | null = null;
let excelLibsCache: ExcelLibs | null = null;
let html2canvasCache: Html2CanvasLib | null = null;

/**
 * Dynamically load jsPDF and jspdf-autotable
 * Libraries are cached after first load for subsequent calls
 */
export async function loadPdfLibs(): Promise<PdfLibs> {
  if (pdfLibsCache) {
    return pdfLibsCache;
  }

  const [jsPDFModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  pdfLibsCache = {
    jsPDF: jsPDFModule.default,
    autoTable: autoTableModule.default,
  };

  return pdfLibsCache;
}

/**
 * Dynamically load xlsx-js-style
 * Library is cached after first load for subsequent calls
 */
export async function loadExcelLibs(): Promise<ExcelLibs> {
  if (excelLibsCache) {
    return excelLibsCache;
  }

  const XLSXModule = await import('xlsx-js-style');

  excelLibsCache = {
    XLSX: XLSXModule,
  };

  return excelLibsCache;
}

/**
 * Dynamically load html2canvas
 * Library is cached after first load for subsequent calls
 */
export async function loadHtml2Canvas(): Promise<Html2CanvasLib> {
  if (html2canvasCache) {
    return html2canvasCache;
  }

  const html2canvasModule = await import('html2canvas');

  html2canvasCache = {
    html2canvas: html2canvasModule.default,
  };

  return html2canvasCache;
}

/**
 * Load both PDF and Excel libraries together
 * Useful for components that offer both export types
 */
export async function loadExportLibs(): Promise<PdfLibs & ExcelLibs> {
  const [pdfLibs, excelLibs] = await Promise.all([
    loadPdfLibs(),
    loadExcelLibs(),
  ]);

  return { ...pdfLibs, ...excelLibs };
}

/**
 * Preload libraries in the background
 * Call this on component mount to reduce export delay
 */
export function preloadExportLibs(): void {
  // Fire and forget - preload in background (silent failure is acceptable)
  loadPdfLibs().catch((e) => {
    if (import.meta.env.DEV) debug.warn('[ExportLibs] PDF preload failed:', e);
  });
  loadExcelLibs().catch((e) => {
    if (import.meta.env.DEV) debug.warn('[ExportLibs] Excel preload failed:', e);
  });
}
