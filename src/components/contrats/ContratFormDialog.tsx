import { useState, useEffect, useMemo } from "react";
import { debug } from "@/lib/debug";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateContrat, useUpdateContrat } from "@/hooks/contracts/useContrats";
import { useContratTemplates } from "@/hooks/contracts/useContratTemplates";
import { ContratType, Contrat } from "@/types/contrats";
import { Building2, Hash, User, Euro, Calendar, FileText, Wand2, ChevronDown, Info, Check, ChevronsUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
// Schéma simplifié - l'établissement est obligatoire
const contratSchema = z.object({
  etablissement_id: z.string().min(1, "Sélectionnez un établissement"),
  titre: z.string().min(3, "Le titre est requis (min 3 caractères)"),
  contact_id: z.string().optional(),
  template_id: z.string().optional(),
  date_debut: z.string().optional(),
  duree_initiale_mois: z.number().min(1).default(12),
  reconduction_tacite: z.boolean().default(true),
  preavis_jours: z.number().min(0).default(90),
  conditions_particulieres: z.string().optional(),
  notes_internes: z.string().optional(),
});

type ContratFormData = z.infer<typeof contratSchema>;

interface EtablissementData {
  id: string;
  nom: string;
  ville: string | null;
  adresse: string | null;
  siret_facturation: string | null;
  siren_client: string | null;
  directeur_general_nom: string | null;
  directeur_general_prenom: string | null;
  modele_statique_succes: string | null;
  seuils_palliers: Record<string, number> | null;
  tarifs_palliers: Record<string, number> | null;
  periodicite_paiement: string | null;
  conditions_paiement_defaut: string | null;
  adresse_facturation: string | null;
  pallier_vise: string | null;
}

interface ContratFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrat?: Contrat;
}

