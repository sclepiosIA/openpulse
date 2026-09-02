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

describe('documentUtils', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('includes pdf', () => expect(ALLOWED_EXTENSIONS).toContain('.pdf'));
    it('includes xlsx', () => expect(ALLOWED_EXTENSIONS).toContain('.xlsx'));
    it('includes jpg', () => expect(ALLOWED_EXTENSIONS).toContain('.jpg'));
  });

  describe('MAX_FILE_SIZE', () => {
    it('is 25MB', () => expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024));
  });

  describe('formatFileSize', () => {
    it('formats 0', () => expect(formatFileSize(0)).toBe('0 B'));
    it('formats bytes', () => expect(formatFileSize(500)).toBe('500 B'));
    it('formats KB', () => expect(formatFileSize(2048)).toBe('2 KB'));
    it('formats MB', () => expect(formatFileSize(1048576)).toBe('1 MB'));
    it('formats GB', () => expect(formatFileSize(1073741824)).toBe('1 GB'));
    it('formats fractional', () => expect(formatFileSize(1536)).toBe('1.5 KB'));
  });

  describe('sanitizeFileName', () => {
    it('lowercases', () => expect(sanitizeFileName('Hello.PDF')).toBe('hello.pdf'));
    it('replaces spaces', () => expect(sanitizeFileName('my file.pdf')).toBe('my_file.pdf'));
    it('replaces special chars', () => expect(sanitizeFileName('résumé (1).pdf')).toBe('r_sum_1_.pdf'));
    it('collapses underscores', () => expect(sanitizeFileName('a   b.pdf')).toBe('a_b.pdf'));
  });

  describe('classifyDocument', () => {
    it('pdf → document', () => expect(classifyDocument('test.pdf')).toBe('document'));
    it('doc → document', () => expect(classifyDocument('test.doc')).toBe('document'));
    it('xlsx → spreadsheet', () => expect(classifyDocument('test.xlsx')).toBe('spreadsheet'));
    it('csv → spreadsheet', () => expect(classifyDocument('test.csv')).toBe('spreadsheet'));
    it('png → image', () => expect(classifyDocument('test.png')).toBe('image'));
    it('jpg → image', () => expect(classifyDocument('photo.jpg')).toBe('image'));
    it('mp4 → video', () => expect(classifyDocument('clip.mp4')).toBe('video'));
    it('mp3 → audio', () => expect(classifyDocument('song.mp3')).toBe('audio'));
    it('unknown → other', () => expect(classifyDocument('test.xyz')).toBe('other'));
    it('no extension → other', () => expect(classifyDocument('README')).toBe('other'));
  });

  describe('generateStoragePath', () => {
    it('builds correct path', () => {
      const path = generateStoragePath('etab-123', 'contrats', 'contrat.pdf');
      expect(path).toMatch(/^etablissements\/etab-123\/contrats\/\d+_contrat\.pdf$/);
    });
  });

  describe('isAllowedExtension', () => {
    it('allows pdf', () => expect(isAllowedExtension('test.pdf')).toBe(true));
    it('allows xlsx', () => expect(isAllowedExtension('test.xlsx')).toBe(true));
    it('allows jpeg', () => expect(isAllowedExtension('test.jpeg')).toBe(true));
    it('rejects exe', () => expect(isAllowedExtension('test.exe')).toBe(false));
    it('rejects zip', () => expect(isAllowedExtension('test.zip')).toBe(false));
    it('case insensitive', () => expect(isAllowedExtension('test.PDF')).toBe(true));
  });

  describe('isFileSizeValid', () => {
    it('accepts 0', () => expect(isFileSizeValid(0)).toBe(true));
    it('accepts under limit', () => expect(isFileSizeValid(10 * 1024 * 1024)).toBe(true));
    it('accepts at limit', () => expect(isFileSizeValid(MAX_FILE_SIZE)).toBe(true));
    it('rejects over limit', () => expect(isFileSizeValid(MAX_FILE_SIZE + 1)).toBe(false));
  });
});
