import { useState, useEffect, useMemo } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Euro, FileText, Building2, TrendingUp, Users } from "lucide-react";
import { calculateMontantAnnuel, calculateMontantPeriodique } from "@/hooks/billing/useFacturationEtablissement";
import { useEtablissementGroupeFacturation, useSaveGroupeFacturation } from "@/hooks/crm/useEtablissementGroupeFacturation";
import { etablissementKeys } from "@/hooks/crm/useEtablissements";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

interface EtablissementFacturationConfigProps {
  etablissementId: string;
  etablissement: {
    id: string;
    nom: string;
    client_facturation?: string | null;
    type_offre?: string | null;
    periodicite_paiement?: string | null;
    pallier_vise?: string | null;
    modele_statique_succes?: string | number | null;
    tarifs_palliers?: Record<string, number> | null;
    paiement_initial?: number | null;
    email_facturation?: string | null;
    adresse_facturation?: string | null;
    siret_facturation?: string | null;
    conditions_paiement_defaut?: string | null;
    mode_paiement_prefere?: string | null;
    vecteur_achat?: string | null;
  };
}

const PERIODICITES = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "semestriel", label: "Semestriel" },
  { value: "annuel", label: "Annuel" },
];

const TYPES_CLIENT = [
  { value: "groupe", label: "Groupe" },
  { value: "etablissement", label: "Établissement" },
];

const TYPES_OFFRE = [
  { value: "Statique", label: "Statique" },
  { value: "Au succès", label: "Au succès" },
  { value: "Mixte", label: "Mixte" },
];

const MODES_PAIEMENT = [
  { value: "virement", label: "Virement bancaire" },
  { value: "prelevement", label: "Prélèvement SEPA" },
  { value: "cheque", label: "Chèque" },
  { value: "carte", label: "Carte bancaire" },
];

const VECTEURS_ACHAT = [
  { value: "direct", label: "Direct" },
  { value: "resah_asm", label: "Resah - ASM" },
  { value: "ugap_scc", label: "UGAP - SCC" },
  { value: "softway", label: "Softway" },
  { value: "softway_markdown", label: "Softway Markdown" },
  { value: "inconnu", label: "Inconnu" },
];

const PALLIERS = [
  { value: "palier1", label: "Palier 1" },
  { value: "palier2", label: "Palier 2" },
  { value: "palier3", label: "Palier 3" },
  { value: "palier4", label: "Palier 4" },
];

// Formater un nombre au format comptable français (pour affichage)
const formatAccountingDisplay = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

