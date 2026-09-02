import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cloud, CheckCircle2, AlertCircle, Loader2, FolderDown } from "lucide-react";
import { invokeEdge } from "@/services/edgeFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NextcloudImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  foldersCreated: number;
  documentsCreated: number;
  skipped: number;
  errors: string[];
}

export function NextcloudImportDialog({ open, onOpenChange }: NextcloudImportDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleImport = async () => {
    setStatus('importing');
    setResult(null);
    setErrorMsg("");

    try {
      const data = await invokeEdge<any>('nextcloud-import');
      if (data?.error) {
        throw new Error(data.error);
      }

      setResult(data as ImportResult);
      setStatus('done');

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] });

      toast.success(`Import terminé : ${data.documentsCreated} documents, ${data.foldersCreated} dossiers`);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur inconnue");
      setStatus('error');
      toast.error("Erreur lors de l'import Nextcloud");
    }
  };

  const handleClose = () => {
    if (status !== 'importing') {
      setStatus('idle');
      setResult(null);
      setErrorMsg("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Importer depuis Nextcloud
          </DialogTitle>
          <DialogDescription>
            Importez l'ensemble de l'arborescence Nextcloud dans vos documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {status === 'idle' && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm text-foreground">
                  Cette action va :
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Parcourir récursivement tous les dossiers Nextcloud</li>
                  <li>Créer les dossiers correspondants dans la GED</li>
                  <li>Référencer tous les fichiers en tant que documents</li>
                  <li>Les documents existants seront ignorés (dédoublonnage)</li>
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Annuler</Button>
                <Button onClick={handleImport} className="gap-2">
                  <FolderDown className="h-4 w-4" />
                  Lancer l'import
                </Button>
              </div>
            </>
          )}

          {status === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Import en cours…</p>
              <p className="text-xs text-muted-foreground">Parcours de l'arborescence Nextcloud</p>
              <Progress
                value={undefined}
                className="w-full"
                aria-label="Import Nextcloud en cours"
              />
            </div>
          )}

          {status === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6" />
                <p className="font-medium">Import terminé avec succès</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{result.foldersCreated}</p>
                  <p className="text-xs text-muted-foreground">Dossiers créés</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{result.documentsCreated}</p>
                  <p className="text-xs text-muted-foreground">Documents importés</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Ignorés</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">{result.errors.length} erreur(s)</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleClose}>Fermer</Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <p className="font-medium">Erreur lors de l'import</p>
              </div>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Fermer</Button>
                <Button onClick={handleImport}>Réessayer</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
