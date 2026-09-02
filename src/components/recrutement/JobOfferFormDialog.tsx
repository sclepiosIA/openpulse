import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateJobOffer, useUpdateJobOffer } from "@/hooks/recrutement/useJobOffers";
import { CONTRACT_TYPE_LABELS, JOB_STATUS_LABELS, JobOffer } from "@/types/recrutement";
import { Briefcase, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MAX_SALARY = 1_000_000; // borne métier annuelle raisonnable (1 M €/an)

const jobOfferSchema = z.object({
  titre: z.string().min(3, "Le titre est requis (min 3 caractères)").max(150, "Le titre ne peut pas dépasser 150 caractères"),
  type_contrat: z.string().min(1, "Le type de contrat est requis"),
  statut: z.string().default("draft"),
  description: z.string().optional(),
  localisation: z.string().optional(),
  departement: z.string().optional(),
  salaire_min: z.number().min(0, "Doit être positif").max(MAX_SALARY, `Max ${MAX_SALARY.toLocaleString('fr-FR')} €/an`).optional(),
  salaire_max: z.number().min(0, "Doit être positif").max(MAX_SALARY, `Max ${MAX_SALARY.toLocaleString('fr-FR')} €/an`).optional(),
  experience_minimum: z.number().min(0).max(60, "Maximum 60 ans").optional(),
  niveau_etudes: z.string().optional(),
  nombre_postes: z.number().min(1).max(999).default(1),
  date_publication: z.string().optional(),
  date_cloture: z.string().optional(),
  diffusion_externe: z.boolean().default(false),
  responsable_id: z.string().optional(),
  priorite: z.string().optional(),
}).refine(
  (data) => !data.salaire_min || !data.salaire_max || data.salaire_max >= data.salaire_min,
  { message: "Le salaire max doit être supérieur ou égal au salaire min", path: ["salaire_max"] },
);

type JobOfferFormData = z.infer<typeof jobOfferSchema>;

interface JobOfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: JobOffer;
}

export default function JobOfferFormDialog({ open, onOpenChange, offer }: JobOfferFormDialogProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [profiles, setProfiles] = useState<any[]>([]);

  const { mutateAsync: createOffer, isPending: isCreating } = useCreateJobOffer();
  const { mutateAsync: updateOffer, isPending: isUpdating } = useUpdateJobOffer();

  const form = useForm<JobOfferFormData>({
    resolver: zodResolver(jobOfferSchema),
    defaultValues: {
      titre: "",
      type_contrat: "cdi",
      statut: "draft",
      description: "",
      localisation: "",
      departement: "",
      salaire_min: undefined,
      salaire_max: undefined,
      experience_minimum: undefined,
      niveau_etudes: "",
      nombre_postes: 1,
      date_publication: "",
      date_cloture: "",
      diffusion_externe: false,
      responsable_id: "",
      priorite: "medium",
    },
  });

  useEffect(() => {
    if (offer) {
      form.reset({
        titre: offer.titre,
        type_contrat: offer.type_contrat,
        statut: offer.statut,
        description: offer.description || "",
        localisation: offer.localisation || "",
        departement: offer.departement || "",
        salaire_min: offer.salaire_min || undefined,
        salaire_max: offer.salaire_max || undefined,
        experience_minimum: offer.experience_minimum || undefined,
        niveau_etudes: offer.niveau_etudes || "",
        nombre_postes: offer.nombre_postes || 1,
        date_publication: offer.date_publication || "",
        date_cloture: offer.date_cloture || "",
        diffusion_externe: offer.diffusion_externe || false,
        responsable_id: offer.responsable_id || "",
        priorite: offer.priorite || "medium",
      });
    } else {
      form.reset();
    }
  }, [offer, form]);

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

  const onSubmit = async (data: JobOfferFormData) => {
    try {
      if (offer) {
        await updateOffer({ id: offer.id, ...data } as any);
      } else {
        await createOffer(data as any);
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
          <DialogTitle>{offer ? "Modifier l'offre" : "Nouvelle offre d'emploi"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="general" className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Général</span>
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Détails</span>
                </TabsTrigger>
                <TabsTrigger value="publication" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Publication</span>
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] pr-4">
                <TabsContent value="general" className="space-y-4 mt-0">
                  <FormField
                    control={form.control}
                    name="titre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre du poste *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Développeur Full Stack" maxLength={150} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type_contrat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de contrat *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
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
                              {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description du poste</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Décrivez le poste, les missions, les responsabilités..."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Département</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Tech, Marketing..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="localisation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localisation</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Paris, Remote..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="salaire_min"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salaire min (€/an)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="40000"
                              min={0}
                              max={MAX_SALARY}
                              step={500}
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
                      name="salaire_max"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salaire max (€/an)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="60000"
                              min={0}
                              max={MAX_SALARY}
                              step={500}
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
                      name="experience_minimum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expérience min (années)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="3"
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
                      name="nombre_postes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de postes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={e => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="responsable_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsable du recrutement</FormLabel>
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

                <TabsContent value="publication" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date_publication"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de publication</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="date_cloture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de clôture</FormLabel>
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
                    name="priorite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priorité</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Basse</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="high">Haute</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="diffusion_externe"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <FormLabel>Diffusion externe</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Publier sur LinkedIn, Indeed, APEC...
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
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
                {isLoading ? "Enregistrement..." : offer ? "Mettre à jour" : "Créer l'offre"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
