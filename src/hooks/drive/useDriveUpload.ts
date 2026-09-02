/**
 * Hook React Query : upload d'un fichier vers Gestion Drive (Azure Blob).
 *
 * Flux (plan §7) :
 *  1. `POST /api/drive/upload-intent` → URL SAS + token ;
 *  2. `PUT` direct du blob vers Azure (BlockBlob) ;
 *  3. `POST /api/drive/upload-complete` → commit de la version.
 *
 * Invalide l'arborescence de l'espace ciblé en cas de succès pour que la
 * vue fichiers se rafraîchisse immédiatement. Aucun trafic en mode legacy
 * (hook uniquement monté dans DriveAzurePanel).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  completeDriveUpload,
  requestDriveUploadIntent,
} from '@/lib/drive/driveClient';
import { driveErrorMessage } from '@/lib/drive/errors';
import type { DriveUploadIntentResponse } from '@/lib/drive/types';

/** Limite alignée sur le mode legacy (200 Mo). */
export const DRIVE_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export interface DriveUploadInput {
  spaceId: string;
  file: File;
  /** Chemin cible dans l'espace (défaut : `/<nom du fichier>`). */
  path?: string;
  folderId?: string | null;
}

export interface DriveUploadResult {
  fileId: string;
  version: number;
  path: string;
  action: DriveUploadIntentResponse['action'];
}

async function sha256Hex(file: File): Promise<string | undefined> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // crypto.subtle absent (contexte non sécurisé/vieux navigateur) :
    // l'API accepte un intent sans sha256, l'intégrité est re-calculée côté serveur.
    return undefined;
  }
}

export async function uploadFileToDrive(input: DriveUploadInput): Promise<DriveUploadResult> {
  const { spaceId, file } = input;

  if (file.size > DRIVE_MAX_UPLOAD_BYTES) {
    throw new Error(
      `Fichier trop volumineux (max ${Math.round(DRIVE_MAX_UPLOAD_BYTES / 1024 / 1024)} Mo).`,
    );
  }

  const path = input.path ?? `/${file.name}`;
  const sha256 = await sha256Hex(file);

  const intent = await requestDriveUploadIntent({
    space_id: spaceId,
    path,
    size_bytes: file.size,
    sha256,
    content_type: file.type || 'application/octet-stream',
  });

  if (intent.action === 'conflict') {
    throw new Error(
      intent.conflict_reason
        ? `Conflit de version : ${intent.conflict_reason}`
        : 'Conflit de version : ce fichier a été modifié entre-temps.',
    );
  }

  if (intent.action === 'noop') {
    // Contenu identique déjà présent : rien à téléverser.
    return { fileId: intent.file_id, version: intent.version, path, action: 'noop' };
  }

  if (!intent.upload_url || !intent.upload_token) {
    throw new Error("Réponse d'upload incomplète côté API Gestion Drive.");
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(intent.upload_url, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
  } catch {
    throw new Error('Téléversement vers le stockage Azure impossible (réseau).');
  }
  if (!uploadResponse.ok) {
    throw new Error(`Téléversement Azure refusé (HTTP ${uploadResponse.status}).`);
  }

  await completeDriveUpload({
    upload_token: intent.upload_token,
    file_id: intent.file_id,
    version: intent.version,
    sha256,
    etag: uploadResponse.headers.get('etag') ?? undefined,
    size_bytes: file.size,
  });

  return { fileId: intent.file_id, version: intent.version, path, action: 'upload' };
}

export function useDriveUpload() {
  const queryClient = useQueryClient();

  return useMutation<DriveUploadResult, Error, DriveUploadInput>({
    mutationFn: uploadFileToDrive,
    onSuccess: (_result, variables) => {
      // Rafraîchit la vue fichiers de l'espace ciblé.
      queryClient.invalidateQueries({ queryKey: ['drive', 'tree', variables.spaceId] });
    },
  });
}

/** Message d'erreur affichable pour un échec d'upload Drive. */
export function driveUploadErrorMessage(error: unknown): string {
  return driveErrorMessage(error, "Échec du téléversement vers Gestion Drive.");
}
