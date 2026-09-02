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

describe('documentUtils extended3', () => {
  describe('constants', () => {
    it('ALLOWED_EXTENSIONS has 8 types', () => expect(ALLOWED_EXTENSIONS).toHaveLength(8));
    it('MAX_FILE_SIZE is 25MB', () => expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024));
  });

  describe('formatFileSize', () => {
    it('0 B', () => expect(formatFileSize(0)).toBe('0 B'));
    it('bytes', () => expect(formatFileSize(500)).toBe('500 B'));
    it('KB', () => expect(formatFileSize(1024)).toBe('1 KB'));
    it('KB decimal', () => expect(formatFileSize(1536)).toBe('1.5 KB'));
    it('MB', () => expect(formatFileSize(1048576)).toBe('1 MB'));
    it('GB', () => expect(formatFileSize(1073741824)).toBe('1 GB'));
  });

  describe('sanitizeFileName', () => {
    it('lowercase', () => expect(sanitizeFileName('Test.PDF')).toBe('test.pdf'));
    it('replaces spaces', () => expect(sanitizeFileName('my file.pdf')).toBe('my_file.pdf'));
    it('replaces special chars', () => expect(sanitizeFileName('doc@#$.pdf')).toBe('doc_.pdf'));
    it('collapses underscores', () => expect(sanitizeFileName('a   b.txt')).toBe('a_b.txt'));
    it('keeps dots', () => expect(sanitizeFileName('file.v2.pdf')).toBe('file.v2.pdf'));
  });

  describe('classifyDocument', () => {
    it('pdf → document', () => expect(classifyDocument('test.pdf')).toBe('document'));
    it('doc → document', () => expect(classifyDocument('test.doc')).toBe('document'));
    it('docx → document', () => expect(classifyDocument('test.docx')).toBe('document'));
    it('xls → spreadsheet', () => expect(classifyDocument('test.xls')).toBe('spreadsheet'));
    it('xlsx → spreadsheet', () => expect(classifyDocument('test.xlsx')).toBe('spreadsheet'));
    it('csv → spreadsheet', () => expect(classifyDocument('data.csv')).toBe('spreadsheet'));
    it('png → image', () => expect(classifyDocument('photo.png')).toBe('image'));
    it('jpg → image', () => expect(classifyDocument('photo.jpg')).toBe('image'));
    it('jpeg → image', () => expect(classifyDocument('photo.jpeg')).toBe('image'));
    it('gif → image', () => expect(classifyDocument('anim.gif')).toBe('image'));
    it('mp4 → video', () => expect(classifyDocument('clip.mp4')).toBe('video'));
    it('mp3 → audio', () => expect(classifyDocument('song.mp3')).toBe('audio'));
    it('unknown → other', () => expect(classifyDocument('file.xyz')).toBe('other'));
    it('no extension → other', () => expect(classifyDocument('README')).toBe('other'));
  });

  describe('generateStoragePath', () => {
    it('includes etablissementId', () => {
      const path = generateStoragePath('abc123', 'contrats', 'doc.pdf');
      expect(path).toContain('abc123');
    });
    it('includes category', () => {
      const path = generateStoragePath('id', 'factures', 'f.pdf');
      expect(path).toContain('factures');
    });
    it('includes filename', () => {
      const path = generateStoragePath('id', 'cat', 'myfile.pdf');
      expect(path).toContain('myfile.pdf');
    });
    it('includes timestamp', () => {
      const before = Date.now();
      const path = generateStoragePath('id', 'cat', 'f.pdf');
      const after = Date.now();
      const match = path.match(/\/(\d+)_/);
      expect(match).toBeTruthy();
      const ts = parseInt(match![1]);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('isAllowedExtension', () => {
    it('pdf → true', () => expect(isAllowedExtension('file.pdf')).toBe(true));
    it('xlsx → true', () => expect(isAllowedExtension('data.xlsx')).toBe(true));
    it('png → true', () => expect(isAllowedExtension('img.png')).toBe(true));
    it('exe → false', () => expect(isAllowedExtension('virus.exe')).toBe(false));
    it('js → false', () => expect(isAllowedExtension('script.js')).toBe(false));
    it('case insensitive', () => expect(isAllowedExtension('file.PDF')).toBe(true));
  });

  describe('isFileSizeValid', () => {
    it('0 → true', () => expect(isFileSizeValid(0)).toBe(true));
    it('1MB → true', () => expect(isFileSizeValid(1024 * 1024)).toBe(true));
    it('25MB → true', () => expect(isFileSizeValid(MAX_FILE_SIZE)).toBe(true));
    it('25MB+1 → false', () => expect(isFileSizeValid(MAX_FILE_SIZE + 1)).toBe(false));
    it('100MB → false', () => expect(isFileSizeValid(100 * 1024 * 1024)).toBe(false));
  });
});
