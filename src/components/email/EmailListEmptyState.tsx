import { Mail, RefreshCw, Filter, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmailListEmptyStateProps {
  type: 'no-results' | 'empty-inbox' | 'not-configured';
  onReset?: () => void;
  onSync?: () => void;
  onSettings?: () => void;
}

export function EmailListEmptyState({ type, onReset, onSync, onSettings }: EmailListEmptyStateProps) {
  if (type === 'no-results') {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <Filter className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Aucun résultat trouvé</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Aucun email ne correspond aux filtres appliqués. 
          Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.
        </p>
        {onReset && (
          <Button onClick={onReset} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Réinitialiser les filtres
          </Button>
        )}
      </Card>
    );
  }

  if (type === 'empty-inbox') {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Votre boîte est vide</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Vous n'avez aucun email pour le moment. 
          {onSync ? ' Synchronisez votre compte pour récupérer vos messages.' : ' Les nouveaux messages apparaîtront ici.'}
        </p>
        {onSync && (
          <Button onClick={onSync} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Synchroniser maintenant
          </Button>
        )}
      </Card>
    );
  }

  if (type === 'not-configured') {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Aucun compte configuré</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Vous devez d'abord configurer un compte email pour commencer à recevoir et envoyer des messages.
        </p>
        {onSettings && (
          <Button onClick={onSettings} variant="default">
            <Settings className="h-4 w-4 mr-2" />
            Configurer un compte
          </Button>
        )}
      </Card>
    );
  }

  return null;
}
