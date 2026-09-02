import { useEffect } from "react";
import type { SourceType } from "./FinderColumnView.helpers";
import type { DocumentFolder } from "@/types/folders";
import type { DocumentWithRelations } from "@/types/documents";
import type { NextcloudFile } from "@/hooks/documents/useNextcloudFolderTree";

type ItemType = 'folder' | 'document' | 'file';
type Item = { itemType: ItemType } & Record<string, any>;

interface Params {
  activeSource: SourceType;
  // Local
  activeItems: Item[];
  activeColumnIndex: number;
  selectedIndices: number[];
  setSelectedIndices: React.Dispatch<React.SetStateAction<number[]>>;
  localPathLength: number;
  previewDocument: any;
  onDocumentPreview?: (d: DocumentWithRelations) => void;
  handleFolderSelect: (f: DocumentFolder, idx: number, mode?: 'hover' | 'commit') => void;
  selectItemAtIndex: (i: number) => void;
  // Nextcloud
  activeNextcloudItems: Item[];
  activeNextcloudColumnIndex: number;
  nextcloudSelectedIndices: number[];
  setNextcloudSelectedIndices: React.Dispatch<React.SetStateAction<number[]>>;
  nextcloudPathLength: number;
  previewNextcloudFile: NextcloudFile | null;
  handleNextcloudFolderSelect: (f: NextcloudFile, mode?: 'hover' | 'commit') => void;
  selectNextcloudItemAtIndex: (i: number) => void;
  handleNextcloudDownload: () => void;
  // Shared
  goBack: () => void;
}

export function useFinderKeyboardNav(p: Params) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[role="dialog"]')) return;

      if (p.activeSource === 'local') {
        const currentIndex = p.selectedIndices[p.activeColumnIndex] ?? 0;
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (p.activeItems.length > 0) {
              const newIndex = Math.max(0, currentIndex - 1);
              p.setSelectedIndices(prev => { const n = [...prev]; n[p.activeColumnIndex] = newIndex; return n; });
              p.selectItemAtIndex(newIndex);
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (p.activeItems.length > 0) {
              const newIndex = Math.min(p.activeItems.length - 1, currentIndex + 1);
              p.setSelectedIndices(prev => { const n = [...prev]; n[p.activeColumnIndex] = newIndex; return n; });
              p.selectItemAtIndex(newIndex);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (p.activeItems.length > 0 && currentIndex < p.activeItems.length) {
              const item = p.activeItems[currentIndex];
              if (item.itemType === 'folder') p.handleFolderSelect(item as unknown as DocumentFolder, p.activeColumnIndex, 'commit');
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (p.activeItems.length > 0 && currentIndex < p.activeItems.length) {
              const item = p.activeItems[currentIndex];
              if (item.itemType === 'folder') p.handleFolderSelect(item as unknown as DocumentFolder, p.activeColumnIndex, 'commit');
              else if (item.itemType === 'document') p.onDocumentPreview?.(item as unknown as DocumentWithRelations);
            }
            break;
          case ' ':
            e.preventDefault();
            if (p.previewDocument) p.onDocumentPreview?.(p.previewDocument);
            break;
          case 'ArrowLeft':
          case 'Backspace':
            e.preventDefault();
            if (p.localPathLength > 1) p.goBack();
            break;
        }
      } else if (p.activeSource === 'nextcloud') {
        const currentIndex = p.nextcloudSelectedIndices[p.activeNextcloudColumnIndex] ?? 0;
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (p.activeNextcloudItems.length > 0) {
              const newIndex = Math.max(0, currentIndex - 1);
              p.setNextcloudSelectedIndices(prev => { const n = [...prev]; n[p.activeNextcloudColumnIndex] = newIndex; return n; });
              p.selectNextcloudItemAtIndex(newIndex);
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (p.activeNextcloudItems.length > 0) {
              const newIndex = Math.min(p.activeNextcloudItems.length - 1, currentIndex + 1);
              p.setNextcloudSelectedIndices(prev => { const n = [...prev]; n[p.activeNextcloudColumnIndex] = newIndex; return n; });
              p.selectNextcloudItemAtIndex(newIndex);
            }
            break;
          case 'ArrowRight':
          case 'Enter':
            e.preventDefault();
            if (p.activeNextcloudItems.length > 0 && currentIndex < p.activeNextcloudItems.length) {
              const item = p.activeNextcloudItems[currentIndex];
              if (item.itemType === 'folder') {
                p.handleNextcloudFolderSelect(item as unknown as NextcloudFile, 'commit');
                p.setNextcloudSelectedIndices(prev => [...prev, 0]);
              } else if (e.key === 'Enter' && item.itemType === 'file') {
                p.handleNextcloudDownload();
              }
            }
            break;
          case ' ':
            e.preventDefault();
            if (p.previewNextcloudFile) p.handleNextcloudDownload();
            break;
          case 'ArrowLeft':
          case 'Backspace':
            e.preventDefault();
            if (p.nextcloudPathLength > 1) {
              p.goBack();
              p.setNextcloudSelectedIndices(prev => prev.slice(0, -1));
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    p.activeSource, p.activeItems, p.activeColumnIndex, p.selectedIndices, p.localPathLength,
    p.onDocumentPreview, p.previewDocument, p.activeNextcloudItems, p.activeNextcloudColumnIndex,
    p.nextcloudSelectedIndices, p.nextcloudPathLength, p.previewNextcloudFile,
  ]);
}
