import { useState } from "react";
import { debug } from "@/lib/debug";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  useUpdateDomainMapping,
} from "@/hooks/email/useEmailDomainMappings";
import { useContacts } from "@/hooks/crm/useContacts";
import { Mail, Plus, Trash2, CheckCircle, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EmailDomainManagerProps {
  etablissementId: string;
}

export function EmailDomainManager({ etablissementId }: EmailDomainManagerProps) {
  const [newDomain, setNewDomain] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: mappings, isLoading } = useEmailDomainMappings({ etablissementId });
  const { data: allMappingsInclExcluded } = useEmailDomainMappings({ etablissementId, includeExcluded: true });
  const { contacts } = useContacts(etablissementId);
  const addMapping = useAddDomainMapping();
  const removeMapping = useRemoveDomainMapping();
  const updateMapping = useUpdateDomainMapping();

  // Fonction pour extraire les domaines professionnels depuis les contacts
  const extractProfessionalDomains = (contactsList: any[]): string[] => {
    const freeEmailProviders = [
      'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 
      'yahoo.fr', 'laposte.net', 'free.fr', 'orange.fr', 'wanadoo.fr',
      'sfr.fr', 'live.com', 'icloud.com', 'msn.com', 'aol.com',
      'gmx.com', 'yandex.com', 'mail.com', 'protonmail.com'
    ];
    
    const domains = new Set<string>();
    
    if (!contactsList) return [];
    
    contactsList.forEach(contact => {
      if (contact.email) {
        const emailParts = contact.email.toLowerCase().trim().split('@');
        if (emailParts.length === 2) {
          const domain = emailParts[1].trim();
          // Ne garder que les domaines professionnels (pas gratuits)
          if (!freeEmailProviders.includes(domain) && domain.length > 0) {
            domains.add(domain);
          }
        }
      }
    });
    
    return Array.from(domains);
  };

  // Détection des domaines depuis les contacts (SANS ajout automatique)
  const detectedDomains = contacts ? extractProfessionalDomains(contacts) : [];
  
  // Filtrer les domaines déjà configurés (actifs ou exclus)
  const suggestedDomains = detectedDomains.filter(domain => {
    const exists = allMappingsInclExcluded?.some(m => m.domain === domain);
    return !exists;
  });

  // Identifier les domaines exclus qui pourraient être réactivés
  const excludedDomains = allMappingsInclExcluded?.filter(m => 
    m.is_excluded && detectedDomains.includes(m.domain)
  ) || [];

  const handleAddSuggestedDomain = async (domain: string) => {
    try {
      await addMapping.mutateAsync({
        etablissementId,
        domain,
        confidenceLevel: 'medium',
      });
    } catch (error: unknown) {
      debug.error("Erreur lors de l'ajout du domaine:", domain, error);
    }
  };

  const handleReactivateDomain = async (mappingId: string, domain: string) => {
    try {
      await addMapping.mutateAsync({
        etablissementId,
        domain,
        confidenceLevel: 'high',
        reactivate: true,
      });
    } catch (error: unknown) {
      debug.error("Erreur lors de la réactivation du domaine:", error);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;

    // Validation basique du format de domaine
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      return;
    }

    await addMapping.mutateAsync({
      etablissementId,
      domain: newDomain.trim(),
      confidenceLevel,
    });

    setNewDomain("");
    setConfidenceLevel('high');
  };

  const handleRemoveDomain = async () => {
    if (!domainToDelete) return;
    await removeMapping.mutateAsync(domainToDelete);
    setDomainToDelete(null);
  };

  const toggleVerified = async (mappingId: string, currentVerified: boolean) => {
    await updateMapping.mutateAsync({
      mappingId,
      verified: !currentVerified,
    });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`${mappings && mappings.length > 0 ? 'p-3' : 'p-6'}`}>
        <div className="space-y-4">
          {/* Version normale quand aucun domaine configuré */}
          {(!mappings || mappings.length === 0) && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <h3 className="font-semibold">Domaines email associés</h3>
                </div>
                <Badge variant="secondary">{mappings?.length || 0} domaine(s)</Badge>
              </div>

              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun domaine associé. Ajoutez-en un ci-dessous.
              </p>

              <div className="space-y-3 pt-4 border-t">
                <Label>Ajouter un domaine</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="exemple.fr"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                    className="font-mono"
                  />
                  <Select
                    value={confidenceLevel}
                    onValueChange={(value: 'high' | 'medium' | 'low') =>
                      setConfidenceLevel(value)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddDomain}
                    disabled={!newDomain.trim() || addMapping.isPending}
                  >
                    {addMapping.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les emails provenant de ce domaine seront automatiquement associés à cet établissement
                </p>
              </div>
            </>
          )}

          {/* Version réduite quand domaines configurés */}
          {mappings && mappings.length > 0 && (
            <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded transition-colors">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-muted-foreground">
                    {mappings.length} domaine(s) email configuré(s)
                  </span>
                </div>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pt-3">
                <div className="space-y-3">
                  {/* Domaines configurés actifs */}
                  <div className="space-y-2">
                    {mappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{mapping.domain}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {mapping.confidence_level}
                          </Badge>
                          {mapping.verified ? (
                            <Tooltip><TooltipTrigger asChild><CheckCircle className="h-3 w-3 text-green-500" /></TooltipTrigger><TooltipContent>Domaine vérifié</TooltipContent></Tooltip>
                          ) : (
                            <Tooltip><TooltipTrigger asChild><AlertCircle className="h-3 w-3 text-yellow-500" /></TooltipTrigger><TooltipContent>Domaine non vérifié — cliquez pour vérifier</TooltipContent></Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => toggleVerified(mapping.id, mapping.verified)}
                          >
                            {mapping.verified ? 'Non vérifié' : 'Vérifier'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => setDomainToDelete(mapping.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Domaines exclus détectés dans les contacts */}
                  {excludedDomains.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Domaines exclus (détectés)</p>
                      {excludedDomains.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex items-center justify-between p-2 bg-destructive/5 rounded text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground line-through">{mapping.domain}</span>
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              Exclu
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleReactivateDomain(mapping.id, mapping.domain)}
                            disabled={addMapping.isPending}
                          >
                            Réactiver
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions de nouveaux domaines */}
                  {suggestedDomains.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Domaines détectés (contacts)</p>
                      {suggestedDomains.map((domain) => (
                        <div
                          key={domain}
                          className="flex items-center justify-between p-2 bg-primary/5 rounded text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{domain}</span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              Suggéré
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleAddSuggestedDomain(domain)}
                            disabled={addMapping.isPending}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Ajouter
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </Card>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!domainToDelete} onOpenChange={() => setDomainToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce domaine ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les emails futurs de ce domaine ne seront plus automatiquement associés à cet
              établissement. Les emails existants ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDomain}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}