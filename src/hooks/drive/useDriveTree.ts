/**
 * Hook React Query : arborescence d'un espace Drive
 * (`GET /api/drive/tree?space_id=...`).
 *
 * Ne s'exécute que si un espace est sélectionné ET si le backend Azure
 * est actif — zéro trafic en mode legacy.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchDriveTree } from '@/lib/drive/driveClient';
import type { DriveTree } from '@/lib/drive/types';

export const driveTreeQueryKey = (spaceId: string | null | undefined) =>
  ['drive', 'tree', spaceId ?? 'none'] as const;

export interface UseDriveTreeOptions {
  enabled?: boolean;
}

export function useDriveTree(
  spaceId: string | null | undefined,
  { enabled = true }: UseDriveTreeOptions = {},
) {
  return useQuery<DriveTree>({
    queryKey: driveTreeQueryKey(spaceId),
    queryFn: ({ signal }) => fetchDriveTree(spaceId as string, signal),
    enabled: enabled && Boolean(spaceId),
    staleTime: 30_000,
    retry: 1,
  });
}
