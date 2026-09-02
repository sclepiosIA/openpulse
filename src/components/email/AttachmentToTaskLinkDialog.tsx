import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseBrowser";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useTaches } from "@/hooks/tasks/useTaches";
import { Loader2, Link, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Task } from "@/types/gantt";
import type { TacheData } from "@/lib/validations";

interface AttachmentToTaskLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: {
    id: string;
    filename: string;
    mime_type: string;
    storage_path?: string;
  };
  etablissementId: string;
  messageSubject?: string;
  autoDetection?: {
    type: string | null;
    confidence: number;
    matchedKeywords: string[];
  };
}

export function AttachmentToTaskLinkDialog({
  open,
  onOpenChange,
  attachment,
  etablissementId,
  messageSubject,
  autoDetection
}: AttachmentToTaskLinkDialogProps) {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);
  const { data: tasks, isLoading: tasksLoading } = useTaches();

  // Filter tasks for this establishment
  const etablissementTasks = tasks?.filter(
    (t) => t.etablissement_id === etablissementId && t.statut !== 'Terminé'
  );

  /** Type pour tâche avec catégorie (extension du TacheData standard) */
  type TacheWithCategorie = TacheData & {
    categories_taches?: { id: string; nom: string; couleur?: string } | null;
  };

  // Pre-select recommended task if auto-detection confidence > 0.6
  useEffect(() => {
    if (autoDetection && autoDetection.confidence > 0.6 && etablissementTasks) {
      const tasksWithCategories = etablissementTasks as TacheWithCategorie[];
      const recommendedTask = tasksWithCategories.find((t) =>
        t.categories_taches?.nom?.toLowerCase().includes(autoDetection.type?.toLowerCase() || '')
      );
      if (recommendedTask) {
        setSelectedTaskId(recommendedTask.id);
      }
    }
  }, [autoDetection, etablissementTasks]);

  const handleLink = async () => {
    if (!selectedTaskId) return;

    setIsLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-link-attachment-to-task', {
        body: {
          attachment_id: attachment.id,
          etablissement_id: etablissementId,
          force_task_id: selectedTaskId
        }
      });

      if (error) throw error;

      toast({
        title: "Document associé",
        description: `${attachment.filename} a été associé à la tâche (version ${data.version})`,
      });

      onOpenChange(false);
    } catch (error) {
      const errorMessage = sanitizeSupabaseError(error);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Associer à une tâche
          </DialogTitle>
          <DialogDescription>
            Sélectionnez la tâche à laquelle associer ce document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File info */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium">{attachment.filename}</p>
            {messageSubject && (
              <p className="text-xs text-muted-foreground mt-1">
                Email: {messageSubject}
              </p>
            )}
          </div>

          {/* Auto-detection result */}
          {autoDetection && autoDetection.type && (
            <div className={`rounded-lg border p-3 ${
              autoDetection.confidence > 0.7 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
              autoDetection.confidence > 0.5 ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' :
              'border-muted bg-muted/30'
            }`}>
              <div className="flex items-center gap-2">
                {autoDetection.confidence > 0.7 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                <p className="text-sm font-medium">
                  Type détecté : {autoDetection.type}
                </p>
                <Badge variant="outline" className="ml-auto">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {(autoDetection.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
              {autoDetection.matchedKeywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {autoDetection.matchedKeywords.slice(0, 5).map(kw => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Task selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tâche</label>
            {tasksLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une tâche" />
                </SelectTrigger>
                <SelectContent>
                  {etablissementTasks?.map((task) => {
                    const cat = (task as { categories_taches?: { nom?: string } }).categories_taches;
                    return (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex items-center gap-2">
                          <span>{task.titre}</span>
                          {cat?.nom && (
                            <Badge variant="outline" className="text-xs">
                              {cat.nom}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleLink} disabled={!selectedTaskId || isLinking}>
              {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Associer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
