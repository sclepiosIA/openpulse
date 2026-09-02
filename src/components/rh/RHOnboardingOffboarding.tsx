import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import { usePeopleData } from "@/hooks/hr/usePeopleData";
import { useOnboardingByProfile, useUpsertOnboarding, type DossierRH, type Materiel } from "@/hooks/tasks/useOnboardingOffboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UserCheck, Save } from "lucide-react";
import { OnboardingStatusCard } from "./onboarding/OnboardingStatusCard";
import { DossierRHChecklist } from "./onboarding/DossierRHChecklist";
import { ComptesAccesChecklist } from "./onboarding/ComptesAccesChecklist";
import { MaterielList } from "./onboarding/MaterielList";
import { toast } from "sonner";

export function RHOnboardingOffboarding() {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const { profiles } = usePeopleData();
  const { data: onboardingData, isLoading } = useOnboardingByProfile(selectedProfileId || null);
  const upsertOnboarding = useUpsertOnboarding();

  const [formData, setFormData] = useState<{
    date_entree: string | null;
    date_sortie: string | null;
    statut: 'en_cours' | 'actif' | 'sortie_prevue' | 'sorti';
    motif_sortie: string | null;
    dossier_rh: DossierRH;
    comptes_acces: Record<string, boolean>;
    materiel: Materiel;
  }>({
    date_entree: null,
    date_sortie: null,
    statut: 'en_cours',
    motif_sortie: null,
    dossier_rh: {} as DossierRH,
    comptes_acces: {} as Record<string, boolean>,
    materiel: {} as Materiel,
  });

  // Mettre à jour formData quand onboardingData change
  useMemo(() => {
    if (onboardingData) {
      setFormData({
        date_entree: onboardingData.date_entree || '',
        date_sortie: onboardingData.date_sortie || '',
        statut: onboardingData.statut,
        motif_sortie: onboardingData.motif_sortie || '',
        dossier_rh: onboardingData.dossier_rh,
        comptes_acces: onboardingData.comptes_acces,
        materiel: onboardingData.materiel,
      });
    } else if (selectedProfileId) {
      // Initialiser avec valeurs par défaut
      setFormData({
        date_entree: null,
        date_sortie: null,
        statut: 'en_cours',
        motif_sortie: null,
        dossier_rh: {
          cv: { status: null, ref: null, date: null },
          contrat: { status: null, ref: null, type: null, date: null },
          mutuelle: { status: null, ref: null, organisme: null, date: null },
          charte: { status: null, date: null },
          solde_tout_compte: { status: null, date: null },
        },
        comptes_acces: {
          mail: false,
          vpn: false,
          bookstack: false,
          passbolt: false,
          espocrm: false,
          google_workspace: false,
          penpot: false,
          nextcloud: false,
          gitea: false,
          kimai: false,
          calcom: false,
          ssh: false,
          azure: false,
          ovh: false,
          openai: false,
          reseaux_sociaux: false,
          ausha: false,
          brevo: false,
        },
        materiel: {
          pc_mac: { assigne: false, numero_serie: null, modele: null },
          laptop: { assigne: false, numero_serie: null, modele: null },
          smartphone: { assigne: false, numero_serie: null, modele: null, numero: null },
          licences: [],
        },
      });
    }
  }, [onboardingData, selectedProfileId]);

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);
  const profileName = selectedProfile ? `${selectedProfile.prenom} ${selectedProfile.nom}` : '';

  // Calculer le taux de complétion
  const completionRate = useMemo(() => {
    if (!selectedProfileId) return 0;
    
    let completed = 0;
    let total = 0;

    // Dates (2 points)
    total += 2;
    if (formData.date_entree) completed += 1;
    if (formData.statut === 'actif') completed += 1; // Si actif, pas besoin de date sortie

    // Dossier RH (5 points)
    total += 5;
    Object.values(formData.dossier_rh || {}).forEach((item: any) => {
      if (item?.status === true) completed += 1;
    });

    // Comptes (18 points)
    total += 18;
    Object.values(formData.comptes_acces || {}).forEach((value) => {
      if (value === true) completed += 1;
    });

    // Matériel (3 points)
    total += 3;
    if (formData.materiel?.pc_mac?.assigne) completed += 1;
    if (formData.materiel?.laptop?.assigne) completed += 1;
    if (formData.materiel?.smartphone?.assigne) completed += 1;

    return Math.round((completed / total) * 100);
  }, [formData, selectedProfileId]);

  const handleSave = async () => {
    if (!selectedProfileId) {
      toast.error('Veuillez sélectionner un collaborateur');
      return;
    }

    try {
      // Nettoyer les données avant l'envoi : convertir les chaînes vides en null
      const cleanedData = {
        profile_id: selectedProfileId,
        date_entree: formData.date_entree || null,
        date_sortie: formData.date_sortie || null,
        statut: formData.statut,
        motif_sortie: formData.motif_sortie || null,
        dossier_rh: formData.dossier_rh,
        comptes_acces: formData.comptes_acces,
        materiel: formData.materiel,
      };
      
      await upsertOnboarding.mutateAsync(cleanedData);
    } catch (error) {
      debug.error('Error saving onboarding:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <UserCheck className="h-6 w-6" />
            Entrées / Sorties de collaborateurs
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les processus d'onboarding et d'offboarding
          </p>
        </div>
        
        {selectedProfileId && (
          <Button onClick={handleSave} disabled={upsertOnboarding.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        )}
      </div>

      {/* Sélecteur de collaborateur */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Collaborateur</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un collaborateur" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile: any) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.prenom} {profile.nom} {profile.fonction && `(${profile.fonction})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProfileId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="date_entree">Date d'entrée</Label>
                  <Input
                    id="date_entree"
                    type="date"
                    value={formData.date_entree ?? ''}
                    onChange={(e) => setFormData({ ...formData, date_entree: e.target.value || null })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={formData.statut}
                    onValueChange={(value) => setFormData({ ...formData, statut: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="sortie_prevue">Sortie prévue</SelectItem>
                      <SelectItem value="sorti">Sorti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {selectedProfileId && (formData.statut === 'sortie_prevue' || formData.statut === 'sorti') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="date_sortie">Date de sortie</Label>
                <Input
                  id="date_sortie"
                  type="date"
                  value={formData.date_sortie ?? ''}
                  onChange={(e) => setFormData({ ...formData, date_sortie: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motif_sortie">Motif de sortie</Label>
                <Input
                  id="motif_sortie"
                  value={formData.motif_sortie ?? ''}
                  onChange={(e) => setFormData({ ...formData, motif_sortie: e.target.value || null })}
                  placeholder="Démission, licenciement, fin de contrat..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProfileId && onboardingData && (
        <>
          {/* Carte de statut */}
          <OnboardingStatusCard
            data={{ ...onboardingData, ...formData }}
            profileName={profileName}
            completionRate={completionRate}
          />

          {/* Accordéons */}
          <Accordion type="multiple" defaultValue={['dossier', 'comptes', 'materiel']} className="space-y-4">
            <AccordionItem value="dossier" className="border rounded-lg px-4">
              <AccordionTrigger>Dossier RH</AccordionTrigger>
              <AccordionContent>
              <DossierRHChecklist 
                dossier={formData.dossier_rh}
                onUpdate={(dossier) => setFormData({ ...formData, dossier_rh: dossier })}
                profileId={selectedProfileId}
                onboardingId={onboardingData?.id || null}
              />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comptes" className="border rounded-lg px-4">
              <AccordionTrigger>Comptes et accès</AccordionTrigger>
              <AccordionContent>
                <ComptesAccesChecklist
                  comptes={formData.comptes_acces}
                  onUpdate={(comptes) => setFormData({ ...formData, comptes_acces: comptes })}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="materiel" className="border rounded-lg px-4">
              <AccordionTrigger>Matériel</AccordionTrigger>
              <AccordionContent>
                <MaterielList
                  materiel={formData.materiel}
                  onUpdate={(materiel) => setFormData({ ...formData, materiel })}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {selectedProfileId && !onboardingData && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucune fiche d'entrée/sortie pour ce collaborateur.
            </p>
            <Button onClick={handleSave} className="mt-4">
              Créer une fiche
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedProfileId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez un collaborateur pour commencer
          </CardContent>
        </Card>
      )}
    </div>
  );
}
