import { useEffect } from "react";
import { debug } from "@/lib/debug";
import { useForm } from "react-hook-form";
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
import { useUpdateProfile } from "@/hooks/profile/useProfiles";
import { ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles";
import { toast } from "sonner";

const formSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  email: z.string().email("Email invalide"),
  fonction: z.string().optional(),
  role: z.enum(["admin", "csm", "chef_projet", "commercial"]),
  date_embauche: z.string().optional(),
  type_contrat: z.enum(["cdi", "cdd", "remuneration_dirigeant", "interim", "freelance"]),
  actif: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileWithRole;
}

export function EditEmployeeDialog({
  open,
  onOpenChange,
  profile,
}: EditEmployeeDialogProps) {
  const updateProfile = useUpdateProfile();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: profile.nom,
      prenom: profile.prenom,
      email: profile.email,
      fonction: profile.fonction || "",
      role: profile.role as any,
      date_embauche: profile.date_embauche || undefined,
      type_contrat: profile.type_contrat || "cdi",
      actif: profile.actif,
    },
  });

  // Réinitialiser le formulaire quand le profil change ou que le dialogue s'ouvre
  useEffect(() => {
    if (open) {
      form.reset({
        nom: profile.nom,
        prenom: profile.prenom,
        email: profile.email,
        fonction: profile.fonction || "",
        role: profile.role as any,
        date_embauche: profile.date_embauche || undefined,
        type_contrat: profile.type_contrat || "cdi",
        actif: profile.actif,
      });
    }
  }, [profile.id, open, form, profile.nom, profile.prenom, profile.email, profile.fonction, profile.role, profile.date_embauche, profile.type_contrat, profile.actif]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        data: data,
      });

      toast.success("Employé mis à jour avec succès");
      onOpenChange(false);
    } catch (error) {
      debug.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour de l'employé");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier l'employé</DialogTitle>
          <DialogDescription>
            Modifier les informations de {profile.prenom} {profile.nom}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fonction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poste / Fonction</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Ex: Directeur général, Développeur, CSM..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle système (permissions)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="csm">CSM</SelectItem>
                        <SelectItem value="chef_projet">Chef de Projet</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actif"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "true")}
                      value={field.value ? "true" : "false"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Actif</SelectItem>
                        <SelectItem value="false">Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Informations RH
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date_embauche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'entrée</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type_contrat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de contrat</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cdi">CDI</SelectItem>
                          <SelectItem value="cdd">CDD</SelectItem>
                          <SelectItem value="remuneration_dirigeant">
                            Rémunération de dirigeant
                          </SelectItem>
                          <SelectItem value="interim">Intérimaire</SelectItem>
                          <SelectItem value="freelance">Freelance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateProfile.isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
