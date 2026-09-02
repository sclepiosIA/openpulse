import { describe, it, expect } from 'vitest';
import { chunkArray, CHUNK_SIZE } from '../queryUtils';

describe('queryUtils', () => {
  describe('CHUNK_SIZE', () => {
    it('equals 50', () => {
      expect(CHUNK_SIZE).toBe(50);
    });
  });

  describe('chunkArray', () => {
    it('returns empty array for empty input', () => {
      expect(chunkArray([])).toEqual([]);
    });

    it('returns single chunk for small array', () => {
      const arr = [1, 2, 3];
      expect(chunkArray(arr, 50)).toEqual([[1, 2, 3]]);
    });

    it('splits array into correct chunks', () => {
      const arr = Array.from({ length: 120 }, (_, i) => i);
      const chunks = chunkArray(arr, 50);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(50);
      expect(chunks[1]).toHaveLength(50);
      expect(chunks[2]).toHaveLength(20);
    });

    it('handles exact multiples', () => {
      const arr = Array.from({ length: 100 }, (_, i) => i);
      expect(chunkArray(arr, 50)).toHaveLength(2);
    });
  });
});
