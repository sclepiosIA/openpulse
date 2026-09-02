import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAddDomainMapping } from "@/hooks/email/useEmailDomainMappings";
import { AlertCircle, Plus, Loader2, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

interface UnmappedDomain {
  domain: string;
  thread_count: number;
  sample_emails: string[];
}

const GENERIC_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.fr', 'yahoo.com',
  'orange.fr', 'free.fr', 'laposte.net', 'wanadoo.fr', 'sfr.fr',
  'bbox.fr', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'hotmail.fr', 'live.fr'
];

const INTERNAL_MARQUE_DOMAINS = ['marque.ai', 'exploitant.example.org'];

export function UnmappedDomainsManager() {
  const [domains, setDomains] = useState<UnmappedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [mappingType, setMappingType] = useState<"etablissement" | "partenaire" | "exclude">("exclude");
  const [etablissements, setEtablissements] = useState<any[]>([]);
  const [partenaires, setPartenaires] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("high");
  const [reclassifying, setReclassifying] = useState(false);
  const [lastAddedDomain, setLastAddedDomain] = useState<string | null>(null);
  
  const addMapping = useAddDomainMapping();

  useEffect(() => {
    loadUnmappedDomains();
    loadEntities();
  }, []);

  const loadUnmappedDomains = async () => {
    setLoading(true);
    try {
      // Récupérer les domaines des threads non classés
      const { data: threads, error } = await supabase
        .from('email_threads')
        .select('participants')
        .is('etablissement_id', null)
        .is('partenaire_id', null)
        .is('groupe_id', null)
        .eq('is_hors_etablissement', false)
        .eq('is_deleted', false)
        .or('category.is.null,category.neq.Interne OpenPulse');

      if (error) throw error;

      // Extraire et compter les domaines
      const domainMap = new Map<string, { count: number; emails: Set<string> }>();
      
      threads?.forEach(thread => {
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        participants.forEach((p: any) => {
          if (p?.email) {
            const email = p.email.toLowerCase();
            const domain = email.split('@')[1];
            if (domain && !GENERIC_DOMAINS.includes(domain) && !INTERNAL_MARQUE_DOMAINS.includes(domain)) {
              const existing = domainMap.get(domain) || { count: 0, emails: new Set() };
              existing.count++;
              existing.emails.add(email);
              domainMap.set(domain, existing);
            }
          }
        });
      });

      // Convertir en array et trier par count
      const domainsArray: UnmappedDomain[] = Array.from(domainMap.entries())
        .map(([domain, data]) => ({
          domain,
          thread_count: data.count,
          sample_emails: Array.from(data.emails).slice(0, 3)
        }))
        .sort((a, b) => b.thread_count - a.thread_count);

      setDomains(domainsArray);
    } catch (error) {
      debug.error('Error loading unmapped domains:', error);
      toast.error('Erreur lors du chargement des domaines');
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    const { data: etabs } = await supabase
      .from('etablissements')
      .select('id, nom')
      .order('nom');
    
    const { data: parts } = await supabase
      .from('partenaires')
      .select('id, nom')
      .order('nom');
    
    setEtablissements(etabs || []);
    setPartenaires(parts || []);
  };

  const handleAddMapping = async () => {
    if (!selectedDomain) return;

    try {
      if (mappingType === "exclude") {
        await addMapping.mutateAsync({
          domain: selectedDomain,
          isExcluded: true,
          confidenceLevel: confidence
        });
        toast.success(`Domaine ${selectedDomain} exclu`);
      } else {
        if (!selectedEntityId) {
          toast.error("Veuillez sélectionner une entité");
          return;
        }

        await addMapping.mutateAsync({
          domain: selectedDomain,
          etablissementId: mappingType === "etablissement" ? selectedEntityId : undefined,
          partenaireId: mappingType === "partenaire" ? selectedEntityId : undefined,
          confidenceLevel: confidence
        });
        toast.success(`Mapping créé pour ${selectedDomain}`);
        setLastAddedDomain(selectedDomain);
      }
      
      setSelectedDomain(null);
      setSelectedEntityId("");
      await loadUnmappedDomains();
    } catch (error) {
      debug.error('Error adding mapping:', error);
      toast.error('Erreur lors de la création du mapping');
    }
  };

  const handleReclassifyDomain = async () => {
    if (!lastAddedDomain) return;

    setReclassifying(true);
    try {
      const data = await invokeEdge<any>('auto-match-emails', { 
          processAll: false,
          batchSize: 1000,
          onlyDomains: [lastAddedDomain]
        });
    const error = null;

      if (error) throw error;

      toast.success(`${data.matched || 0} threads reclassés pour ${lastAddedDomain}`);
      setLastAddedDomain(null);
      loadUnmappedDomains();
    } catch (error) {
      debug.error('Error reclassifying domain:', error);
      toast.error('Erreur lors de la reclassification');
    } finally {
      setReclassifying(false);
    }
  };

  const filteredDomains = domains.filter(d => 
    d.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement des domaines...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Domaines Non Mappés</h3>
          <Badge variant="secondary">{domains.length} domaines</Badge>
        </div>
        <Button onClick={loadUnmappedDomains} size="sm" variant="outline">
          <Loader2 className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {domains.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Aucun domaine non mappé trouvé</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un domaine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Domains List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4">
              {filteredDomains.map((domain) => (
                <div
                  key={domain.domain}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDomain === domain.domain
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedDomain(domain.domain)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        <Badge variant="secondary">{domain.thread_count} threads</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Exemples: {domain.sample_emails.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Mapping Form */}
          {selectedDomain && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium">Créer un mapping pour: {selectedDomain}</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <Select value={mappingType} onValueChange={(v: any) => setMappingType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etablissement">Établissement</SelectItem>
                    <SelectItem value="partenaire">Partenaire</SelectItem>
                    <SelectItem value="exclude">Exclure (spam/générique)</SelectItem>
                  </SelectContent>
                </Select>

                {mappingType !== "exclude" && (
                  <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Sélectionner ${mappingType}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(mappingType === "etablissement" ? etablissements : partenaires).map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {mappingType !== "exclude" && (
                  <Select value={confidence} onValueChange={(v: any) => setConfidence(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Confiance Élevée</SelectItem>
                      <SelectItem value="medium">Confiance Moyenne</SelectItem>
                      <SelectItem value="low">Confiance Faible</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleAddMapping}
                  disabled={mappingType !== "exclude" && !selectedEntityId}
                  className="flex-1"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Créer le mapping
                </Button>
                <Button 
                  onClick={() => setSelectedDomain(null)}
                  variant="outline"
                >
                  Annuler
                </Button>
              </div>

              {lastAddedDomain && (
                <Button 
                  onClick={handleReclassifyDomain}
                  disabled={reclassifying}
                  variant="secondary"
                  className="w-full"
                >
                  {reclassifying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Reclasser les threads de {lastAddedDomain}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
