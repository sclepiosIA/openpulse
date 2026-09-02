/**
 * Utility for chunking large Supabase .in() queries
 * Prevents PostgREST URL length errors (HTTP 400) by batching IDs
 * 
 * Standard chunk size: 50 (safe for most URL lengths)
 */

const DEFAULT_CHUNK_SIZE = 50;

/**
 * Execute a query function in chunks to avoid PostgREST URL length limits
 * 
 * @param ids - Array of IDs to query
 * @param fetcher - Function that takes a chunk of IDs and returns a promise
 * @param chunkSize - Size of each chunk (default: 50)
 * @returns Flattened array of all results
 * 
 * @example
 * const results = await queryWithChunking(
 *   userIds,
 *   async (chunkIds) => {
 *     const { data } = await supabase
 *       .from('profiles')
 *       .select('id, nom, prenom')
 *       .in('id', chunkIds);
 *     return data || [];
 *   }
 * );
 */
export async function queryWithChunking<T>(
  ids: string[],
  fetcher: (chunkIds: string[]) => Promise<T[]>,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<T[]> {
  if (ids.length === 0) return [];
  
  // If small enough, execute directly
  if (ids.length <= chunkSize) {
    return fetcher(ids);
  }
  
  // Split into chunks
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  
  // Execute all chunks in parallel
  const results = await Promise.all(chunks.map(fetcher));
  
  // Flatten results
  return results.flat();
}

/**
 * Create chunks from an array of IDs
 * Useful when you need to manage chunking manually
 * 
 * @param ids - Array of IDs to chunk
 * @param chunkSize - Size of each chunk (default: 50)
 * @returns Array of ID chunks
 */
export function createChunks<T>(items: T[], chunkSize: number = DEFAULT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Batch execute operations with automatic chunking
 * Useful for bulk inserts/updates
 * 
 * @param items - Array of items to process
 * @param processor - Function that processes a batch of items
 * @param batchSize - Size of each batch (default: 50)
 * @returns Flattened array of all results
 */
export async function batchProcess<TInput, TOutput>(
  items: TInput[],
  processor: (batch: TInput[]) => Promise<TOutput[]>,
  batchSize: number = DEFAULT_CHUNK_SIZE
): Promise<TOutput[]> {
  if (items.length === 0) return [];
  
  const batches = createChunks(items, batchSize);
  const results = await Promise.all(batches.map(processor));
  
  return results.flat();
}
