import { useState } from "react";
import { useForm } from "react-hook-form";
import { debug } from "@/lib/debug";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { useRHSalaires } from "@/hooks/hr/useRHSalaires";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeMonthToDate } from "@/lib/dateUtils";

const formSchema = z.object({
  profile_id: z.string().min(1, "Veuillez sélectionner un employé"),
  mois: z.string().min(1, "Veuillez sélectionner un mois"),
  salaire_brut: z.coerce.number().min(0, "Le salaire doit être positif"),
  primes: z.coerce.number().min(0).optional(),
  heures_supplementaires: z.coerce.number().min(0).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddSalaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddSalaireDialog({ open, onOpenChange, onSuccess }: AddSalaireDialogProps) {
  const { data: profiles } = useProfilesWithRoles();
  const { createSalaire } = useRHSalaires();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      salaire_brut: 0,
      primes: 0,
      heures_supplementaires: 0,
    },
  });

  const salaireBrut = form.watch("salaire_brut") || 0;
  const primes = form.watch("primes") || 0;
  const heuresSupp = form.watch("heures_supplementaires") || 0;

  // Calculs automatiques
  const cotisationsSalariales = salaireBrut * 0.23;
  const cotisationsPatronales = salaireBrut * 0.45;
  const salaireNet = salaireBrut - cotisationsSalariales + primes + heuresSupp;

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Normaliser le mois au format YYYY-MM-01 (protection robuste)
      const moisNormalized = normalizeMonthToDate(data.mois);
      
      await createSalaire({
        profile_id: data.profile_id,
        mois: moisNormalized,
        salaire_brut: data.salaire_brut,
        salaire_net: salaireNet,
        cotisations_salariales: cotisationsSalariales,
        cotisations_patronales: cotisationsPatronales,
        primes: data.primes || 0,
        heures_supplementaires: data.heures_supplementaires || 0,
        source_type: 'manual',
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      debug.error("Erreur lors de la création du salaire:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un salaire manuellement</DialogTitle>
          <DialogDescription>
            Créer une nouvelle entrée de salaire pour un employé
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="profile_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employé</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un employé" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.prenom} {profile.nom} {profile.fonction ? `- ${profile.fonction}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mois"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mois</FormLabel>
                  <FormControl>
                    <Input type="month" {...field} />
                  </FormControl>
                  <FormDescription>
                    Format: YYYY-MM (ex: 2025-01)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaire_brut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salaire brut (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primes (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heures_supplementaires"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heures supplémentaires (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Preview du calcul */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Aperçu du calcul</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salaire brut</span>
                  <span className="font-medium">{salaireBrut.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cotisations salariales (23%)</span>
                  <span className="font-medium text-destructive">- {cotisationsSalariales.toFixed(2)} €</span>
                </div>
                {primes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primes</span>
                    <span className="font-medium text-green-600">+ {primes.toFixed(2)} €</span>
                  </div>
                )}
                {heuresSupp > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Heures supplémentaires</span>
                    <span className="font-medium text-green-600">+ {heuresSupp.toFixed(2)} €</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Salaire net</span>
                  <span className="text-primary">{salaireNet.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cotisations patronales (45%)</span>
                  <span>{cotisationsPatronales.toFixed(2)} €</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Création..." : "Créer le salaire"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
