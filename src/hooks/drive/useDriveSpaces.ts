/**
 * Hook React Query : espaces Gestion Drive (`GET /api/drive/spaces`).
 *
 * Désactivé par défaut tant que le backend résolu n'inclut pas Azure
 * (flag `VITE_DOCUMENTS_BACKEND`) — aucun appel réseau en mode legacy.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchDriveSpaces } from '@/lib/drive/driveClient';
import type { DriveSpace } from '@/lib/drive/types';

export const DRIVE_SPACES_QUERY_KEY = ['drive', 'spaces'] as const;

export interface UseDriveSpacesOptions {
  /** Active la requête (typiquement `isAzureDriveEnabled(backend)`). */
  enabled?: boolean;
}

export function useDriveSpaces({ enabled = true }: UseDriveSpacesOptions = {}) {
  return useQuery<DriveSpace[]>({
    queryKey: DRIVE_SPACES_QUERY_KEY,
    queryFn: ({ signal }) => fetchDriveSpaces(signal),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
