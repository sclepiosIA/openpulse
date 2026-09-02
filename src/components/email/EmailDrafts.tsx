import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Mail, Trash2, Edit, Search, FileEdit, Paperclip, Clock } from "lucide-react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/shared/useErrorHandler";
import { debug } from "@/lib/debug";
import { cn } from "@/lib/utils";
import { fetchAllEmailDrafts } from '@/services/email/emailDraftsQueries';
import { deleteEmailDraft } from '@/services/email/emailDrafts';

interface EmailDraftsProps {
  onDraftSelect: (draft: any) => void;
}

export function EmailDrafts({ onDraftSelect }: EmailDraftsProps) {
  const { handleError } = useErrorHandler();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  
  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['email-drafts'],
    queryFn: async () => {
      try {
        const data = await fetchAllEmailDrafts();
        debug.log('Brouillons chargés:', data?.length);
        return data;
      } catch (error) {
        handleError(error, 'EmailDrafts.queryFn');
        throw error;
      }
    },
  });

  const handleDeleteConfirm = async () => {
    if (!draftToDelete) return;
    
    try {
      await deleteEmailDraft(draftToDelete);
      
      
      toast.success("Brouillon supprimé");
      debug.log('Brouillon supprimé:', draftToDelete);
      refetch();
    } catch (error) {
      handleError(error, 'EmailDrafts.handleDelete');
    } finally {
      setDraftToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = (draftId: string) => {
    setDraftToDelete(draftId);
    setDeleteDialogOpen(true);
  };

  // Filtrer les brouillons par recherche
  const filteredDrafts = drafts?.filter(draft => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (draft.subject?.toLowerCase().includes(query)) ||
      (draft.to_addresses?.toLowerCase().includes(query)) ||
      (draft.body?.toLowerCase().includes(query))
    );
  }) || [];

  // Vérifier si un brouillon est récent (< 24h)
  const isRecent = (date: string) => {
    return differenceInHours(new Date(), new Date(date)) < 24;
  };

  // Vérifier si le brouillon a des pièces jointes
  const hasAttachments = (draft: any) => {
    return draft.attachments && Array.isArray(draft.attachments) && draft.attachments.length > 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={`email-drafts-skeleton-${i}`} className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!drafts || drafts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileEdit className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Aucun brouillon</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Vos brouillons apparaîtront ici. Ils sont automatiquement sauvegardés toutes les 10 secondes.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      {drafts.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les brouillons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Compteur */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredDrafts.length} brouillon{filteredDrafts.length > 1 ? 's' : ''}</span>
        {searchQuery && filteredDrafts.length !== drafts.length && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
            Effacer la recherche
          </Button>
        )}
      </div>

      {/* Liste des brouillons */}
      <div className="space-y-2">
        {filteredDrafts.map((draft: any) => (
          <Card
            key={draft.id}
            className={cn(
              "p-4 hover:bg-accent/50 transition-all cursor-pointer group",
              isRecent(draft.updated_at) && "border-l-4 border-l-primary"
            )}
            onClick={() => onDraftSelect(draft)}
          >
            <div className="flex items-start gap-4">
              {/* Icône / Avatar */}
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>

              {/* Contenu principal */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">
                    {draft.subject || "(Sans objet)"}
                  </h3>
                  {isRecent(draft.updated_at) && (
                    <Badge variant="default" className="text-xs">Récent</Badge>
                  )}
                  {hasAttachments(draft) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Paperclip className="h-3 w-3" />
                          {draft.attachments.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {draft.attachments.length} pièce{draft.attachments.length > 1 ? 's' : ''} jointe{draft.attachments.length > 1 ? 's' : ''}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <p className="text-sm text-muted-foreground truncate">
                  À: {draft.to_addresses || "(Aucun destinataire)"}
                </p>

                {draft.body && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {draft.body.replace(/<[^>]*>/g, '').substring(0, 100)}...
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(draft.updated_at), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                  <span className="hidden sm:inline">
                    • {draft.account?.email_address}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDraftSelect(draft);
                      }} aria-label="Modifier">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(draft.id);
                      }} aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le brouillon sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}