import { describe, it, expect, vi } from 'vitest';
import { queryWithChunking, createChunks, batchProcess } from '../queryWithChunking';

describe('queryWithChunking', () => {
  describe('queryWithChunking', () => {
    it('returns empty for empty array', async () => {
      const fetcher = vi.fn();
      expect(await queryWithChunking([], fetcher)).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('calls fetcher directly for small arrays', async () => {
      const fetcher = vi.fn().mockResolvedValue([{ id: '1' }]);
      const result = await queryWithChunking(['a', 'b'], fetcher, 50);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: '1' }]);
    });

    it('chunks large arrays', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
      const fetcher = vi.fn().mockImplementation((chunk: string[]) =>
        Promise.resolve(chunk.map(id => ({ id })))
      );
      const result = await queryWithChunking(ids, fetcher, 50);
      expect(fetcher).toHaveBeenCalledTimes(3); // 50+50+20
      expect(result).toHaveLength(120);
    });
  });

  describe('createChunks', () => {
    it('creates empty for empty array', () => {
      expect(createChunks([])).toEqual([]);
    });

    it('creates single chunk for small array', () => {
      const chunks = createChunks([1, 2, 3], 50);
      expect(chunks).toEqual([[1, 2, 3]]);
    });

    it('creates multiple chunks', () => {
      const chunks = createChunks([1, 2, 3, 4, 5], 2);
      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('batchProcess', () => {
    it('returns empty for empty input', async () => {
      expect(await batchProcess([], vi.fn())).toEqual([]);
    });

    it('processes in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation((batch: number[]) =>
        Promise.resolve(batch.map(n => n * 2))
      );
      const result = await batchProcess(items, processor, 2);
      expect(result).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(3);
    });
  });
});
