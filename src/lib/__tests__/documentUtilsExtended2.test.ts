import { describe, it, expect } from 'vitest';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
  sanitizeFileName,
  classifyDocument,
  generateStoragePath,
  isAllowedExtension,
  isFileSizeValid,
} from '../documentUtils';

describe('documentUtils (extended2)', () => {
  describe('constants', () => {
    it('ALLOWED_EXTENSIONS has 8 entries', () => expect(ALLOWED_EXTENSIONS.length).toBe(8));
    it('includes .pdf', () => expect(ALLOWED_EXTENSIONS).toContain('.pdf'));
    it('MAX_FILE_SIZE = 25MB', () => expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024));
  });

  describe('formatFileSize', () => {
    it('0 → 0 B', () => expect(formatFileSize(0)).toBe('0 B'));
    it('512 → 512 B', () => expect(formatFileSize(512)).toBe('512 B'));
    it('1024 → 1 KB', () => expect(formatFileSize(1024)).toBe('1 KB'));
    it('1.5MB', () => expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB'));
    it('1GB', () => expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB'));
  });

  describe('sanitizeFileName', () => {
    it('replaces special chars', () => expect(sanitizeFileName('My File (1).pdf')).toBe('my_file_1_.pdf'));
    it('collapses underscores', () => expect(sanitizeFileName('a___b.txt')).toBe('a_b.txt'));
    it('lowercases', () => expect(sanitizeFileName('ABC.PDF')).toBe('abc.pdf'));
  });

  describe('classifyDocument', () => {
    it('pdf → document', () => expect(classifyDocument('test.pdf')).toBe('document'));
    it('xlsx → spreadsheet', () => expect(classifyDocument('data.xlsx')).toBe('spreadsheet'));
    it('png → image', () => expect(classifyDocument('photo.png')).toBe('image'));
    it('jpg → image', () => expect(classifyDocument('photo.jpg')).toBe('image'));
    it('mp4 → video', () => expect(classifyDocument('clip.mp4')).toBe('video'));
    it('unknown → other', () => expect(classifyDocument('file.xyz')).toBe('other'));
  });

  describe('generateStoragePath', () => {
    it('generates valid path', () => {
      const path = generateStoragePath('etab-1', 'contrats', 'doc.pdf');
      expect(path).toMatch(/^etablissements\/etab-1\/contrats\/\d+_doc\.pdf$/);
    });
  });

  describe('isAllowedExtension', () => {
    it('pdf → true', () => expect(isAllowedExtension('file.pdf')).toBe(true));
    it('docx → true', () => expect(isAllowedExtension('file.docx')).toBe(true));
    it('exe → false', () => expect(isAllowedExtension('file.exe')).toBe(false));
    it('js → false', () => expect(isAllowedExtension('file.js')).toBe(false));
  });

  describe('isFileSizeValid', () => {
    it('small → true', () => expect(isFileSizeValid(1024)).toBe(true));
    it('exact limit → true', () => expect(isFileSizeValid(MAX_FILE_SIZE)).toBe(true));
    it('over limit → false', () => expect(isFileSizeValid(MAX_FILE_SIZE + 1)).toBe(false));
  });
});
