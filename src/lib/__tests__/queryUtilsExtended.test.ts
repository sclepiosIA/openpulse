import { describe, it, expect } from 'vitest';
import { CHUNK_SIZE, chunkArray, queryWithChunking, updateWithChunking } from '../queryUtils';

describe('queryUtils', () => {
  describe('CHUNK_SIZE', () => {
    it('is 50', () => expect(CHUNK_SIZE).toBe(50));
  });

  describe('chunkArray', () => {
    it('returns empty for empty', () => expect(chunkArray([])).toEqual([]));
    it('single chunk for small array', () => {
      expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });
    it('splits into multiple chunks', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
    it('uses default chunk size', () => {
      const arr = Array.from({ length: 75 }, (_, i) => i);
      const chunks = chunkArray(arr);
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(50);
      expect(chunks[1].length).toBe(25);
    });
  });

  describe('queryWithChunking', () => {
    it('returns empty for empty ids', async () => {
      const result = await queryWithChunking([], async () => ({ data: [], error: null }));
      expect(result).toEqual([]);
    });
    it('aggregates results from multiple chunks', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `id-${i}`);
      const queryFn = async (chunk: string[]) => ({
        data: chunk.map(id => ({ id })),
        error: null,
      });
      const result = await queryWithChunking(ids, queryFn);
      expect(result.length).toBe(75);
    });
    it('throws on error', async () => {
      await expect(
        queryWithChunking(['id-1'], async () => ({ data: null, error: new Error('fail') }))
      ).rejects.toThrow('fail');
    });
  });

  describe('updateWithChunking', () => {
    it('returns 0 for empty ids', async () => {
      const result = await updateWithChunking([], async () => ({ data: [], error: null }));
      expect(result).toBe(0);
    });
    it('counts affected rows', async () => {
      const ids = ['a', 'b', 'c'];
      const result = await updateWithChunking(ids, async (chunk) => ({
        data: chunk.map(id => ({ id })),
        error: null,
      }));
      expect(result).toBe(3);
    });
    it('throws on error', async () => {
      await expect(
        updateWithChunking(['a'], async () => ({ data: null, error: new Error('oops') }))
      ).rejects.toThrow('oops');
    });
  });
});