export default function ContratFormDialog({ open, onOpenChange, contrat }: ContratFormDialogProps) {
  const navigate = useNavigate();
  const [etablissements, setEtablissements] = useState<EtablissementData[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previousEtabId, setPreviousEtabId] = useState<string | null>(null);
  const [etabComboboxOpen, setEtabComboboxOpen] = useState(false);
  const [etabSearchQuery, setEtabSearchQuery] = useState("");

  const { data: templates } = useContratTemplates();
  const { mutateAsync: createContrat, isPending: isCreating } = useCreateContrat();
  const { mutateAsync: updateContrat, isPending: isUpdating } = useUpdateContrat();

  const form = useForm<ContratFormData>({
    resolver: zodResolver(contratSchema),
    defaultValues: {
      etablissement_id: "",
      titre: "",
      duree_initiale_mois: 12,
      reconduction_tacite: true,
      preavis_jours: 90,
    },
  });

  // Charger les établissements avec toutes les infos nécessaires
  useEffect(() => {
    const loadEtablissements = async () => {
      const { data, error } = await supabase
        .from("etablissements")
        .select(`
          id, nom, ville, adresse,
          siret_facturation, siren_client,
          directeur_general_nom, directeur_general_prenom,
          modele_statique_succes, seuils_palliers, tarifs_palliers,
          periodicite_paiement, conditions_paiement_defaut,
          adresse_facturation, pallier_vise
        `)
        .order("nom");
      
      if (error) {
        debug.error("Erreur chargement établissements:", error);
      }
      setEtablissements((data as EtablissementData[]) || []);
    };
    loadEtablissements();
  }, []);

  // Établissement sélectionné
  const selectedEtablissementId = form.watch("etablissement_id");
  const selectedEtab = useMemo(() => 
    etablissements.find(e => e.id === selectedEtablissementId),
    [selectedEtablissementId, etablissements]
  );

  // Filtrage multimodal des établissements
  const filteredEtablissements = useMemo(() => {
    if (!etabSearchQuery.trim()) return etablissements.slice(0, 50);
    
    const query = etabSearchQuery.toLowerCase();
    return etablissements
      .filter((etab) =>
        etab.nom.toLowerCase().includes(query) ||
        etab.ville?.toLowerCase().includes(query) ||
        etab.siret_facturation?.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [etablissements, etabSearchQuery]);

  // Charger les contacts et mettre à jour le titre quand un établissement est sélectionné
  useEffect(() => {
    if (selectedEtablissementId && selectedEtab) {
      const loadContacts = async () => {
        const { data } = await supabase
          .from("contacts")
          .select("id, nom, prenom, fonction")
          .eq("etablissement_id", selectedEtablissementId)
          .order("nom");
        setContacts(data || []);
      };
      loadContacts();

      // Gérer le titre automatiquement
      const currentTitre = form.getValues("titre");
      const previousEtab = etablissements.find(e => e.id === previousEtabId);
      
      // Le titre est auto-généré s'il est vide OU correspond au pattern de l'établissement précédent
      const previousAutoTitle = previousEtab 
        ? `Licence OpenPulse - ${previousEtab.nom}`
        : "";
      
      if (!currentTitre || currentTitre === previousAutoTitle) {
        form.setValue("titre", `Licence OpenPulse - ${selectedEtab.nom}`);
      }
      
      setPreviousEtabId(selectedEtablissementId);
    } else {
      setContacts([]);
      setPreviousEtabId(null);
    }
  }, [selectedEtablissementId, selectedEtab, etablissements, previousEtabId]);

  // Calcul du montant depuis l'établissement
  const financialInfo = useMemo(() => {
    if (!selectedEtab) return null;
    
    const model = selectedEtab.modele_statique_succes || "Non défini";
    let montantMensuel = 0;
    let montantAnnuel = 0;
    let details = "";

    if (model === "Statique" && selectedEtab.tarifs_palliers && selectedEtab.pallier_vise) {
      const tarif = (selectedEtab.tarifs_palliers as Record<string, number>)[selectedEtab.pallier_vise];
      if (tarif) {
        montantMensuel = tarif;
        montantAnnuel = tarif * 12;
        details = `Palier ${selectedEtab.pallier_vise}: ${tarif.toLocaleString('fr-FR')}€/mois`;
      }
    } else if (model === "Succès" && selectedEtab.seuils_palliers) {
      details = "Facturation variable au succès";
      // Afficher les paliers
      const paliers = Object.entries(selectedEtab.seuils_palliers as Record<string, number>);
      if (paliers.length > 0) {
        details += ` (${paliers.length} paliers)`;
      }
    }

    return {
      model,
      montantMensuel,
      montantAnnuel,
      details,
      periodicite: selectedEtab.periodicite_paiement || "Mensuel",
      conditions: selectedEtab.conditions_paiement_defaut || "30 jours"
    };
  }, [selectedEtab]);

  const submitContrat = async (data: ContratFormData, shouldOpenBuilder: boolean = false) => {
    if (!selectedEtab) return;

    try {
      // Calculer les montants depuis l'établissement
      let montantMensuel = 0;
      let montantAnnuel = 0;
      
      if (selectedEtab.modele_statique_succes === "Statique" && selectedEtab.tarifs_palliers && selectedEtab.pallier_vise) {
        const tarif = (selectedEtab.tarifs_palliers as Record<string, number>)[selectedEtab.pallier_vise];
        if (tarif) {
          montantMensuel = tarif;
          montantAnnuel = tarif * 12;
        }
      }

      const representant = [selectedEtab.directeur_general_prenom, selectedEtab.directeur_general_nom]
        .filter(Boolean).join(" ");

      const contratData = {
        titre: data.titre,
        type: "licence" as ContratType,
        etablissement_id: data.etablissement_id,
        contact_id: data.contact_id || null,
        template_id: data.template_id || null,
        
        // Auto-remplis depuis l'établissement
        client_nom: selectedEtab.nom,
        client_adresse: selectedEtab.adresse_facturation || selectedEtab.adresse || null,
        client_siret: selectedEtab.siret_facturation || null,
        client_representant: representant || null,
        
        // Dates et durée
        date_debut: data.date_debut || null,
        date_fin: null,
        duree_initiale_mois: data.duree_initiale_mois,
        reconduction_tacite: data.reconduction_tacite,
        preavis_jours: data.preavis_jours,
        
        // Montants auto-calculés
        montant_mensuel_ht: montantMensuel,
        montant_annuel_ht: montantAnnuel,
        conditions_paiement: selectedEtab.conditions_paiement_defaut || "30 jours date de facture",
        
        // Notes
        conditions_particulieres: data.conditions_particulieres || null,
        notes_internes: data.notes_internes || null,
      };

      if (contrat) {
        await updateContrat({ id: contrat.id, ...contratData });
        onOpenChange(false);
      } else {
        const newContrat = await createContrat(contratData);
        onOpenChange(false);
        
        if (shouldOpenBuilder && newContrat?.id) {
          navigate(`/contrats/builder/${newContrat.id}`);
        }
      }
      
      form.reset();
    } catch (error) {
      debug.error("Erreur sauvegarde contrat:", error);
    }
  };

  const onSubmit = async (data: ContratFormData) => {
    await submitContrat(data, false);
  };

  const handleSubmitAndOpenBuilder = async () => {
    const isValid = await form.trigger();
    if (!isValid || !selectedEtab) return;

    try {
      const data = form.getValues();
      
      // Calculer les montants depuis l'établissement
      let montantMensuel = 0;
      let montantAnnuel = 0;
      
      if (selectedEtab.modele_statique_succes === "Statique" && selectedEtab.tarifs_palliers && selectedEtab.pallier_vise) {
        const tarif = (selectedEtab.tarifs_palliers as Record<string, number>)[selectedEtab.pallier_vise];
        if (tarif) {
          montantMensuel = tarif;
          montantAnnuel = tarif * 12;
        }
      }

      const representant = [selectedEtab.directeur_general_prenom, selectedEtab.directeur_general_nom]
        .filter(Boolean).join(" ");

      const contratData = {
        titre: data.titre,
        type: "licence" as ContratType,
        etablissement_id: data.etablissement_id,
        contact_id: data.contact_id || null,
        template_id: data.template_id || null,
        client_nom: selectedEtab.nom,
        client_adresse: selectedEtab.adresse_facturation || selectedEtab.adresse || null,
        client_siret: selectedEtab.siret_facturation || null,
        client_representant: representant || null,
        date_debut: data.date_debut || null,
        date_fin: null,
        duree_initiale_mois: data.duree_initiale_mois,
        reconduction_tacite: data.reconduction_tacite,
        preavis_jours: data.preavis_jours,
        montant_mensuel_ht: montantMensuel,
        montant_annuel_ht: montantAnnuel,
        conditions_paiement: selectedEtab.conditions_paiement_defaut || "30 jours date de facture",
        conditions_particulieres: data.conditions_particulieres || null,
        notes_internes: data.notes_internes || null,
      };

      // 1. Créer le contrat
      const newContrat = await createContrat(contratData);
      
      if (!newContrat?.id) {
        debug.error("Contrat créé sans ID");
        return;
      }
      
      const contratId = newContrat.id;
      
      // 2. Reset le formulaire
      form.reset();
      setPreviousEtabId(null);
      
      // 3. Fermer le dialog
      onOpenChange(false);
      
      // 4. Petit délai pour laisser React Query invalider le cache
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 5. Naviguer vers le builder
      navigate(`/contrats/builder/${contratId}`);
      
    } catch (error) {
      debug.error("Erreur création+builder:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {contrat ? "Modifier le contrat" : "Nouveau contrat"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Établissement - Recherche multimodale */}
            <FormField
              control={form.control}
              name="etablissement_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Établissement *</FormLabel>
                  <Popover open={etabComboboxOpen} onOpenChange={setEtabComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={etabComboboxOpen}
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            <span className="truncate">
                              {selectedEtab?.nom} {selectedEtab?.ville && `(${selectedEtab.ville})`}
                            </span>
                          ) : (
                            "Rechercher un établissement..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Rechercher par nom, ville, SIRET..."
                          value={etabSearchQuery}
                          onValueChange={setEtabSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>Aucun établissement trouvé</CommandEmpty>
                          <CommandGroup>
                            {filteredEtablissements.map((etab) => (
                              <CommandItem
                                key={etab.id}
                                value={etab.id}
                                onSelect={() => {
                                  field.onChange(etab.id);
                                  setEtabComboboxOpen(false);
                                  setEtabSearchQuery("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === etab.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {etab.nom} {etab.ville && <span className="text-muted-foreground">({etab.ville})</span>}
                                  </span>
                                  {etab.siret_facturation && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      SIRET: {etab.siret_facturation}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Aperçu des informations détectées */}
            {selectedEtab && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Informations détectées depuis l'établissement
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="font-medium">{selectedEtab.nom}</div>
                      {selectedEtab.adresse_facturation || selectedEtab.adresse ? (
                        <div className="text-muted-foreground text-xs">
                          {selectedEtab.adresse_facturation || selectedEtab.adresse}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {selectedEtab.siret_facturation && (
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">SIRET:</span>
                      <span className="font-mono text-xs">{selectedEtab.siret_facturation}</span>
                    </div>
                  )}
                  
                  {(selectedEtab.directeur_general_prenom || selectedEtab.directeur_general_nom) && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>
                        {[selectedEtab.directeur_general_prenom, selectedEtab.directeur_general_nom].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  )}
                  
                  {financialInfo && (
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <Badge variant="outline" className="mr-2">
                          {financialInfo.model}
                        </Badge>
                        {financialInfo.details && (
                          <span className="text-muted-foreground text-xs">{financialInfo.details}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {financialInfo && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">
                        {financialInfo.periodicite} • {financialInfo.conditions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Titre du contrat */}
            <FormField
              control={form.control}
              name="titre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre du contrat *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Licence OpenPulse - CHU Paris" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact signataire (si disponible) */}
            {contacts.length > 0 && (
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact signataire</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un signataire" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.prenom} {c.nom} - {c.fonction}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Dates essentielles */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_debut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duree_initiale_mois"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durée (mois)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 12)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Options avancées (collapsible) */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Options avancées
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modèle de contrat</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Utiliser un modèle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="preavis_jours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Préavis (jours)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 90)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reconduction_tacite"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0 pt-8">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer text-sm">
                          Reconduction tacite
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="conditions_particulieres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conditions particulières</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Conditions spécifiques..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes_internes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes internes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="Notes visibles uniquement en interne..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              {!contrat && (
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleSubmitAndOpenBuilder}
                  disabled={isCreating || isUpdating}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Créer et ouvrir le Builder
                </Button>
              )}
              <Button type="submit" disabled={isCreating || isUpdating}>
                {contrat ? "Mettre à jour" : "Créer le contrat"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
