/**
 * Utilities for Supabase query chunking to avoid PostgREST URL length errors
 * 
 * The constraint is documented: CHUNK_SIZE = 50 max for IN clauses
 */

/**
 * Chunk size limit for Supabase IN queries to avoid PostgREST URL length errors
 */
export const CHUNK_SIZE = 50;

/**
 * Split an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], size: number = CHUNK_SIZE): T[][] {
  if (array.length === 0) return [];
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute a Supabase query with chunked IN clause
 * @param ids Array of IDs to query
 * @param queryFn Function that takes a chunk and returns a Supabase query result
 * @returns Aggregated results from all chunks
 */
export async function queryWithChunking<T>(
  ids: string[],
  queryFn: (chunk: string[]) => Promise<{ data: T[] | null; error: Error | null }>
): Promise<T[]> {
  if (ids.length === 0) return [];
  
  const chunks = chunkArray(ids);
  const results: T[] = [];
  
  for (const chunk of chunks) {
    const { data, error } = await queryFn(chunk);
    if (error) throw error;
    if (data) results.push(...data);
  }
  
  return results;
}

/**
 * Execute a Supabase update with chunked IN clause
 * @param ids Array of IDs to update
 * @param updateFn Function that takes a chunk and performs the update
 * @returns Total count of affected rows
 */
export async function updateWithChunking(
  ids: string[],
  updateFn: (chunk: string[]) => Promise<{ data: { id: string }[] | null; error: Error | null }>
): Promise<number> {
  if (ids.length === 0) return 0;
  
  const chunks = chunkArray(ids);
  let totalAffected = 0;
  
  for (const chunk of chunks) {
    const { data, error } = await updateFn(chunk);
    if (error) throw error;
    totalAffected += data?.length || 0;
  }
  
  return totalAffected;
}
