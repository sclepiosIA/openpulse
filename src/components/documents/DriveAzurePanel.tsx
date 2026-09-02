/**
 * Panneau Gestion Drive (backend Azure) intégré dans la page /documents.
 *
 * Rendu uniquement quand le backend résolu est `azure` ou `hybrid`
 * (feature flag `VITE_DOCUMENTS_BACKEND` + override `?backend=`).
 * En mode `legacy` (défaut), ce composant n'est jamais monté : la page
 * Documents existante reste strictement identique.
 *
 * V2 : vue fichiers fiable (retry + erreurs lisibles), upload direct
 * Azure Blob (intent → PUT SAS → complete), téléchargement par URL
 * signée et panneau permissions par portée (espace/fichier).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDriveSpaces } from '@/hooks/drive/useDriveSpaces'
import { useDriveTree } from '@/hooks/drive/useDriveTree'
import { useDriveUpload, driveUploadErrorMessage } from '@/hooks/drive/useDriveUpload'
import { requestDriveDownloadUrl } from '@/lib/drive/driveClient'
import { driveErrorMessage } from '@/lib/drive/errors'
import { DrivePermissionsPanel } from '@/components/documents/DrivePermissionsPanel'
import type { DocumentsBackend, DriveFile, DriveSpace } from '@/lib/drive/types'
import { cn } from '@/lib/utils'

interface DriveAzurePanelProps {
  backend: DocumentsBackend
  className?: string
  uploadRequestKey?: number
}

const SPACE_TYPE_LABELS: Record<DriveSpace['type'], string> = {
  gsi: 'OpenPulse',
  etablissement: 'Établissement',
  project: 'Projet',
  dpo: 'DPO/RSSI',
  template: 'Templates',
  personal: 'Personnel',
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function evidenceBadge(file: DriveFile) {
  if (!file.evidence_status) return null
  const labels: Record<NonNullable<DriveFile['evidence_status']>, string> = {
    current: 'Preuve à jour',
    to_review: 'Preuve à revoir',
    archive: 'Preuve archivée',
  }
  return (
    <Badge variant="outline" className="text-[10px]" data-testid={`evidence-${file.id}`}>
      {labels[file.evidence_status]}
    </Badge>
  )
}

export function DriveAzurePanel({
  backend,
  className,
  uploadRequestKey = 0,
}: DriveAzurePanelProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)
  const [showPermissions, setShowPermissions] = useState(false)
  const [permissionFileId, setPermissionFileId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (uploadRequestKey > 0) fileInputRef.current?.click()
  }, [uploadRequestKey])

  const spacesQuery = useDriveSpaces()
  const spaces = useMemo(() => spacesQuery.data ?? [], [spacesQuery.data])

  const activeSpaceId = selectedSpaceId ?? spaces[0]?.id ?? null
  const treeQuery = useDriveTree(activeSpaceId)
  const upload = useDriveUpload()

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null
  const files = treeQuery.data?.files ?? []
  const folders = treeQuery.data?.folders ?? []
  const totalBytes = useMemo(
    () =>
      files.reduce(
        (sum, file) => sum + (Number.isFinite(file.size_bytes) ? file.size_bytes : 0),
        0
      ),
    [files]
  )

  const permissionFile = files.find((f) => f.id === permissionFileId) ?? null

  const selectSpace = (spaceId: string) => {
    setSelectedSpaceId(spaceId)
    // La portée fichier n'a de sens que dans son espace d'origine.
    setPermissionFileId(null)
    setUploadError(null)
    setUploadNotice(null)
    setDownloadError(null)
  }

  const togglePermissionsForFile = (fileId: string) => {
    if (showPermissions && permissionFileId === fileId) {
      setPermissionFileId(null)
      return
    }
    setPermissionFileId(fileId)
    setShowPermissions(true)
  }

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !activeSpaceId) return
    setUploadError(null)
    setUploadNotice(null)

    const selected = Array.from(fileList)
    let succeeded = 0
    let failed = false
    for (const file of selected) {
      try {
        const result = await upload.mutateAsync({ spaceId: activeSpaceId, file })
        succeeded += 1
        if (result.action === 'noop') {
          setUploadNotice(`« ${file.name} » est déjà à jour dans cet espace.`)
        }
      } catch (error) {
        failed = true
        setUploadError(`« ${file.name} » : ${driveUploadErrorMessage(error)}`)
        break // Stop au premier échec : message clair plutôt que cascade.
      }
    }
    if (succeeded > 0 && !failed) {
      setUploadNotice(
        (prev) =>
          prev ??
          `${succeeded} fichier${succeeded > 1 ? 's' : ''} téléversé${succeeded > 1 ? 's' : ''} vers « ${activeSpace?.name ?? 'l’espace'} ».`
      )
    }
    // Permet de re-sélectionner le même fichier.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownload = async (file: DriveFile) => {
    setDownloadError(null)
    setDownloadingFileId(file.id)
    try {
      const { download_url } = await requestDriveDownloadUrl(file.id)
      const link = window.document.createElement('a')
      link.href = download_url
      link.download = file.name
      link.rel = 'noopener'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } catch (error) {
      setDownloadError(
        `Téléchargement de « ${file.name} » impossible : ${driveErrorMessage(error)}`
      )
    } finally {
      setDownloadingFileId(null)
    }
  }

  return (
    <Card
      className={cn('rounded-xl border-slate-200/50', className)}
      data-testid="drive-azure-panel"
    >
      <CardHeader className="py-3 bg-gradient-to-r from-slate-50/50 to-transparent">
        <CardTitle className="text-base flex items-center gap-2">
          Gestion Drive
          <Badge
            variant="secondary"
            className="text-[10px] uppercase"
            data-testid="drive-backend-badge"
          >
            {backend === 'hybrid' ? 'Hybride' : 'Azure'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {spacesQuery.isLoading && (
          <div className="space-y-2" data-testid="drive-spaces-loading">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}

        {spacesQuery.isError && (
          <div className="space-y-2" data-testid="drive-spaces-error">
            <p className="text-sm text-muted-foreground">
              API Gestion Drive indisponible. Le mode Documents classique reste pleinement
              fonctionnel.
            </p>
            <p className="text-xs text-muted-foreground" data-testid="drive-spaces-error-detail">
              {driveErrorMessage(spacesQuery.error)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => spacesQuery.refetch()}
              data-testid="drive-spaces-retry"
            >
              Réessayer
            </Button>
          </div>
        )}

        {!spacesQuery.isLoading && !spacesQuery.isError && spaces.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="drive-spaces-empty">
            Aucun espace Drive accessible pour le moment.
          </p>
        )}

        {spaces.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2" data-testid="drive-spaces-list">
              {spaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => selectSpace(space.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    space.id === activeSpaceId
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                  data-testid={`drive-space-${space.slug}`}
                >
                  <span className="font-medium">{space.name}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {SPACE_TYPE_LABELS[space.type]}
                  </span>
                  {space.sync_policy === 'web_only' && (
                    <span className="ml-1.5 text-amber-600">web uniquement</span>
                  )}
                </button>
              ))}
            </div>

            {treeQuery.isLoading && (
              <div className="space-y-2" data-testid="drive-tree-loading">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-6 w-4/6" />
              </div>
            )}

            {treeQuery.isError && (
              <div className="space-y-2" data-testid="drive-tree-error">
                <p className="text-sm text-muted-foreground">
                  Impossible de charger l'arborescence de « {activeSpace?.name ?? 'cet espace'} ».
                </p>
                <p className="text-xs text-muted-foreground" data-testid="drive-tree-error-detail">
                  {driveErrorMessage(treeQuery.error)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => treeQuery.refetch()}
                  data-testid="drive-tree-retry"
                >
                  Réessayer
                </Button>
              </div>
            )}

            {treeQuery.data && (
              <div data-testid="drive-tree">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground" data-testid="drive-tree-summary">
                    {folders.length} dossier{folders.length > 1 ? 's' : ''} · {files.length} fichier
                    {files.length > 1 ? 's' : ''} · {formatBytes(totalBytes)} utilisés dans cet
                    espace
                  </p>
                  <span className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => handleUploadFiles(event.target.files)}
                      aria-label="Sélectionner des fichiers à téléverser"
                      data-testid="drive-upload-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={upload.isPending || !activeSpaceId}
                      data-testid="drive-upload-button"
                    >
                      {upload.isPending ? 'Téléversement…' : 'Téléverser'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowPermissions((v) => !v)}
                      data-testid="drive-permissions-toggle"
                    >
                      {showPermissions ? 'Masquer les accès' : 'Gérer les accès'}
                    </Button>
                  </span>
                </div>

                {uploadNotice && (
                  <p className="mb-2 text-xs text-emerald-700" data-testid="drive-upload-notice">
                    {uploadNotice}
                  </p>
                )}
                {uploadError && (
                  <p className="mb-2 text-xs text-destructive" data-testid="drive-upload-error">
                    {uploadError}
                  </p>
                )}
                {downloadError && (
                  <p className="mb-2 text-xs text-destructive" data-testid="drive-download-error">
                    {downloadError}
                  </p>
                )}

                {files.length === 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="drive-tree-empty">
                    Aucun fichier dans cet espace. Utilisez « Téléverser » pour déposer un premier
                    document.
                  </p>
                )}

                <ul className="space-y-1">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm"
                      data-testid={`drive-file-${file.id}`}
                    >
                      <span className="truncate">{file.path}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {evidenceBadge(file)}
                        <span>v{file.current_version}</span>
                        <span>{formatBytes(file.size_bytes)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingFileId === file.id}
                          aria-label={`Télécharger ${file.name}`}
                          data-testid={`drive-file-download-${file.id}`}
                        >
                          {downloadingFileId === file.id ? '…' : 'Télécharger'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-6 px-1.5 text-[11px]',
                            permissionFileId === file.id && showPermissions && 'text-primary'
                          )}
                          onClick={() => togglePermissionsForFile(file.id)}
                          aria-label={`Gérer les accès de ${file.name}`}
                          data-testid={`drive-file-permissions-${file.id}`}
                        >
                          Accès
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showPermissions && activeSpaceId && (
              <DrivePermissionsPanel
                scope={{
                  spaceId: activeSpaceId,
                  fileId: permissionFile ? permissionFile.id : null,
                }}
                scopeLabel={permissionFile ? permissionFile.path : (activeSpace?.name ?? 'Espace')}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default DriveAzurePanel
