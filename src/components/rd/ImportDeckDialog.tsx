import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ImportDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetId?: string;
  onSuccess?: (projetId: string) => void;
}

interface DeckBoard {
  title: string;
  color: string;
  labels: { title: string; color: string }[];
  stacks: Record<string, { title: string; cards: { title: string }[] }>;
}

interface DeckPreview {
  boards: DeckBoard[];
  totalCards: number;
  totalLabels: number;
}

export function ImportDeckDialog({ open, onOpenChange, projetId, onSuccess }: ImportDeckDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DeckPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      if (!data.boards || !Array.isArray(data.boards)) {
        throw new Error('Format JSON invalide. Attendu: export Nextcloud Deck');
      }

      let totalCards = 0;
      let totalLabels = 0;

      data.boards.forEach((board: DeckBoard) => {
        totalLabels += board.labels?.length || 0;
        Object.values(board.stacks || {}).forEach((stack: any) => {
          totalCards += stack.cards?.length || 0;
        });
      });

      setPreview({
        boards: data.boards,
        totalCards,
        totalLabels,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de lecture du fichier');
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setIsImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const deckData = JSON.parse(text);

      const data = await invokeEdge<any>('import-deck-json', { deckData, projetId });
      toast.success(`Import réussi: ${data.results?.length || 0} projet(s) importé(s)`);
      queryClient.invalidateQueries({ queryKey: ['rd-projets'] });
      queryClient.invalidateQueries({ queryKey: ['rd-epics'] });
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories'] });
      
      // Call onSuccess with first created project ID
      const firstProjectId = data.results?.[0]?.projetId;
      if (onSuccess && firstProjectId) {
        onSuccess(firstProjectId);
      } else {
        onOpenChange(false);
      }
      
      // Reset state
      setFile(null);
      setPreview(null);
    } catch (err) {
      debug.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
      toast.error('Échec de l\'import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Importer depuis Nextcloud Deck
          </DialogTitle>
          <DialogDescription>
            Importez vos projets Deck au format JSON pour créer des projets R&D avec epics et user stories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="deck-file">Fichier JSON Deck</Label>
            <div className="flex items-center gap-2">
              <Input
                id="deck-file"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Aperçu de l'import
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{preview.boards.length}</p>
                    <p className="text-xs text-muted-foreground">Projet(s)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{preview.totalLabels}</p>
                    <p className="text-xs text-muted-foreground">Epics</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{preview.totalCards}</p>
                    <p className="text-xs text-muted-foreground">Stories</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {preview.boards.map((board, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      style={{ borderLeft: `3px solid #${board.color}` }}
                    >
                      <span className="text-sm font-medium flex-1">{board.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {Object.values(board.stacks || {}).reduce(
                          (acc, stack: any) => acc + (stack.cards?.length || 0), 0
                        )} cards
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!preview || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
