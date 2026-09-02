import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnclassifiedDomains } from "@/hooks/email/useUnclassifiedDomains";
import { useAddDomainMapping } from "@/hooks/email/useEmailDomainMappings";
import { DomainMultiAssociationDialog } from "./DomainMultiAssociationDialog";
import { DomainGroupeAssociationDialog } from "./DomainGroupeAssociationDialog";
import { DomainPartenaireAssociationDialog } from "./DomainPartenaireAssociationDialog";
import { EtablissementCreateForm } from '@/components/etablissement/EtablissementCreateForm';
import { PartenaireCreateForm } from '@/components/partenaire/PartenaireCreateForm';
import { EmailSpecificMappingDialog } from "./EmailSpecificMappingDialog";
import { Loader2, Mail, Ban, Link as LinkIcon, ChevronRight, Building2, AtSign, Handshake, Info } from "lucide-react";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { supabase } from "@/integrations/supabase/client";

export function DomainClassificationPanel() {
  const { data: domains, isLoading } = useUnclassifiedDomains();
  const addMapping = useAddDomainMapping();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [associationDialog, setAssociationDialog] = useState<{
    open: boolean;
    domain: string;
  }>({ open: false, domain: "" });
  const [groupeDialog, setGroupeDialog] = useState<{
    open: boolean;
    domain: string;
  }>({ open: false, domain: "" });
  const [processingDomain, setProcessingDomain] = useState<string | null>(null);
  const [createEtablissementDialog, setCreateEtablissementDialog] = useState<{
    open: boolean;
    domain: string;
  }>({ open: false, domain: "" });
  const [partenaireDialog, setPartenaireDialog] = useState<{
    open: boolean;
    domain: string;
  }>({ open: false, domain: "" });
  const [createPartenaireDialog, setCreatePartenaireDialog] = useState<{
    open: boolean;
    domain: string;
  }>({ open: false, domain: "" });
  const [emailMappingDialog, setEmailMappingDialog] = useState(false);
  
  const isProcessing = processingDomain !== null;

  const handleExclude = async (domain: string) => {
    setProcessingDomain(domain);
    try {
      await addMapping.mutateAsync({
        domain,
        isExcluded: true,
      });
    } finally {
      setProcessingDomain(null);
    }
  };

  const handleIgnore = async (domain: string) => {
    setProcessingDomain(domain);
    try {
      await addMapping.mutateAsync({
        domain,
        preventAuto: true,
      });
    } finally {
      setProcessingDomain(null);
    }
  };

  const handleAssociate = (domain: string) => {
    setAssociationDialog({ open: true, domain });
  };

  const handleAssociateToGroupe = (domain: string) => {
    setGroupeDialog({ open: true, domain });
  };

  const handleAssociateToPartenaire = (domain: string) => {
    setPartenaireDialog({ open: true, domain });
  };

  const handleConfirmAssociation = async (
    etablissementIds: string[],
    confidenceLevel: 'high' | 'medium' | 'low'
  ) => {
    setProcessingDomain(associationDialog.domain);
    
    try {
      // Créer toutes les associations en batch
      const mappings = etablissementIds.map(etablissementId => ({
        etablissement_id: etablissementId,
        domain: associationDialog.domain.toLowerCase().trim(),
        niveau_mapping: 'etablissement',
        confidence_level: confidenceLevel,
        verified: true,
        is_excluded: false,
      }));

      const { error } = await supabase
        .from('email_domain_mappings')
        .insert(mappings);

      if (error) throw error;

      // Lier les threads au premier établissement sélectionné
      const { error: threadsError } = await supabase
        .from('email_threads')
        .update({ etablissement_id: etablissementIds[0] })
        .is('etablissement_id', null)
        .in('id', domains?.find(d => d.domain === associationDialog.domain)?.exampleThreads.map(t => t.id) || []);

      if (threadsError) throw threadsError;

      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });

      toast({
        title: "Domaine associé",
        description: `Le domaine ${associationDialog.domain} a été associé à ${etablissementIds.length} établissement${etablissementIds.length > 1 ? 's' : ''}`,
      });

      setAssociationDialog({ open: false, domain: "" });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setProcessingDomain(null);
    }
  };

  const handleConfirmGroupeAssociation = async (
    groupeId: string,
    confidenceLevel: 'high' | 'medium' | 'low'
  ) => {
    setProcessingDomain(groupeDialog.domain);
    
    try {
      await addMapping.mutateAsync({
        groupeId,
        domain: groupeDialog.domain,
        confidenceLevel,
      });

      queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      
      toast({
        title: "Domaine associé au groupe",
        description: "Les futurs emails de ce domaine seront automatiquement liés au groupe",
      });

      setGroupeDialog({ open: false, domain: "" });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setProcessingDomain(null);
    }
  };

  const handleConfirmPartenaireAssociation = async (
    partenaireId: string,
    confidenceLevel: 'high' | 'medium' | 'low'
  ) => {
    setProcessingDomain(partenaireDialog.domain);
    
    try {
      await addMapping.mutateAsync({
        partenaireId,
        domain: partenaireDialog.domain,
        confidenceLevel,
      });

      queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      
      toast({
        title: "Domaine associé au partenaire",
        description: "Les futurs emails de ce domaine seront automatiquement liés au partenaire",
      });

      setPartenaireDialog({ open: false, domain: "" });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setProcessingDomain(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Aucun domaine à classifier</p>
          <p className="text-sm text-muted-foreground mt-2">
            Tous vos emails sont déjà classifiés ou exclus
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Classification par domaines</h3>
            <p className="text-sm text-muted-foreground">
              {domains.length} domaine{domains.length > 1 ? 's' : ''} à classifier ({domains.reduce((sum, d) => sum + d.emailCount, 0)} emails)
            </p>
          </div>
          <Button onClick={() => setEmailMappingDialog(true)} variant="outline" size="sm">
            <AtSign className="mr-2 h-4 w-4" />
            Affilier un email spécifique
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Classification par domaine d'organisation</AlertTitle>
          <AlertDescription>
            Cette section affiche uniquement les domaines d'organisations (entreprises, hôpitaux, institutions, etc.). 
            Les emails provenant de domaines publics (Gmail, Hotmail, Outlook, etc.) doivent être affiliés 
            individuellement via le bouton ci-dessus ou dans la section dédiée ci-dessous.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-3 pr-4">
            {domains.map((domain) => {
              const isProcessing = processingDomain === domain.domain;
              
              return (
                <Card key={domain.domain} className={isProcessing ? "opacity-50" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-mono">{domain.domain}</CardTitle>
                      <Badge variant="secondary">
                        {domain.emailCount} email{domain.emailCount > 1 ? 's' : ''} • {domain.threadCount} conversation{domain.threadCount > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-3">
                    <CardDescription className="text-sm">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Exemples de sujets :</p>
                        {domain.exampleThreads.slice(0, 3).map((thread, idx) => (
                          <div key={thread.id} className="flex items-start gap-2">
                            <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{sanitizeEmailSubject(thread.subject)}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                De : {thread.from_address}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardDescription>
                  </CardContent>
                  
                  <CardFooter className="gap-2 flex-wrap">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setCreateEtablissementDialog({ open: true, domain: domain.domain })}
                      disabled={isProcessing}
                    >
                      <Building2 className="mr-2 h-3 w-3" />
                      Créer établissement
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAssociate(domain.domain)}
                      disabled={isProcessing}
                    >
                      <LinkIcon className="mr-2 h-3 w-3" />
                      Associer à établissement
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAssociateToGroupe(domain.domain)}
                      disabled={isProcessing}
                    >
                      <Building2 className="mr-2 h-3 w-3" />
                      Associer à groupe
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAssociateToPartenaire(domain.domain)}
                      disabled={isProcessing}
                    >
                      <Handshake className="mr-2 h-3 w-3" />
                      Associer à partenaire
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreatePartenaireDialog({ open: true, domain: domain.domain })}
                      disabled={isProcessing}
                    >
                      <Handshake className="mr-2 h-3 w-3" />
                      Créer partenaire
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleExclude(domain.domain)}
                      disabled={isProcessing}
                    >
                      {isProcessing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      <Ban className="mr-2 h-3 w-3" />
                      Hors établissement
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleIgnore(domain.domain)}
                    >
                      Ignorer
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <DomainMultiAssociationDialog
        open={associationDialog.open}
        onOpenChange={(open) => setAssociationDialog({ open, domain: "" })}
        domain={associationDialog.domain}
        onConfirm={handleConfirmAssociation}
        isLoading={processingDomain !== null}
      />

      <DomainGroupeAssociationDialog
        open={groupeDialog.open}
        onOpenChange={(open) => setGroupeDialog({ open, domain: "" })}
        domain={groupeDialog.domain}
        onConfirm={handleConfirmGroupeAssociation}
        isLoading={processingDomain !== null}
      />

      <EtablissementCreateForm
        open={createEtablissementDialog.open}
        onOpenChange={(open) => setCreateEtablissementDialog({ open, domain: "" })}
        initialDomain={createEtablissementDialog.domain}
      />

      <DomainPartenaireAssociationDialog
        open={partenaireDialog.open}
        onOpenChange={(open) => setPartenaireDialog({ open, domain: "" })}
        domain={partenaireDialog.domain}
        onConfirm={handleConfirmPartenaireAssociation}
        isLoading={processingDomain !== null}
      />

      <PartenaireCreateForm
        open={createPartenaireDialog.open}
        onOpenChange={(open) => setCreatePartenaireDialog({ open, domain: "" })}
        initialDomain={createPartenaireDialog.domain}
      />

      <EmailSpecificMappingDialog
        open={emailMappingDialog}
        onOpenChange={setEmailMappingDialog}
      />
    </>
  );
}
