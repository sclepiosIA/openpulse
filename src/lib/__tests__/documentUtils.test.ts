import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  sanitizeFileName,
  classifyDocument,
  generateStoragePath,
  isAllowedExtension,
  isFileSizeValid,
  MAX_FILE_SIZE,
} from '../documentUtils';

describe('documentUtils', () => {
  it('formatFileSize', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('sanitizeFileName replaces special chars and lowercases', () => {
    expect(sanitizeFileName('Mon Fichier (1).PDF')).toBe('mon_fichier_1_.pdf');
    // 'é' (NFC) is a single char → replaced by _ (no decomposition before replace)
    expect(sanitizeFileName('été@2026.docx')).toBe('_t_2026.docx');
    expect(sanitizeFileName('hello___world')).toBe('hello_world');
  });

  it('classifyDocument', () => {
    expect(classifyDocument('rapport.pdf')).toBe('document');
    expect(classifyDocument('feuille.xlsx')).toBe('spreadsheet');
    expect(classifyDocument('photo.JPG')).toBe('image');
    expect(classifyDocument('clip.mp4')).toBe('video');
    expect(classifyDocument('son.mp3')).toBe('audio');
    expect(classifyDocument('archive.zip')).toBe('other');
    expect(classifyDocument('nofext')).toBe('other');
  });

  it('generateStoragePath includes timestamp and structure', () => {
    const p = generateStoragePath('etab-1', 'contrats', 'doc.pdf');
    expect(p).toMatch(/^etablissements\/etab-1\/contrats\/\d+_doc\.pdf$/);
  });

  it('isAllowedExtension', () => {
    expect(isAllowedExtension('doc.pdf')).toBe(true);
    expect(isAllowedExtension('PHOTO.JPEG')).toBe(true);
    expect(isAllowedExtension('script.exe')).toBe(false);
    expect(isAllowedExtension('vid.mp4')).toBe(false);
  });

  it('isFileSizeValid', () => {
    expect(isFileSizeValid(100)).toBe(true);
    expect(isFileSizeValid(MAX_FILE_SIZE)).toBe(true);
    expect(isFileSizeValid(MAX_FILE_SIZE + 1)).toBe(false);
  });
});
