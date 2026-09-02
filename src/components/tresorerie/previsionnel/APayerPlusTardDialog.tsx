import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Pencil, CalendarIcon, Trash2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { type Depense, useTresorerieDepenses } from "@/hooks/tresorerie/useTresorerieDepenses";
import { useToast } from "@/hooks/shared/use-toast";

interface APayerPlusTardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depenses: Depense[];
  onEdit: (depense: Depense) => void;
}

export function APayerPlusTardDialog({
  open,
  onOpenChange,
  depenses,
  onEdit,
}: APayerPlusTardDialogProps) {
  const { toast } = useToast();
  const { updateDepense, deleteDepense, isUpdating, isDeleting } = useTresorerieDepenses();

  // État pour suppression
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // État pour réactivation
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [reactivateDate, setReactivateDate] = useState<Date | undefined>(undefined);

  const handleReactivate = (depenseId: string) => {
    if (!reactivateDate) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une date",
        variant: "destructive",
      });
      return;
    }

    updateDepense({
      id: depenseId,
      updates: {
        date_prevue: format(reactivateDate, "yyyy-MM-dd"),
        statut: "en_attente",
      },
    });
    
    toast({
      title: "Dépense réactivée",
      description: `Prévue pour le ${format(reactivateDate, "dd MMMM yyyy", { locale: fr })}`,
    });
    setReactivateId(null);
    setReactivateDate(undefined);
  };

  const handleDelete = (depenseId: string) => {
    deleteDepense(depenseId);
    setDeleteConfirmId(null);
  };

  const isLoading = isUpdating || isDeleting;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              À payer plus tard
              <Badge variant="secondary" className="ml-2">
                {depenses.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {depenses.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Aucune dépense en attente
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Les dépenses suspendues apparaîtront ici.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {depenses.map((depense) => (
                  <div
                    key={depense.id}
                    className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{depense.nom}</p>
                        {depense.categorie_code && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {depense.categorie_code}
                          </Badge>
                        )}
                      </div>
                      <span className="text-destructive font-semibold whitespace-nowrap">
                        {formatCurrency(depense.montant)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(depense)}
                        disabled={isLoading}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Modifier
                      </Button>

                      <Popover
                        open={reactivateId === depense.id}
                        onOpenChange={(openState) => {
                          if (openState) {
                            setReactivateId(depense.id);
                            setReactivateDate(undefined);
                          } else {
                            setReactivateId(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                          >
                            <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                            Réactiver
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-3 border-b">
                            <p className="text-sm font-medium">Réactiver cette dépense</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Choisissez la date prévue
                            </p>
                          </div>
                          <Calendar
                            mode="single"
                            selected={reactivateDate}
                            onSelect={setReactivateDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                            locale={fr}
                          />
                          <div className="flex justify-end gap-2 p-3 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReactivateId(null)}
                            >
                              Annuler
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReactivate(depense.id)}
                              disabled={!reactivateDate || isUpdating}
                            >
                              {isUpdating && (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              )}
                              Confirmer
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirmId(depense.id)}
                        disabled={isLoading}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(openState) => !openState && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La dépense sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
