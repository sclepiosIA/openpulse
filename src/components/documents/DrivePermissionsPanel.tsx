/**
 * Panneau « Accès » Gestion Drive (P1 gouvernance — plan §4.2/§4.3).
 *
 * Affiche et gère les permissions directes d'une portée :
 * - espace entier (aucune sélection de fichier) ;
 * - fichier sélectionné dans DriveAzurePanel.
 *
 * V1 volontairement minimale :
 * - liste des permissions directes (sujet, type, rôle) ;
 * - ajout d'un accès (type de sujet + identifiant + rôle) ;
 * - changement de rôle inline ;
 * - retrait d'un accès.
 * L'héritage (espace → dossier → fichier) et les restrictions DPO/RSSI
 * arrivent dans un lot ultérieur. Chaque mutation est auditée côté API
 * (`drive_audit_logs`) et émet un événement `permission_changed`.
 */
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDrivePermissionMutations, useDrivePermissions } from '@/hooks/drive/useDrivePermissions'
import { driveErrorMessage } from '@/lib/drive/errors'
import {
  DRIVE_PERMISSION_ROLES,
  DRIVE_PERMISSION_SUBJECT_TYPES,
  DriveApiError,
  type DrivePermissionRole,
  type DrivePermissionScope,
  type DrivePermissionSubjectType,
} from '@/lib/drive/types'
import { cn } from '@/lib/utils'

export const PERMISSION_ROLE_LABELS: Record<DrivePermissionRole, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  editor: 'Éditeur',
  viewer: 'Lecteur',
  uploader: 'Dépôt seul',
  no_sync_local: 'Sans sync locale',
}

export const PERMISSION_SUBJECT_LABELS: Record<DrivePermissionSubjectType, string> = {
  user: 'Utilisateur',
  team: 'Équipe',
  role: 'Rôle',
  establishment: 'Établissement',
}

interface DrivePermissionsPanelProps {
  /** Portée affichée : espace seul ou fichier sélectionné. */
  scope: DrivePermissionScope
  /** Libellé humain de la portée (nom d'espace ou path fichier). */
  scopeLabel: string
  className?: string
}

export function DrivePermissionsPanel({
  scope,
  scopeLabel,
  className,
}: DrivePermissionsPanelProps) {
  const permissionsQuery = useDrivePermissions(scope)
  const { create, updateRole, remove } = useDrivePermissionMutations(scope)

  const [subjectType, setSubjectType] = useState<DrivePermissionSubjectType>('user')
  const [subjectId, setSubjectId] = useState('')
  const [role, setRole] = useState<DrivePermissionRole>('viewer')
  const [formError, setFormError] = useState<string | null>(null)

  const permissions = permissionsQuery.data?.permissions ?? []

  // Erreur de la dernière mutation inline (changement de rôle / retrait) :
  // sans affichage dédié, un 403/409 resterait silencieux pour l'utilisateur.
  const mutationError = updateRole.error ?? remove.error ?? null

  const handleAdd = () => {
    const trimmed = subjectId.trim()
    if (!trimmed) {
      setFormError('Identifiant du sujet requis (email, équipe, rôle…).')
      return
    }
    setFormError(null)
    create.mutate(
      {
        space_id: scope.spaceId,
        folder_id: scope.folderId ?? null,
        file_id: scope.fileId ?? null,
        subject_type: subjectType,
        subject_id: trimmed,
        permission: role,
      },
      {
        onSuccess: () => setSubjectId(''),
        onError: (error: unknown) => {
          const isConflict = error instanceof DriveApiError && error.status === 409
          setFormError(
            isConflict
              ? 'Ce sujet a déjà une permission sur cette portée.'
              : `Ajout impossible : ${driveErrorMessage(error)}`
          )
        },
      }
    )
  }

  return (
    <div
      className={cn('rounded-lg border border-slate-200/70 p-3 space-y-3', className)}
      data-testid="drive-permissions-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Accès — <span className="text-muted-foreground">{scopeLabel}</span>
        </p>
        <Badge variant="outline" className="text-[10px]" data-testid="drive-permissions-scope">
          {scope.fileId ? 'Fichier' : scope.folderId ? 'Dossier' : 'Espace'}
        </Badge>
      </div>

      {permissionsQuery.isLoading && (
        <div className="space-y-2" data-testid="drive-permissions-loading">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      )}

      {permissionsQuery.isError && (
        <div className="space-y-2" data-testid="drive-permissions-error">
          <p className="text-sm text-muted-foreground">
            Impossible de charger les accès de cette portée.
          </p>
          <p className="text-xs text-muted-foreground" data-testid="drive-permissions-error-detail">
            {driveErrorMessage(permissionsQuery.error)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => permissionsQuery.refetch()}
            data-testid="drive-permissions-retry"
          >
            Réessayer
          </Button>
        </div>
      )}

      {!permissionsQuery.isLoading && !permissionsQuery.isError && permissions.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="drive-permissions-empty">
          Aucune permission directe. Les accès hérités de l'espace s'appliquent.
        </p>
      )}

      {permissions.length > 0 && (
        <ul className="space-y-1.5" data-testid="drive-permissions-list">
          {permissions.map((perm) => (
            <li
              key={perm.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2.5 py-1.5 text-sm"
              data-testid={`drive-permission-${perm.id}`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{perm.subject_id}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {PERMISSION_SUBJECT_LABELS[perm.subject_type]}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <select
                  value={perm.permission}
                  onChange={(event) =>
                    updateRole.mutate({
                      permissionId: perm.id,
                      permission: event.target.value as DrivePermissionRole,
                    })
                  }
                  disabled={updateRole.isPending}
                  className="h-7 rounded-md border border-slate-200 bg-transparent px-1.5 text-xs"
                  aria-label={`Rôle de ${perm.subject_id}`}
                  data-testid={`drive-permission-role-${perm.id}`}
                >
                  {DRIVE_PERMISSION_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {PERMISSION_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => remove.mutate(perm.id)}
                  disabled={remove.isPending}
                  aria-label={`Retirer l'accès de ${perm.subject_id}`}
                  data-testid={`drive-permission-remove-${perm.id}`}
                >
                  Retirer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {mutationError !== null && (
        <p className="text-xs text-destructive" data-testid="drive-permissions-mutation-error">
          {driveErrorMessage(mutationError)}
        </p>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-muted-foreground">Ajouter un accès</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subjectType}
            onChange={(event) => setSubjectType(event.target.value as DrivePermissionSubjectType)}
            className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs"
            aria-label="Type de sujet"
            data-testid="drive-permission-add-subject-type"
          >
            {DRIVE_PERMISSION_SUBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PERMISSION_SUBJECT_LABELS[t]}
              </option>
            ))}
          </select>
          <Input
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            placeholder="email, équipe, rôle…"
            className="h-8 w-44 text-xs"
            aria-label="Identifiant du sujet"
            data-testid="drive-permission-add-subject-id"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as DrivePermissionRole)}
            className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs"
            aria-label="Rôle à attribuer"
            data-testid="drive-permission-add-role"
          >
            {DRIVE_PERMISSION_ROLES.map((r) => (
              <option key={r} value={r}>
                {PERMISSION_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={handleAdd}
            disabled={create.isPending}
            data-testid="drive-permission-add-submit"
          >
            Ajouter
          </Button>
        </div>
        {formError && (
          <p className="text-xs text-destructive" data-testid="drive-permission-add-error">
            {formError}
          </p>
        )}
      </div>
    </div>
  )
}

export default DrivePermissionsPanel
