import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Trash2, UserPlus, Tags, Tag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDeletePartenaire } from "@/hooks/crm/usePartenaires";
import { useProfiles } from "@/hooks/profile/useProfiles";
import { useToast } from "@/hooks/shared/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkActionsBarPartenairesProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onExport: (format: 'csv' | 'excel' | 'pdf') => void;
}

export function BulkActionsBarPartenaires({ selectedIds, onClearSelection, onExport }: BulkActionsBarPartenairesProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [selectedResponsable, setSelectedResponsable] = useState<string>("");
  const [newTag, setNewTag] = useState("");
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const deletePartenaire = useDeletePartenaire();
  const { data: profiles = [] } = useProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await deletePartenaire.mutateAsync(id);
      }
      toast({
        title: "Suppression réussie",
        description: `${selectedIds.length} partenaire(s) supprimé(s)`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les partenaires",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedResponsable) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('partenaires')
        .update({ responsable_marque_id: selectedResponsable })
        .in('id', selectedIds);

      if (error) throw error;

      toast({
        title: "Assignation réussie",
        description: `${selectedIds.length} partenaire(s) assigné(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'assigner les partenaires",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowAssignDialog(false);
      setSelectedResponsable("");
    }
  };

  const handleBulkChangeStatus = async (statut: 'prospect' | 'actif' | 'inactif' | 'termine') => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('partenaires')
        .update({ statut_relation: statut })
        .in('id', selectedIds);
      if (error) throw error;
      toast({
        title: "Statut mis à jour",
        description: `${selectedIds.length} partenaire(s) → ${statut}`,
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      onClearSelection();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de changer le statut",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tagsToAdd.includes(newTag.trim())) {
      setTagsToAdd([...tagsToAdd, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTagsToAdd(tagsToAdd.filter(t => t !== tag));
  };

  const handleBulkTags = async () => {
    if (tagsToAdd.length === 0) return;
    
    setIsProcessing(true);
    try {
      // For now, we'll update notes field with tags (could be extended to proper tags table)
      for (const id of selectedIds) {
        const { data: partenaire } = await supabase
          .from('partenaires')
          .select('notes')
          .eq('id', id)
          .maybeSingle();

        const existingNotes = partenaire?.notes || '';
        const tagsString = `[Tags: ${tagsToAdd.join(', ')}]`;
        const newNotes = existingNotes ? `${existingNotes}\n${tagsString}` : tagsString;

        await supabase
          .from('partenaires')
          .update({ notes: newNotes })
          .eq('id', id);
      }

      toast({
        title: "Tags ajoutés",
        description: `${tagsToAdd.length} tag(s) ajouté(s) à ${selectedIds.length} partenaire(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter les tags",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowTagsDialog(false);
      setTagsToAdd([]);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4 min-w-[500px] max-w-[90vw]">
        <span className="font-medium">
          {selectedIds.length} partenaire{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
        </span>

        <div className="flex gap-2 ml-auto flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport('csv')}>
                Exporter en CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('excel')}>
                Exporter en Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('pdf')}>
                Exporter en PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" size="sm" onClick={() => setShowAssignDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assigner
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setShowTagsDialog(true)} aria-label="Ajouter des tags">
            <Tags className="mr-2 h-4 w-4" />
            Tags
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" aria-label="Changer le statut">
                <Tag className="mr-2 h-4 w-4" />
                Statut
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('prospect')}>Prospect</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('actif')}>Actif</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('inactif')}>Inactif</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('termine')}>Terminé</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            aria-label="Supprimer la sélection"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            aria-label="Annuler la sélection"
            title="Annuler la sélection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.length} partenaire{selectedIds.length > 1 ? 's' : ''} ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isProcessing}>
              {isProcessing ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un responsable</DialogTitle>
            <DialogDescription>
              Sélectionnez le responsable à assigner à {selectedIds.length} partenaire{selectedIds.length > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedResponsable} onValueChange={setSelectedResponsable}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un responsable" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.prenom} {profile.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button onClick={handleBulkAssign} disabled={!selectedResponsable || isProcessing}>
              {isProcessing ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Dialog */}
      <Dialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter des tags</DialogTitle>
            <DialogDescription>
              Ajoutez des tags à {selectedIds.length} partenaire{selectedIds.length > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nouveau tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button variant="outline" onClick={handleAddTag}>
                Ajouter
              </Button>
            </div>
            {tagsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagsToAdd.map((tag) => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                    {tag}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagsDialog(false)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button onClick={handleBulkTags} disabled={tagsToAdd.length === 0 || isProcessing}>
              {isProcessing ? "Application..." : `Appliquer ${tagsToAdd.length} tag(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
