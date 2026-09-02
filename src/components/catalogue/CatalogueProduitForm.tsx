import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCatalogueProduits } from "@/hooks/catalogue/useCatalogueProduits";
import {
  PRODUIT_TYPE_LABELS,
  RECURRENCE_LABELS,
  type CatalogueProduit,
} from "@/types/facturation";
import { ScrollArea } from "@/components/ui/scroll-area";

const schema = z.object({
  code: z.string().min(1, "Code requis"),
  nom: z.string().min(1, "Nom requis"),
  description: z.string().optional().nullable(),
  type: z.enum(['service', 'produit', 'licence', 'formation', 'maintenance']),
  categorie: z.string().optional().nullable(),
  recurrence: z.enum(['none', 'monthly', 'quarterly', 'yearly']),
  prix_unitaire_ht: z.coerce.number().min(0),
  prix_min_ht: z.coerce.number().min(0).optional().nullable(),
  prix_max_ht: z.coerce.number().min(0).optional().nullable(),
  remise_max_pct: z.coerce.number().min(0).max(100),
  taux_tva: z.coerce.number().min(0).max(100),
  unite: z.string().min(1),
  notes_internes: z.string().optional().nullable(),
  est_actif: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  produit?: CatalogueProduit | null;
}

export function CatalogueProduitForm({ open, onOpenChange, produit }: Props) {
  const { createProduit, updateProduit, isCreating, isUpdating } = useCatalogueProduits();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "", nom: "", description: "", type: "service",
      categorie: "", recurrence: "none",
      prix_unitaire_ht: 0, prix_min_ht: null, prix_max_ht: null,
      remise_max_pct: 0, taux_tva: 20, unite: "unité",
      notes_internes: "", est_actif: true,
    },
  });

  useEffect(() => {
    if (open) {
      reset(produit ? {
        code: produit.code,
        nom: produit.nom,
        description: produit.description ?? "",
        type: produit.type,
        categorie: produit.categorie ?? "",
        recurrence: produit.recurrence ?? "none",
        prix_unitaire_ht: produit.prix_unitaire_ht,
        prix_min_ht: produit.prix_min_ht ?? null,
        prix_max_ht: produit.prix_max_ht ?? null,
        remise_max_pct: produit.remise_max_pct ?? 0,
        taux_tva: produit.taux_tva,
        unite: produit.unite || "unité",
        notes_internes: produit.notes_internes ?? "",
        est_actif: produit.est_actif,
      } : {
        code: "", nom: "", description: "", type: "service",
        categorie: "", recurrence: "none",
        prix_unitaire_ht: 0, prix_min_ht: null, prix_max_ht: null,
        remise_max_pct: 0, taux_tva: 20, unite: "unité",
        notes_internes: "", est_actif: true,
      });
    }
  }, [open, produit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      description: data.description || null,
      categorie: data.categorie || null,
      notes_internes: data.notes_internes || null,
      prix_min_ht: data.prix_min_ht ?? null,
      prix_max_ht: data.prix_max_ht ?? null,
    };
    try {
      if (produit) await updateProduit({ id: produit.id, ...payload });
      else await createProduit(payload as any);
      onOpenChange(false);
    } catch { /* handled */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{produit ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Code *</Label>
                  <Input {...register("code")} placeholder="PROD-001" />
                  {errors.code && <p className="text-xs text-destructive mt-1">{errors.code.message}</p>}
                </div>
                <div>
                  <Label>Type *</Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PRODUIT_TYPE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div>
                <Label>Nom *</Label>
                <Input {...register("nom")} placeholder="Nom du produit ou service" />
                {errors.nom && <p className="text-xs text-destructive mt-1">{errors.nom.message}</p>}
              </div>

              <div>
                <Label>Description</Label>
                <Textarea {...register("description")} rows={3} placeholder="Description détaillée…" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie</Label>
                  <Input {...register("categorie")} placeholder="ex: Infrastructure, Conseil…" />
                </div>
                <div>
                  <Label>Récurrence</Label>
                  <Controller
                    name="recurrence"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Prix HT *</Label>
                  <Input type="number" step="0.01" {...register("prix_unitaire_ht")} />
                </div>
                <div>
                  <Label>TVA %</Label>
                  <Input type="number" step="0.1" {...register("taux_tva")} />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Input {...register("unite")} />
                </div>
                <div>
                  <Label>Remise max %</Label>
                  <Input type="number" step="0.1" {...register("remise_max_pct")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix min HT (négo)</Label>
                  <Input type="number" step="0.01" {...register("prix_min_ht")} placeholder="Optionnel" />
                </div>
                <div>
                  <Label>Prix max HT (négo)</Label>
                  <Input type="number" step="0.01" {...register("prix_max_ht")} placeholder="Optionnel" />
                </div>
              </div>

              <div>
                <Label>Notes internes</Label>
                <Textarea {...register("notes_internes")} rows={2} placeholder="Visible uniquement en interne" />
              </div>

              <Controller
                name="est_actif"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Produit actif</Label>
                      <p className="text-xs text-muted-foreground">
                        Les produits inactifs n'apparaissent pas dans les sélections
                      </p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {produit ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
