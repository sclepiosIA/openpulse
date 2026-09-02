import { Calendar, HardDrive, Cloud, Folder } from "lucide-react";
import { formatFileSize, getFileTypeLabel } from "./FinderColumnView.helpers";
import { InlineDocumentPreview } from "@/components/documents/InlineDocumentPreview";
import { ColorTagsBar, type ColorTagId } from "@/components/documents/finder/ColorTagsBar";
import { FinderActionBar } from "@/components/documents/finder/FinderActionBar";
import { safeFormat, safeFormatDistanceToNow } from "@/lib/safeDate";
import { fr } from "date-fns/locale";
import type { DocumentFolder } from "@/types/folders";
import type { NextcloudFile } from "@/hooks/documents/useNextcloudFolderTree";

interface LocalDocumentPreviewPanelProps {
  previewDocument: any;
  previewUrl: string | null;
  loadingPreview: boolean;
  isTogglingTag: boolean;
  isDeleting: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onTagToggle: (tagId: ColorTagId) => void;
}

export function LocalDocumentPreviewPanel({
  previewDocument, previewUrl, loadingPreview, isTogglingTag, isDeleting,
  onPreview, onDownload, onRename, onCopy, onDelete, onTagToggle,
}: LocalDocumentPreviewPanelProps) {
  return (
    <div className="w-[380px] min-w-[380px] h-full border-l bg-muted/10 flex flex-col finder-column-enter">
      <div className="flex-1 p-3 flex flex-col overflow-auto">
        <div className="mb-3 flex-shrink-0">
          <InlineDocumentPreview
            url={previewUrl}
            mimeType={previewDocument.mime_type || null}
            fileName={previewDocument.name}
            loading={loadingPreview}
            onOpenFullPreview={onPreview}
            maxWidth={356}
          />
        </div>
        <h3 className="font-semibold text-sm text-center mb-1 break-words max-w-full leading-tight">
          {previewDocument.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          {getFileTypeLabel(previewDocument.mime_type)}
        </p>
      </div>
      <div className="border-t px-4 py-2 bg-muted/5">
        <ColorTagsBar
          selectedTags={(previewDocument.color_tags as string[]) || []}
          onTagToggle={onTagToggle}
          disabled={isTogglingTag}
        />
      </div>
      <div className="border-t px-4 py-3 space-y-2.5 text-xs bg-muted/5">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3 w-3" />
            Taille
          </span>
          <span className="font-medium">{formatFileSize(previewDocument.file_size_bytes || 0)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Créé
          </span>
          <span className="font-medium">
            {safeFormat(previewDocument.created_at, 'dd MMM yyyy', { locale: fr })}
          </span>
        </div>
        {previewDocument.updated_at && previewDocument.updated_at !== previewDocument.created_at && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Modifié
            </span>
            <span className="font-medium">
              {safeFormatDistanceToNow(previewDocument.updated_at, { addSuffix: true, locale: fr })}
            </span>
          </div>
        )}
      </div>
      <div className="border-t p-2 bg-muted/5">
        <FinderActionBar
          onPreview={onPreview}
          onDownload={onDownload}
          onRename={onRename}
          onCopy={onCopy}
          onDelete={onDelete}
          disabled={isDeleting}
          hideMove
          hideShare
        />
      </div>
    </div>
  );
}

interface LocalFolderPreviewPanelProps {
  previewFolder: DocumentFolder;
  isTogglingFolderTag: boolean;
  isDeletingFolder: boolean;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onTagToggle: (tagId: ColorTagId) => void;
}

export function LocalFolderPreviewPanel({
  previewFolder, isTogglingFolderTag, isDeletingFolder,
  onRename, onCopy, onDelete, onTagToggle,
}: LocalFolderPreviewPanelProps) {
  return (
    <div className="w-[380px] min-w-[380px] h-full border-l bg-muted/10 flex flex-col finder-column-enter">
      <div className="flex-1 p-4 flex flex-col items-center overflow-auto">
        <div className="mb-3 flex-shrink-0">
          <div className="w-56 h-72 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
            <Folder className="h-20 w-20 text-primary/60" />
          </div>
        </div>
        <h3 className="font-semibold text-sm text-center mb-1 break-words max-w-full leading-tight">
          {previewFolder.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Dossier
        </p>
      </div>
      <div className="border-t px-4 py-2 bg-muted/5">
        <ColorTagsBar
          selectedTags={((previewFolder as any).color_tags as string[]) || []}
          onTagToggle={onTagToggle}
          disabled={isTogglingFolderTag}
        />
      </div>
      <div className="border-t px-4 py-3 space-y-2.5 text-xs bg-muted/5">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Créé
          </span>
          <span className="font-medium">
            {safeFormat(previewFolder.created_at, 'dd MMM yyyy', { locale: fr })}
          </span>
        </div>
        {previewFolder.updated_at && previewFolder.updated_at !== previewFolder.created_at && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Modifié
            </span>
            <span className="font-medium">
              {safeFormatDistanceToNow(previewFolder.updated_at, { addSuffix: true, locale: fr })}
            </span>
          </div>
        )}
      </div>
      <div className="border-t p-2 bg-muted/5">
        <FinderActionBar
          onRename={onRename}
          onCopy={onCopy}
          onDelete={onDelete}
          disabled={isDeletingFolder}
          hidePreview
          hideDownload
          hideMove
          hideShare
        />
      </div>
    </div>
  );
}

interface NextcloudPreviewPanelProps {
  previewNextcloudFile: NextcloudFile;
  ncPreviewUrl: string | null;
  ncPreviewLoading: boolean;
  onDownload: () => void;
  onCopy: () => void;
}

export function NextcloudPreviewPanel({
  previewNextcloudFile, ncPreviewUrl, ncPreviewLoading, onDownload, onCopy,
}: NextcloudPreviewPanelProps) {
  return (
    <div className="w-[380px] min-w-[380px] h-full border-l bg-muted/10 flex flex-col finder-column-enter">
      <div className="flex-1 p-3 flex flex-col overflow-auto">
        <div className="mb-3 flex-shrink-0">
          <InlineDocumentPreview
            url={ncPreviewUrl}
            mimeType={previewNextcloudFile.mimeType || null}
            fileName={previewNextcloudFile.name}
            loading={ncPreviewLoading}
            onOpenFullPreview={onDownload}
            maxWidth={356}
          />
        </div>
        <h3 className="font-semibold text-sm text-center mb-1 break-words max-w-full leading-tight">
          {previewNextcloudFile.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
          <Cloud className="h-3 w-3" />
          Fichier Nextcloud
        </p>
      </div>
      <div className="border-t px-4 py-3 space-y-2.5 text-xs bg-muted/5">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3 w-3" />
            Taille
          </span>
          <span className="font-medium">{formatFileSize(previewNextcloudFile.size || 0)}</span>
        </div>
        {previewNextcloudFile.lastModified && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Modifié
            </span>
            <span className="font-medium">
              {safeFormat(previewNextcloudFile.lastModified, 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
        )}
      </div>
      <div className="border-t p-2 bg-muted/5">
        <FinderActionBar
          onDownload={onDownload}
          onCopy={onCopy}
          hidePreview
          hideRename
          hideMove
          hideShare
          hideDelete
        />
      </div>
    </div>
  );
}
