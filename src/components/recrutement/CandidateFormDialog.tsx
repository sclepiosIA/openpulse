import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateCandidate, useUpdateCandidate } from "@/hooks/recrutement/useCandidates";
import { useJobOffers } from "@/hooks/recrutement/useJobOffers";
import { CANDIDATE_STATUS_LABELS, CANDIDATE_SOURCES, Candidate } from "@/types/recrutement";
import { User, Briefcase, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const candidateSchema = z.object({
  job_offer_id: z.string().min(1, "L'offre est requise"),
  prenom: z.string().min(2, "Le prénom est requis"),
  nom: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  telephone: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  statut: z.string().default("new"),
  source: z.string().optional(),
  source_detail: z.string().optional(),
  annees_experience: z.number().min(0).optional(),
  salaire_souhaite: z.number().min(0).optional(),
  disponibilite: z.string().optional(),
  date_disponibilite: z.string().optional(),
  notes: z.string().optional(),
  assignee_id: z.string().optional(),
});

type CandidateFormData = z.infer<typeof candidateSchema>;

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate;
  defaultJobOfferId?: string;
}

export default function CandidateFormDialog({ open, onOpenChange, candidate, defaultJobOfferId }: CandidateFormDialogProps) {
  const [activeTab, setActiveTab] = useState("info");
  const [profiles, setProfiles] = useState<any[]>([]);

  const { data: jobOffers = [] } = useJobOffers();
  const { mutateAsync: createCandidate, isPending: isCreating } = useCreateCandidate();
  const { mutateAsync: updateCandidate, isPending: isUpdating } = useUpdateCandidate();

  const form = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      job_offer_id: defaultJobOfferId || "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      linkedin_url: "",
      portfolio_url: "",
      statut: "new",
      source: "",
      source_detail: "",
      annees_experience: undefined,
      salaire_souhaite: undefined,
      disponibilite: "",
      date_disponibilite: "",
      notes: "",
      assignee_id: "",
    },
  });

  useEffect(() => {
    if (candidate) {
      form.reset({
        job_offer_id: candidate.job_offer_id,
        prenom: candidate.prenom,
        nom: candidate.nom,
        email: candidate.email,
        telephone: candidate.telephone || "",
        linkedin_url: candidate.linkedin_url || "",
        portfolio_url: candidate.portfolio_url || "",
        statut: candidate.statut,
        source: candidate.source || "",
        source_detail: candidate.source_detail || "",
        annees_experience: candidate.annees_experience || undefined,
        salaire_souhaite: candidate.salaire_souhaite || undefined,
        disponibilite: candidate.disponibilite || "",
        date_disponibilite: candidate.date_disponibilite || "",
        notes: candidate.notes || "",
        assignee_id: candidate.assignee_id || "",
      });
    } else {
      form.reset({
        job_offer_id: defaultJobOfferId || "",
        prenom: "",
        nom: "",
        email: "",
        telephone: "",
        linkedin_url: "",
        portfolio_url: "",
        statut: "new",
        source: "",
        source_detail: "",
        annees_experience: undefined,
        salaire_souhaite: undefined,
        disponibilite: "",
        date_disponibilite: "",
        notes: "",
        assignee_id: "",
      });
    }
  }, [candidate, defaultJobOfferId, form]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, prenom, nom")
        .order("nom");
      setProfiles(data || []);
    };
    if (open) fetchProfiles();
  }, [open]);

  const onSubmit = async (data: CandidateFormData) => {
    try {
      if (candidate) {
        await updateCandidate({ id: candidate.id, ...data } as any);
      } else {
        await createCandidate(data as any);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      debug.error("Erreur:", error);
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{candidate ? "Modifier le candidat" : "Nouveau candidat"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Informations</span>
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Profil</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Notes</span>
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] pr-4">
                <TabsContent value="info" className="space-y-4 mt-0">
                  <FormField
                    control={form.control}
                    name="job_offer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offre d'emploi *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une offre..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobOffers.map((offer) => (
                              <SelectItem key={offer.id} value={offer.id}>
                                {offer.titre}
                              </SelectItem>
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
                      name="prenom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Jean" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Dupont" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="jean.dupont@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="+33 6 12 34 56 78" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="linkedin_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn</FormLabel>
                          <FormControl>
                            <Input placeholder="https://linkedin.com/in/..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="portfolio_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portfolio</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="statut"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(CANDIDATE_STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CANDIDATE_SOURCES.map((source) => (
                                <SelectItem key={source} value={source}>{source}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="annees_experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Années d'expérience</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="5"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="salaire_souhaite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salaire souhaité (€/an)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="50000"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="disponibilite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disponibilité</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="immediate">Immédiate</SelectItem>
                              <SelectItem value="1_month">1 mois</SelectItem>
                              <SelectItem value="2_months">2 mois</SelectItem>
                              <SelectItem value="3_months">3 mois</SelectItem>
                              <SelectItem value="negotiable">À négocier</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="date_disponibilite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de disponibilité</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="assignee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chargé de recrutement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.prenom} {p.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-0">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes internes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Notes sur le candidat, impressions, points à discuter..."
                            className="min-h-[200px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="source_detail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Détails de la source</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Recommandé par X, Offre LinkedIn #123..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Enregistrement..." : candidate ? "Mettre à jour" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
