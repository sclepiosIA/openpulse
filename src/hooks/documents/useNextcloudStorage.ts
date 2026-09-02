import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from '@/lib/debug';
import { format } from "date-fns";

export interface NextcloudFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
  etag?: string;
}

interface UploadToNextcloudParams {
  file: File;
  folderPath?: string;
}

interface NextcloudActionResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

// Convertir un fichier en base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Retirer le préfixe data:...;base64,
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useNextcloudUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, folderPath = "" }: UploadToNextcloudParams): Promise<{ path: string }> => {
      // Générer le chemin de stockage
      const dateFolder = format(new Date(), "yyyy-MM");
      const fileId = crypto.randomUUID();
      const extension = file.name.split(".").pop() || "";
      const storagePath = `/${dateFolder}/${fileId}.${extension}`;
      const fullPath = folderPath ? `${folderPath}${storagePath}` : storagePath;

      // Convertir en base64
      const base64Content = await fileToBase64(file);

      // Appeler l'Edge Function
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: {
          action: "upload",
          path: fullPath,
          content: base64Content,
          contentType: file.type || "application/octet-stream",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return { path: fullPath };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextcloud-files"] });
    },
    onError: (error) => {
      debug.error("Erreur upload Nextcloud:", error);
      toast.error("Erreur lors de l'upload vers Nextcloud");
    },
  });
}

export function useNextcloudDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "delete", path },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextcloud-files"] });
      toast.success("Fichier supprimé de Nextcloud");
    },
    onError: (error) => {
      debug.error("Erreur suppression Nextcloud:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

export function useNextcloudMove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourcePath, destinationPath }: { sourcePath: string; destinationPath: string }): Promise<void> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "move", path: sourcePath, destinationPath },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextcloud-files"] });
      toast.success("Fichier déplacé");
    },
    onError: (error) => {
      debug.error("Erreur déplacement Nextcloud:", error);
      toast.error("Erreur lors du déplacement");
    },
  });
}

export function useNextcloudCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "mkdir", path },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nextcloud-files"] });
      toast.success("Dossier créé");
    },
    onError: (error) => {
      debug.error("Erreur création dossier Nextcloud:", error);
      toast.error("Erreur lors de la création du dossier");
    },
  });
}

// Fonction utilitaire pour obtenir une URL de téléchargement
export async function getNextcloudDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("nextcloud-files", {
    body: { action: "download-url", path },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.url;
}

// Fonction utilitaire pour télécharger le contenu d'un fichier
export async function downloadNextcloudFile(path: string): Promise<{ content: Blob; mimeType: string }> {
  const { data, error } = await supabase.functions.invoke("nextcloud-files", {
    body: { action: "download", path },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Décoder le base64
  const binaryString = atob(data.content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    content: new Blob([bytes], { type: data.mimeType }),
    mimeType: data.mimeType,
  };
}
