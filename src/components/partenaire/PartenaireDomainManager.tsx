import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";
import { invokeEdge } from "@/services/edgeFunctions";
import {
  useEmailDomainMappings,
  useAddDomainMapping,
  useRemoveDomainMapping,
} from "@/hooks/email/useEmailDomainMappings";
import { Globe, Plus, Trash2, Loader2, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

interface PartenaireDomainManagerProps {
  partenaireId: string;
  officialDomains?: string[];
}

export function PartenaireDomainManager({ 
  partenaireId, 
  officialDomains = [] 
}: PartenaireDomainManagerProps) {
  const [newDomain, setNewDomain] = useState("");
  const [isReclassifying, setIsReclassifying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useEmailDomainMappings({ partenaireId });
  const addMapping = useAddDomainMapping();
  const removeMapping = useRemoveDomainMapping();

  const validateDomain = (domain: string): boolean => {
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
    return domainRegex.test(domain.toLowerCase().trim());
  };

  const handleAddDomain = async () => {
    const domain = newDomain.toLowerCase().trim();
    
    if (!domain) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un domaine",
        variant: "destructive",
      });
      return;
    }

    if (!validateDomain(domain)) {
      toast({
        title: "Erreur",
        description: "Format de domaine invalide (ex: example.com)",
        variant: "destructive",
      });
      return;
    }

    // Vérifier les doublons
    const existingMapping = mappings.find(m => m.domain === domain);
    if (existingMapping || officialDomains.includes(domain)) {
      toast({
        title: "Erreur",
        description: "Ce domaine est déjà associé",
        variant: "destructive",
      });
      return;
    }

    await addMapping.mutateAsync({
      partenaireId,
      domain,
      confidenceLevel: 'high',
    });

    setNewDomain("");
  };

  const handleRemoveDomain = async (mappingId: string) => {
    await removeMapping.mutateAsync(mappingId);
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      await invokeEdge('auto-match-emails', { limit: 100 });
      // Rafraîchir les données
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['emails-by-partenaire', partenaireId] }),
        queryClient.invalidateQueries({ queryKey: ['email-threads'] }),
      ]);

      toast({
        title: "Reclassification terminée",
        description: "Les emails ont été reclassés selon les domaines",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setIsReclassifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Domaines officiels */}
      {officialDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Domaines email officiels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {officialDomains.map((domain) => (
                <Badge key={`official-${domain}`} variant="secondary" className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {domain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domaines mappés */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Domaines mappés pour classification
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReclassify}
              disabled={isReclassifying}
              aria-label="Reclasser les emails par domaine"
            >
              {isReclassifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Reclasser les emails</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ajout d'un domaine */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="exemple.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              aria-label="Nouveau domaine à ajouter"
              className="flex-1"
            />
            <Button
              onClick={handleAddDomain}
              disabled={addMapping.isPending}
              size="sm"
            >
              {addMapping.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Ajouter</span>
            </Button>
          </div>

          {/* Liste des mappings */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : mappings.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun domaine mappé. Ajoutez des domaines pour classifier automatiquement les emails.
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline">{mapping.domain}</Badge>
                    {mapping.verified ? (
                      <Badge variant="secondary" className="text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Vérifié
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Non vérifié
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {mapping.confidence_level}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDomain(mapping.id)}
                    disabled={removeMapping.isPending}
                    aria-label={`Supprimer le domaine ${mapping.domain}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
