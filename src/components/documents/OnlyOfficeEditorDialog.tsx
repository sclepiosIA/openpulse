import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import type { DocumentWithRelations } from "@/types/documents";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";

interface OnlyOfficeEditorDialogProps {
  document: DocumentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Types pour OnlyOffice
interface OnlyOfficeConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: {
      edit: boolean;
      download: boolean;
      print: boolean;
    };
  };
  documentType: "word" | "cell" | "slide";
  editorConfig: {
    callbackUrl: string;
    user: {
      id: string;
      name: string;
    };
    lang: string;
    mode: "edit";
    customization: {
      autosave: boolean;
      forcesave: boolean;
      chat: boolean;
      comments: boolean;
      compactHeader: boolean;
      feedback: boolean;
      help: boolean;
    };
  };
  token?: string;
  height: string;
  width: string;
}

const DOCUMENT_TYPES: Record<string, "word" | "cell" | "slide"> = {
  // Word
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.oasis.opendocument.text": "word",
  "text/plain": "word",
  "application/rtf": "word",
  // Excel
  "application/vnd.ms-excel": "cell",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "cell",
  "application/vnd.oasis.opendocument.spreadsheet": "cell",
  "text/csv": "cell",
  // PowerPoint
  "application/vnd.ms-powerpoint": "slide",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slide",
  "application/vnd.oasis.opendocument.presentation": "slide",
};

const FILE_EXTENSIONS: Record<string, string> = {
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/plain": "txt",
  "application/rtf": "rtf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "text/csv": "csv",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.presentation": "odp",
};

export function OnlyOfficeEditorDialog({
  document,
  open,
  onOpenChange,
}: OnlyOfficeEditorDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorConfig, setEditorConfig] = useState<OnlyOfficeConfig | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const docEditorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const queryClient = useQueryClient();

  const initializeEditor = useCallback(async () => {
    if (!document || !open) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Get current user
      if (!user) throw new Error("Non authentifié");

      // 2. Get user profile for display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("nom, prenom")
        .eq("id", user.id)
        .maybeSingle();

      const userName = profile
        ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || user.email || "Utilisateur"
        : user.email || "Utilisateur";

      // 3. Get JWT token + server-signed URL for OnlyOffice (SSRF protection: URL signed server-side)
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        "onlyoffice-token",
        {
          body: {
            documentId: document.id,
          },
        }
      );

      if (tokenError || !tokenData?.token || !tokenData?.documentUrl) {
        debug.error("Token error:", tokenError);
        throw new Error("Erreur de configuration OnlyOffice");
      }

      // 4. Build editor config
      const documentType = DOCUMENT_TYPES[document.mime_type] || "word";
      const fileExtension = FILE_EXTENSIONS[document.mime_type] || document.name.split('.').pop() || "docx";
      
      // Generate a unique key for this editing session
      const documentKey = `${document.id}-${Date.now()}`;

      // Get callback URL
      const { data: { session } } = await supabase.auth.getSession();
      const callbackUrl = `${SUPABASE_URL}/functions/v1/onlyoffice-callback?documentId=${document.id}`;

      const config: OnlyOfficeConfig = {
        document: {
          fileType: fileExtension,
          key: documentKey,
          title: document.name,
          url: tokenData.documentUrl,

          permissions: {
            edit: true,
            download: true,
            print: true,
          },
        },
        documentType,
        editorConfig: {
          callbackUrl,
          user: {
            id: user.id,
            name: userName,
          },
          lang: "fr",
          mode: "edit",
          customization: {
            autosave: true,
            forcesave: true,
            chat: true,
            comments: true,
            compactHeader: true,
            feedback: false,
            help: false,
          },
        },
        token: tokenData?.token,
        height: "100%",
        width: "100%",
      };

      setEditorConfig(config);
      setLoading(false);

    } catch (err: unknown) {
      debug.error("Error initializing OnlyOffice:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'initialisation de l'éditeur";
      setError(errorMessage);
      setLoading(false);
    }
  }, [document, open]);

  useEffect(() => {
    if (open && document) {
      initializeEditor();
    }

    return () => {
      // Cleanup editor instance
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
        } catch (e) {
          debug.warn("Error destroying editor:", e);
        }
        docEditorRef.current = null;
      }
      setEditorConfig(null);
      setLoading(true);
      setError(null);
    };
  }, [open, document, initializeEditor]);

  // Load OnlyOffice script and create editor
  useEffect(() => {
    if (!editorConfig || !editorContainerRef.current || loading) return;

    const loadScript = async () => {
      // Check if script already loaded
      if (window.DocsAPI) {
        createEditor();
        return;
      }

      // Get Document Server URL from env or use the one from token generation
      const docServerUrl = await getDocServerUrl();
      if (!docServerUrl) {
        setError("URL du serveur OnlyOffice non configurée");
        return;
      }

      const script = window.document.createElement("script");
      script.src = `${docServerUrl}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = createEditor;
      script.onerror = () => {
        setError("Impossible de charger OnlyOffice Document Server");
      };
      window.document.head.appendChild(script);
    };

    const getDocServerUrl = async () => {
      try {
        const { data } = await supabase.functions.invoke("onlyoffice-token", {
          body: { action: "getServerUrl" },
        });
        return data?.serverUrl;
      } catch {
        return null;
      }
    };

    const createEditor = () => {
      if (docEditorRef.current) return;

      try {
        if (!window.DocsAPI) {
          setError("OnlyOffice API non chargée");
          return;
        }
        docEditorRef.current = new window.DocsAPI.DocEditor(
          "onlyoffice-editor",
          {
            ...editorConfig,
            events: {
              onReady: () => {
                debug.log("OnlyOffice editor ready");
              },
              onError: (event) => {
                debug.error("OnlyOffice error:", event);
                toast.error("Erreur de l'éditeur OnlyOffice");
              },
              onDocumentStateChange: (event) => {
                // Document modified state changed
                debug.log("Document state:", event.data);
              },
              onRequestClose: () => {
                handleClose();
              },
            },
          }
        );
      } catch (err) {
        debug.error("Error creating DocEditor:", err);
        setError("Erreur lors de la création de l'éditeur");
      }
    };

    loadScript();
  }, [editorConfig, loading]);

  const handleClose = () => {
    // Invalidate queries to refresh document list
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    onOpenChange(false);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-3 border-b bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium truncate">
              {document.name}
            </span>
            <span className="text-xs text-muted-foreground">
              Édition collaborative
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor container */}
        <div className="flex-1 relative" ref={editorContainerRef}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Chargement de l'éditeur...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center space-y-3 max-w-md px-4">
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez que le serveur OnlyOffice est correctement configuré.
                </p>
                <Button variant="outline" onClick={handleClose}>
                  Fermer
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div id="onlyoffice-editor" className="w-full h-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
