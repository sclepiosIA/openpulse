import { useState, useCallback } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from "@/lib/debug";
import type { DocumentWithRelations } from "@/types/documents";

interface BatchDownloadState {
  isDownloading: boolean;
  progress: number;
  total: number;
  current: number;
}

export function useBatchDownload() {
  const [state, setState] = useState<BatchDownloadState>({
    isDownloading: false,
    progress: 0,
    total: 0,
    current: 0,
  });

  const downloadBatch = useCallback(async (documents: DocumentWithRelations[]) => {
    if (documents.length === 0) return;

    // Single file: direct download
    if (documents.length === 1) {
      const doc = documents[0];
      try {
        let blob: Blob;
        if (doc.storage_bucket === 'nextcloud') {
          const { data, error } = await supabase.functions.invoke("nextcloud-files", {
            body: { action: "download", path: doc.storage_path },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          const binaryString = atob(data.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: data.mimeType });
        } else {
          // Un seul document, et c'est une page : elle n'a pas de fichier à
          // télécharger. On le dit, plutôt que de demander au stockage un
          // chemin nul et de rendre son message, qui ne nomme pas la cause.
          if (!doc.storage_path) {
            throw new Error(
              "Cette page se consulte dans l'éditeur : son contenu n'est pas un fichier."
            )
          }
          const { data, error } = await supabase.storage
            .from(doc.storage_bucket)
            .download(doc.storage_path);
          if (error) throw error;
          blob = data;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Téléchargement lancé");
      } catch (err) {
        debug.error("Download error:", err);
        toast.error("Erreur lors du téléchargement");
      }
      return;
    }

    // Multiple files: ZIP
    setState({ isDownloading: true, progress: 0, total: documents.length, current: 0 });

    const zip = new JSZip();
    const nameCount = new Map<string, number>();
    let downloaded = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        let blob: Blob;
        if (doc.storage_bucket === 'nextcloud') {
          const { data, error } = await supabase.functions.invoke("nextcloud-files", {
            body: { action: "download", path: doc.storage_path },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          const binaryString = atob(data.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: data.mimeType });
        } else {
          // Une page n'a pas de fichier : on la saute plutôt que d'échouer
          // sur tout le lot. Un téléchargement groupé qui s'arrête au premier
          // document rédigé serait pire que l'absence de ce document dans
          // l'archive.
          if (!doc.storage_path) continue;
          const { data, error } = await supabase.storage
            .from(doc.storage_bucket)
            .download(doc.storage_path);
          if (error) throw error;
          blob = data;
        }

        // Handle duplicate names
        let fileName = doc.name;
        const count = nameCount.get(fileName) || 0;
        if (count > 0) {
          const ext = fileName.lastIndexOf('.');
          fileName = ext > 0
            ? `${fileName.slice(0, ext)} (${count})${fileName.slice(ext)}`
            : `${fileName} (${count})`;
        }
        nameCount.set(doc.name, count + 1);

        zip.file(fileName, blob);
        downloaded++;
      } catch (err) {
        debug.error(`Error downloading ${doc.name}:`, err);
        errors++;
      }

      setState(prev => ({
        ...prev,
        current: downloaded + errors,
        progress: Math.round(((downloaded + errors) / documents.length) * 100),
      }));
    }

    if (downloaded === 0) {
      toast.error("Aucun fichier n'a pu être téléchargé");
      setState({ isDownloading: false, progress: 0, total: 0, current: 0 });
      return;
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (errors > 0) {
        toast.warning(`${downloaded} fichier(s) téléchargé(s), ${errors} erreur(s)`);
      } else {
        toast.success(`${downloaded} fichier(s) téléchargé(s) en ZIP`);
      }
    } catch (err) {
      debug.error("ZIP generation error:", err);
      toast.error("Erreur lors de la création du ZIP");
    }

    setState({ isDownloading: false, progress: 0, total: 0, current: 0 });
  }, []);

  return {
    downloadBatch,
    ...state,
  };
}
