import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
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
  useEmailDomainMappings,
  useAddDomainMapping,
  useRemoveDomainMapping,
} from "@/hooks/email/useEmailDomainMappings";
import { Ban, Plus, Trash2, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { debug } from "@/lib/debug";

export function ExcludedDomainsManager() {
  const [newDomain, setNewDomain] = useState("");
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  const { data: mappings, isLoading } = useEmailDomainMappings({ includeExcluded: true });
  const addMapping = useAddDomainMapping();
  const removeMapping = useRemoveDomainMapping();

  // Filtrer uniquement les domaines exclus
  const excludedDomains = mappings?.filter(m => m.is_excluded) || [];

  const handleAddExcludedDomain = () => {
    if (!newDomain.trim()) return;
    
    // Validation basique du domaine
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      return;
    }

    addMapping.mutate({
      domain: newDomain,
      isExcluded: true,
    }, {
      onSuccess: () => {
        setNewDomain("");
      }
    });
  };

  const handleRemoveDomain = (mappingId: string) => {
    removeMapping.mutate(mappingId, {
      onSuccess: () => {
        setDomainToDelete(null);
      }
    });
  };

  const handleSuggestCommonDomains = async () => {
    const commonDomains = [
      'noreply.gmail.com',
      'no-reply.linkedin.com',
      'facebookmail.com',
      'sendgrid.net',
      'mailchimp.com',
      'mailgun.org',
      'amazonses.com',
      'notifications.google.com',
      'notifications.microsoft.com',
      'bounce.microsoft.com',
      'mailer-daemon.com',
    ];

    for (const domain of commonDomains) {
      try {
        await addMapping.mutateAsync({ domain, isExcluded: true });
      } catch (error) {
        // Ignorer si le domaine existe déjà
        debug.log(`Domain ${domain} already excluded`);
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle>Domaines Hors Établissements</CardTitle>
                <CardDescription>
                  Les emails provenant de ces domaines seront masqués de votre boîte de réception
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSuggestCommonDomains}
              disabled={addMapping.isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Suggérer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {excludedDomains.length > 0 ? (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {excludedDomains.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Ban className="h-4 w-4 text-destructive" />
                      <div className="flex flex-col">
                        <span className="font-medium">{mapping.domain}</span>
                        <span className="text-xs text-muted-foreground">
                          Ajouté le {new Date(mapping.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDomainToDelete(mapping.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun domaine exclu pour le moment</p>
              <p className="text-sm mt-1">
                Ajoutez des domaines pour masquer les emails non pertinents
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <Label htmlFor="excluded-domain" className="text-sm font-medium mb-2 block">
              Ajouter un domaine à exclure
            </Label>
            <div className="flex gap-2">
              <Input
                id="excluded-domain"
                placeholder="exemple-newsletter.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddExcludedDomain();
                  }
                }}
              />
              <Button
                onClick={handleAddExcludedDomain}
                disabled={!newDomain.trim() || addMapping.isPending}
                variant="destructive"
              >
                {addMapping.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Exclure
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Exemples : newsletters, notifications automatiques, services marketing, etc.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!domainToDelete} onOpenChange={() => setDomainToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Les emails de ce domaine redeviendront visibles dans votre boîte de réception.
              Cette action peut être annulée en réajoutant le domaine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => domainToDelete && handleRemoveDomain(domainToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
