/**
 * Hooks React Query : permissions Gestion Drive (P1 gouvernance).
 *
 * - `useDrivePermissions(scope)` : permissions directes d'une portée
 *   (espace, dossier ou fichier) via `GET /api/drive/permissions`.
 * - `useDrivePermissionMutations(scope)` : ajout / changement de rôle /
 *   retrait, avec invalidation ciblée du cache de la portée.
 *
 * Aucun trafic en mode legacy : les hooks ne s'exécutent que montés
 * dans le panneau Azure (backend azure|hybrid).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDrivePermission,
  deleteDrivePermission,
  fetchDrivePermissions,
  updateDrivePermission,
} from '@/lib/drive/driveClient';
import type {
  DrivePermissionCreateRequest,
  DrivePermissionRole,
  DrivePermissionScope,
  DrivePermissionsResponse,
} from '@/lib/drive/types';

export const drivePermissionsQueryKey = (scope: DrivePermissionScope | null) =>
  [
    'drive',
    'permissions',
    scope?.spaceId ?? 'none',
    scope?.folderId ?? null,
    scope?.fileId ?? null,
  ] as const;

export interface UseDrivePermissionsOptions {
  enabled?: boolean;
}

export function useDrivePermissions(
  scope: DrivePermissionScope | null,
  { enabled = true }: UseDrivePermissionsOptions = {},
) {
  return useQuery<DrivePermissionsResponse>({
    queryKey: drivePermissionsQueryKey(scope),
    queryFn: ({ signal }) => fetchDrivePermissions(scope as DrivePermissionScope, signal),
    enabled: enabled && Boolean(scope?.spaceId),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useDrivePermissionMutations(scope: DrivePermissionScope | null) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: drivePermissionsQueryKey(scope) });

  const create = useMutation({
    mutationFn: (request: DrivePermissionCreateRequest) => createDrivePermission(request),
    onSuccess: invalidate,
  });

  const updateRole = useMutation({
    mutationFn: ({
      permissionId,
      permission,
    }: {
      permissionId: string;
      permission: DrivePermissionRole;
    }) => updateDrivePermission(permissionId, permission),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (permissionId: string) => deleteDrivePermission(permissionId),
    onSuccess: invalidate,
  });

  return { create, updateRole, remove };
}
