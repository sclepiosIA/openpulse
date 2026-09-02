import { describe, it, expect } from 'vitest';
import {
  getNextcloudPathFromId,
  createNextcloudFolderId,
  isNextcloudFolderId,
} from '@/hooks/documents/useNextcloudFolderTree';

describe('useNextcloudFolderTree utilities', () => {
  describe('getNextcloudPathFromId', () => {
    it('should extract path from nextcloud ID', () => {
      expect(getNextcloudPathFromId('nextcloud:/documents/test')).toBe('/documents/test');
    });

    it('should return null for non-nextcloud ID', () => {
      expect(getNextcloudPathFromId('some-uuid')).toBeNull();
    });

    it('should handle root path', () => {
      expect(getNextcloudPathFromId('nextcloud:/')).toBe('/');
    });

    it('should handle empty path after prefix', () => {
      expect(getNextcloudPathFromId('nextcloud:')).toBe('');
    });
  });

  describe('createNextcloudFolderId', () => {
    it('should create ID with nextcloud prefix', () => {
      expect(createNextcloudFolderId('/docs')).toBe('nextcloud:/docs');
    });

    it('should handle root path', () => {
      expect(createNextcloudFolderId('/')).toBe('nextcloud:/');
    });

    it('should handle nested paths', () => {
      expect(createNextcloudFolderId('/a/b/c')).toBe('nextcloud:/a/b/c');
    });
  });

  describe('isNextcloudFolderId', () => {
    it('should return true for nextcloud IDs', () => {
      expect(isNextcloudFolderId('nextcloud:/path')).toBe(true);
    });

    it('should return false for regular UUIDs', () => {
      expect(isNextcloudFolderId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNextcloudFolderId(null)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isNextcloudFolderId('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isNextcloudFolderId('Nextcloud:/path')).toBe(false);
    });
  });

  describe('roundtrip', () => {
    it('should roundtrip path through create and extract', () => {
      const path = '/documents/2025/invoice.pdf';
      const id = createNextcloudFolderId(path);
      expect(isNextcloudFolderId(id)).toBe(true);
      expect(getNextcloudPathFromId(id)).toBe(path);
    });
  });
});
