import { describe, it, expect } from 'vitest';
import {
  queryWithChunking,
  createChunks,
  batchProcess,
} from '../queryWithChunking';

describe('queryWithChunking extended2', () => {
  describe('createChunks', () => {
    it('empty → empty', () => expect(createChunks([])).toEqual([]));
    it('below chunk size → single chunk', () => {
      const arr = Array.from({ length: 10 }, (_, i) => i);
      expect(createChunks(arr)).toEqual([arr]);
    });
    it('exact chunk size → single chunk', () => {
      const arr = Array.from({ length: 50 }, (_, i) => i);
      expect(createChunks(arr)).toHaveLength(1);
    });
    it('above chunk size → multiple chunks', () => {
      const arr = Array.from({ length: 120 }, (_, i) => i);
      const chunks = createChunks(arr);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(50);
      expect(chunks[1]).toHaveLength(50);
      expect(chunks[2]).toHaveLength(20);
    });
    it('custom chunk size', () => {
      expect(createChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
    it('preserves all elements', () => {
      const arr = Array.from({ length: 137 }, (_, i) => i);
      expect(createChunks(arr).flat()).toEqual(arr);
    });
  });

  describe('queryWithChunking', () => {
    it('empty ids → empty', async () => {
      const result = await queryWithChunking([], async () => []);
      expect(result).toEqual([]);
    });
    it('small array calls fetcher once', async () => {
      const ids = ['a', 'b', 'c'];
      const fetcher = async (chunk: string[]) => chunk.map(id => ({ id }));
      const result = await queryWithChunking(ids, fetcher);
      expect(result).toHaveLength(3);
    });
    it('large array chunks and flattens', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `id-${i}`);
      const fetcher = async (chunk: string[]) => chunk.map(id => ({ id }));
      const result = await queryWithChunking(ids, fetcher);
      expect(result).toHaveLength(75);
    });
    it('propagates errors', async () => {
      await expect(
        queryWithChunking(['a'], async () => { throw new Error('fail'); })
      ).rejects.toThrow('fail');
    });
  });

  describe('batchProcess', () => {
    it('empty → empty', async () => {
      const result = await batchProcess([], async () => []);
      expect(result).toEqual([]);
    });
    it('processes all items', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (batch: number[]) => batch.map(n => n * 2);
      const result = await batchProcess(items, processor, 2);
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });
    it('handles single batch', async () => {
      const items = [1, 2];
      const processor = async (batch: number[]) => batch;
      const result = await batchProcess(items, processor, 50);
      expect(result).toEqual([1, 2]);
    });
  });
});
