import { describe, it, expect } from 'vitest';
import { loadPdfLibs, loadExcelLibs, loadHtml2Canvas } from '../export/dynamicPdfImport';

describe('dynamicPdfImport', () => {
  describe('loadPdfLibs', () => {
    it('returns jsPDF and autoTable', async () => {
      const libs = await loadPdfLibs();
      expect(libs.jsPDF).toBeDefined();
      expect(libs.autoTable).toBeDefined();
    });

    it('caches result on second call', async () => {
      const first = await loadPdfLibs();
      const second = await loadPdfLibs();
      expect(first).toBe(second);
    });
  });

  describe('loadExcelLibs', () => {
    it('returns XLSX', async () => {
      const libs = await loadExcelLibs();
      expect(libs.XLSX).toBeDefined();
    });

    it('caches result', async () => {
      const first = await loadExcelLibs();
      const second = await loadExcelLibs();
      expect(first).toBe(second);
    });
  });

  describe('loadHtml2Canvas', () => {
    it('returns html2canvas', async () => {
      const libs = await loadHtml2Canvas();
      expect(libs.html2canvas).toBeDefined();
    });

    it('caches result', async () => {
      const first = await loadHtml2Canvas();
      const second = await loadHtml2Canvas();
      expect(first).toBe(second);
    });
  });
});
