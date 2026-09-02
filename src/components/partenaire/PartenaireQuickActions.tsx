import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StickyNote, ListTodo, Activity, Plus, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePartenaireActivities } from "@/hooks/crm/usePartenaireActivities";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { savePartenaireNote } from '@/services/partenaires/partenaireMutations';

interface PartenaireQuickActionsProps {
  partenaireId: string;
  partenaireName: string;
}

export function PartenaireQuickActions({ partenaireId, partenaireName }: PartenaireQuickActionsProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: activities = [], isLoading: activitiesLoading } = usePartenaireActivities(partenaireId);

  const handleSaveNote = async () => {
    if (!note.trim()) return;
    
    setSaving(true);
    try {
      await savePartenaireNote(partenaireId, note);
      
      toast.success("Note enregistrée");
      setNote("");
      setNoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Get recent tasks (emails with partenaire_id)
  const recentActivities = activities.slice(0, 3);

  return (
    <div className="flex items-center gap-1">
      {/* Note rapide */}
      <Popover open={noteOpen} onOpenChange={setNoteOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Note">
                <StickyNote className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Ajouter une note</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Note rapide - {partenaireName}</h4>
            <Textarea
              placeholder="Ajouter une note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSaveNote} disabled={saving || !note.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Résumé tâches */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tâches">
                <ListTodo className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Résumé tâches</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Tâches liées
            </h4>
            <p className="text-xs text-muted-foreground">
              Les tâches liées à ce partenaire apparaîtront ici.
            </p>
            <Badge variant="outline" className="text-xs">
              Fonctionnalité à venir
            </Badge>
          </div>
        </PopoverContent>
      </Popover>

      {/* Résumé activités */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Activités récentes">
                <Activity className="h-4 w-4" />
                {recentActivities.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {recentActivities.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Activités récentes</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activités récentes
            </h4>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="p-2 rounded-md bg-muted/50 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                      <span className="text-muted-foreground">
                        {activity.date ? formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr }) : '-'}
                      </span>
                    </div>
                    <p className="mt-1 font-medium truncate">{activity.title}</p>
                    {activity.description && (
                      <p className="text-muted-foreground truncate">{activity.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune activité récente
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