// Parser une saisie comptable vers un nombre
const parseAccountingInput = (value: string): number => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export function EtablissementFacturationConfig({ 
  etablissementId, 
  etablissement 
}: EtablissementFacturationConfigProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // État pour le type de facturation (groupe ou établissement)
  const [clientFacturation, setClientFacturation] = useState(etablissement.client_facturation || "");
  const isGroupeBilling = clientFacturation === "groupe";

  // Hook pour récupérer les données du groupe (activé seulement si facturation groupe)
  const { data: groupeData, isLoading: isLoadingGroupe } = useEtablissementGroupeFacturation(
    etablissementId, 
    isGroupeBilling
  );
  const { saveGroupeFacturation } = useSaveGroupeFacturation();

  const [formData, setFormData] = useState({
    client_facturation: etablissement.client_facturation || "",
    type_offre: etablissement.type_offre || "",
    periodicite_paiement: etablissement.periodicite_paiement || "mensuel",
    pallier_vise: etablissement.pallier_vise || "",
    modele_statique_succes: etablissement.modele_statique_succes != null ? String(etablissement.modele_statique_succes) : "",
    paiement_initial: etablissement.paiement_initial 
      ? formatAccountingDisplay(etablissement.paiement_initial) 
      : "",
    tarifs_palliers: {
      palier1: etablissement.tarifs_palliers?.palier1 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier1) : '',
      palier2: etablissement.tarifs_palliers?.palier2 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier2) : '',
      palier3: etablissement.tarifs_palliers?.palier3 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier3) : '',
      palier4: etablissement.tarifs_palliers?.palier4 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier4) : '',
    },
    email_facturation: etablissement.email_facturation || "",
    adresse_facturation: etablissement.adresse_facturation || "",
    siret_facturation: etablissement.siret_facturation || "",
    conditions_paiement_defaut: etablissement.conditions_paiement_defaut || "30 jours fin de mois",
    mode_paiement_prefere: etablissement.mode_paiement_prefere || "virement",
    vecteur_achat: etablissement.vecteur_achat || "",
  });

  // Calcul local du résumé basé sur formData (réactif aux changements utilisateur)
  const modeleEcoLocal = useMemo(() => {
    const pseudoEtab = {
      tarifs_palliers: formData.type_offre === "Au succès" ? {
        palier1: parseAccountingInput(formData.tarifs_palliers.palier1 || '0'),
        palier2: parseAccountingInput(formData.tarifs_palliers.palier2 || '0'),
        palier3: parseAccountingInput(formData.tarifs_palliers.palier3 || '0'),
        palier4: parseAccountingInput(formData.tarifs_palliers.palier4 || '0'),
      } : null,
      pallier_vise: formData.pallier_vise || null,
      modele_statique_succes: formData.modele_statique_succes || null,
      nombre_passages_urgences_annuel: (etablissement as any).nombre_passages_urgences_annuel || null,
    };
    const { montant: montantAnnuel, modele } = calculateMontantAnnuel(pseudoEtab);
    const periodicite = formData.periodicite_paiement || 'mensuel';
    const montantPeriodique = calculateMontantPeriodique(montantAnnuel, periodicite);
    return { modele, periodicite, montant_annuel: montantAnnuel, montant_periodique: montantPeriodique };
  }, [formData, etablissement]);

  useEffect(() => {
    setClientFacturation(etablissement.client_facturation || "");
  }, [etablissementId]);

  // Effet consolidé pour charger les données du formulaire
  // Réagit à l'état local clientFacturation pour un chargement immédiat lors du changement de dropdown
  useEffect(() => {
    // Utiliser l'état local pour réagir immédiatement aux changements utilisateur
    const isGroupe = clientFacturation === "groupe";

    // En mode groupe: attendre les données du groupe avant de mettre à jour
    if (isGroupe) {
      if (groupeData) {
        // Données groupe disponibles: les utiliser
        setFormData({
          client_facturation: clientFacturation,
          type_offre: groupeData.type_offre || "",
          periodicite_paiement: groupeData.periodicite_paiement || "mensuel",
          pallier_vise: groupeData.pallier_vise || "",
          modele_statique_succes: groupeData.modele_statique_succes || "",
          paiement_initial: groupeData.paiement_initial 
            ? formatAccountingDisplay(groupeData.paiement_initial) 
            : "",
          tarifs_palliers: {
            palier1: groupeData.tarifs_palliers?.palier1 ? formatAccountingDisplay(groupeData.tarifs_palliers.palier1) : '',
            palier2: groupeData.tarifs_palliers?.palier2 ? formatAccountingDisplay(groupeData.tarifs_palliers.palier2) : '',
            palier3: groupeData.tarifs_palliers?.palier3 ? formatAccountingDisplay(groupeData.tarifs_palliers.palier3) : '',
            palier4: groupeData.tarifs_palliers?.palier4 ? formatAccountingDisplay(groupeData.tarifs_palliers.palier4) : '',
          },
          email_facturation: groupeData.email_facturation || "",
          adresse_facturation: groupeData.adresse_facturation || "",
          siret_facturation: groupeData.siret_facturation || "",
          conditions_paiement_defaut: groupeData.conditions_paiement_defaut || "30 jours fin de mois",
          mode_paiement_prefere: groupeData.mode_paiement_prefere || "virement",
          vecteur_achat: groupeData.vecteur_achat || "",
        });
      }
      // Si groupeData n'est pas encore chargé, on garde l'état précédent (pas de setFormData)
    } else {
      // Mode établissement: charger depuis l'établissement
      setFormData({
        client_facturation: clientFacturation,
        type_offre: etablissement.type_offre || "",
        periodicite_paiement: etablissement.periodicite_paiement || "mensuel",
        pallier_vise: etablissement.pallier_vise || "",
        modele_statique_succes: etablissement.modele_statique_succes != null ? String(etablissement.modele_statique_succes) : "",
        paiement_initial: etablissement.paiement_initial 
          ? formatAccountingDisplay(etablissement.paiement_initial) 
          : "",
        tarifs_palliers: {
          palier1: etablissement.tarifs_palliers?.palier1 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier1) : '',
          palier2: etablissement.tarifs_palliers?.palier2 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier2) : '',
          palier3: etablissement.tarifs_palliers?.palier3 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier3) : '',
          palier4: etablissement.tarifs_palliers?.palier4 ? formatAccountingDisplay(etablissement.tarifs_palliers.palier4) : '',
        },
        email_facturation: etablissement.email_facturation || "",
        adresse_facturation: etablissement.adresse_facturation || "",
        siret_facturation: etablissement.siret_facturation || "",
        conditions_paiement_defaut: etablissement.conditions_paiement_defaut || "30 jours fin de mois",
        mode_paiement_prefere: etablissement.mode_paiement_prefere || "virement",
        vecteur_achat: etablissement.vecteur_achat || "",
      });
    }
  }, [clientFacturation, etablissement, groupeData]);

  // Gérer le changement de type de client
  const handleClientFacturationChange = (value: string) => {
    // Mettre à jour formData
    setFormData(prev => ({ ...prev, client_facturation: value }));
    
    // Mettre à jour clientFacturation IMMEDIATEMENT pour activer le hook
    // Le useEffect (lignes 171-196) chargera automatiquement les données du groupe
    setClientFacturation(value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Toujours sauvegarder client_facturation sur l'établissement
      const { error: etabError } = await supabase
        .from("etablissements")
        .update({ client_facturation: formData.client_facturation || null })
        .eq("id", etablissementId);

      if (etabError) throw etabError;

      const billingData = {
        type_offre: formData.type_offre || null,
        periodicite_paiement: formData.periodicite_paiement || "mensuel",
        pallier_vise: formData.pallier_vise || null,
        modele_statique_succes: formData.modele_statique_succes 
          ? String(parseFloat(formData.modele_statique_succes))
          : null,
        paiement_initial: formData.paiement_initial 
          ? parseAccountingInput(formData.paiement_initial) 
          : null,
        tarifs_palliers: formData.type_offre === "Au succès" ? {
          palier1: parseAccountingInput(formData.tarifs_palliers.palier1 || '0'),
          palier2: parseAccountingInput(formData.tarifs_palliers.palier2 || '0'),
          palier3: parseAccountingInput(formData.tarifs_palliers.palier3 || '0'),
          palier4: parseAccountingInput(formData.tarifs_palliers.palier4 || '0'),
        } : null,
        email_facturation: formData.email_facturation || null,
        adresse_facturation: formData.adresse_facturation || null,
        siret_facturation: formData.siret_facturation || null,
        conditions_paiement_defaut: formData.conditions_paiement_defaut || null,
        mode_paiement_prefere: formData.mode_paiement_prefere || null,
        vecteur_achat: formData.vecteur_achat || null,
      };

      if (isGroupeBilling && !groupeData) {
        toast.error("Aucun groupe associé. Associez d'abord cet établissement à un groupe de facturation.");
        setIsSaving(false);
        return;
      }

      if (isGroupeBilling && groupeData) {
        // Sauvegarder dans le groupe
        await saveGroupeFacturation(groupeData.groupe_id, billingData);
      } else {
        // Sauvegarder dans l'établissement
        const { error } = await supabase
          .from("etablissements")
          .update(billingData)
          .eq("id", etablissementId);

        if (error) throw error;
      }

      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: etablissementKeys.detail(etablissementId) });
      queryClient.invalidateQueries({ queryKey: etablissementKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ["etablissement-modele-economique", etablissementId] });
      queryClient.invalidateQueries({ queryKey: ["facturation-etablissements"] });
      
      if (isGroupeBilling && groupeData) {
        // Invalider le cache du groupe (partagé entre tous les établissements)
        queryClient.invalidateQueries({ queryKey: ["groupe-facturation", groupeData.groupe_id] });
        queryClient.invalidateQueries({ queryKey: ["groupe-etablissements", groupeData.groupe_id] });
      }

      toast.success("Configuration de facturation mise à jour");
    } catch (error: unknown) {
      debug.error("Error saving:", error);
      const message = sanitizeSupabaseError(error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePallierTarif = (pallier: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      tarifs_palliers: {
        ...prev.tarifs_palliers,
        [pallier]: value,
      },
    }));
  };

  const isLoadingData = isGroupeBilling && isLoadingGroupe;

  return (
    <div className="space-y-6">
      {/* Bandeau informatif pour facturation groupe */}
      {isGroupeBilling && groupeData && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Facturation groupe</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            Cette configuration est partagée avec {groupeData.etablissements_en_facturation_groupe} établissement{groupeData.etablissements_en_facturation_groupe > 1 ? 's' : ''} du groupe "{groupeData.groupe_nom}".
            Toute modification sera appliquée à tous les établissements en facturation groupe.
          </AlertDescription>
        </Alert>
      )}

      {isGroupeBilling && !groupeData && !isLoadingGroupe && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Aucun groupe associé</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Cet établissement n'est associé à aucun groupe. Veuillez d'abord l'associer à un groupe ou choisir "Établissement" comme type de client.
          </AlertDescription>
        </Alert>
      )}

      {/* Résumé du modèle économique */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Résumé du modèle économique
          </CardTitle>
        </CardHeader>
        <CardContent>
          {modeleEcoLocal.montant_annuel > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Modèle</p>
                <Badge variant={modeleEcoLocal.modele === "Succès" ? "default" : "secondary"}>
                  {modeleEcoLocal.modele}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Périodicité</p>
                <p className="font-medium capitalize">{modeleEcoLocal.periodicite}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant annuel</p>
                <p className="font-semibold text-lg text-primary">
                  {formatCurrency(modeleEcoLocal.montant_annuel)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant périodique</p>
                <p className="font-semibold text-lg">
                  {formatCurrency(modeleEcoLocal.montant_periodique)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun modèle configuré</p>
          )}
        </CardContent>
      </Card>

      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration du modèle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Modèle économique
              </CardTitle>
              <CardDescription>
                Configuration du type d'offre et de la tarification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select 
                  value={formData.client_facturation} 
                  onValueChange={handleClientFacturationChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type de client" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_CLIENT.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type d'offre</Label>
                <Select 
                  value={formData.type_offre} 
                  onValueChange={(v) => setFormData(p => ({ ...p, type_offre: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_OFFRE.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Périodicité de facturation</Label>
                <Select 
                  value={formData.periodicite_paiement} 
                  onValueChange={(v) => setFormData(p => ({ ...p, periodicite_paiement: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODICITES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.type_offre === "Statique" && (
                <div className="space-y-2">
                  <Label>Montant annuel statique (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.modele_statique_succes ? formatAccountingDisplay(parseFloat(formData.modele_statique_succes)) : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^\d\s,\.]/g, '');
                      setFormData(p => ({ ...p, modele_statique_succes: parseAccountingInput(rawValue).toString() }));
                    }}
                    placeholder="Ex: 50 000,00"
                    className="text-right"
                  />
                </div>
              )}

              {formData.type_offre === "Au succès" && (
                <>
                  <div className="space-y-2">
                    <Label>Palier visé</Label>
                    <Select 
                      value={formData.pallier_vise} 
                      onValueChange={(v) => setFormData(p => ({ ...p, pallier_vise: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un palier" />
                      </SelectTrigger>
                      <SelectContent>
                        {PALLIERS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Tarifs par palier (€/an)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {PALLIERS.map(p => (
                        <div key={p.value} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{p.label}</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={formData.tarifs_palliers[p.value as keyof typeof formData.tarifs_palliers] || ''}
                            onChange={(e) => {
                              const rawValue = e.target.value.replace(/[^\d\s,\.]/g, '');
                              updatePallierTarif(p.value, rawValue);
                            }}
                            onBlur={(e) => {
                              const numValue = parseAccountingInput(e.target.value);
                              if (numValue > 0) {
                                updatePallierTarif(p.value, formatAccountingDisplay(numValue));
                              } else {
                                updatePallierTarif(p.value, '');
                              }
                            }}
                            onFocus={(e) => {
                              const numValue = parseAccountingInput(e.target.value);
                              if (numValue > 0) {
                                updatePallierTarif(p.value, numValue.toString().replace('.', ','));
                              }
                            }}
                            placeholder="0"
                            className="text-right"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Paiement initial (EUR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.paiement_initial}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/[^\d\s,\.]/g, '');
                    setFormData(p => ({ ...p, paiement_initial: rawValue }));
                  }}
                  onBlur={(e) => {
                    const numValue = parseAccountingInput(e.target.value);
                    if (numValue > 0) {
                      setFormData(p => ({ ...p, paiement_initial: formatAccountingDisplay(numValue) }));
                    } else if (e.target.value.trim() === '' || numValue === 0) {
                      setFormData(p => ({ ...p, paiement_initial: '' }));
                    }
                  }}
                  onFocus={(e) => {
                    const numValue = parseAccountingInput(e.target.value);
                    if (numValue > 0) {
                      setFormData(p => ({ ...p, paiement_initial: numValue.toString().replace('.', ',') }));
                    }
                  }}
                  placeholder="Optionnel - Frais d'installation"
                  className="text-right"
                />
              </div>
            </CardContent>
          </Card>

          {/* Informations de facturation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations de facturation
              </CardTitle>
              <CardDescription>
                Coordonnées et conditions de paiement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email de facturation</Label>
                <Input
                  type="email"
                  value={formData.email_facturation}
                  onChange={(e) => setFormData(p => ({ ...p, email_facturation: e.target.value }))}
                  placeholder="comptabilite@etablissement.fr"
                />
              </div>

              <div className="space-y-2">
                <Label>Adresse de facturation</Label>
                <Input
                  value={formData.adresse_facturation}
                  onChange={(e) => setFormData(p => ({ ...p, adresse_facturation: e.target.value }))}
                  placeholder="Adresse complète de facturation"
                />
              </div>

              <div className="space-y-2">
                <Label>SIRET</Label>
                <Input
                  value={formData.siret_facturation}
                  onChange={(e) => setFormData(p => ({ ...p, siret_facturation: e.target.value }))}
                  placeholder="123 456 789 00012"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Conditions de paiement</Label>
                <Select 
                  value={formData.conditions_paiement_defaut} 
                  onValueChange={(v) => setFormData(p => ({ ...p, conditions_paiement_defaut: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 jours fin de mois">30 jours fin de mois</SelectItem>
                    <SelectItem value="45 jours fin de mois">45 jours fin de mois</SelectItem>
                    <SelectItem value="60 jours">60 jours</SelectItem>
                    <SelectItem value="A réception">À réception</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mode de paiement préféré</Label>
                <Select 
                  value={formData.mode_paiement_prefere} 
                  onValueChange={(v) => setFormData(p => ({ ...p, mode_paiement_prefere: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES_PAIEMENT.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vecteur d'achat</Label>
                <Select 
                  value={formData.vecteur_achat} 
                  onValueChange={(v) => setFormData(p => ({ ...p, vecteur_achat: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un vecteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {VECTEURS_ACHAT.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bouton de sauvegarde */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoadingData}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer la configuration
        </Button>
      </div>
    </div>
  );
}
