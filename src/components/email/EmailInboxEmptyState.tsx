import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";

interface EmailInboxEmptyStateProps {
  onCompose: () => void;
  onSync: () => void;
  isFiltered?: boolean;
}

export function EmailInboxEmptyState({ 
  onCompose, 
  onSync,
  isFiltered = false 
}: EmailInboxEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-6">
        <Mail className="h-20 w-20 text-muted-foreground/40 animate-pulse" />
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary/10 animate-ping" />
      </div>
      
      {isFiltered ? (
        <>
          <h3 className="text-xl font-semibold mb-2">Aucun email trouvé</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Aucun email ne correspond aux filtres sélectionnés. Essayez de modifier vos critères de recherche.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold mb-2">Votre boîte de réception est vide</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Les nouveaux emails apparaîtront ici. Commencez par envoyer un message ou synchronisez vos emails.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onCompose} size="lg">
              <Mail className="mr-2 h-5 w-5" />
              Envoyer un email
            </Button>
            <Button onClick={onSync} variant="outline" size="lg">
              <RefreshCw className="mr-2 h-5 w-5" />
              Synchroniser maintenant
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
