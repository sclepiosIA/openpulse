import { UseFormReturn } from "react-hook-form"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2 } from "lucide-react"
import { CreatePartenaireData } from '@/lib/validations'
import { LogoUploadField } from "@/components/ui/LogoUploadField"

interface PartenaireFormProps {
  form: UseFormReturn<CreatePartenaireData>
  onSubmit: (data: CreatePartenaireData) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isLoading: boolean
  allProfiles?: Array<{
    id: string
    prenom: string
    nom: string
    role: string
  }>
}

export const PartenaireForm: React.FC<PartenaireFormProps> = ({
  form,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  allProfiles = []
}) => {
  const responsables = allProfiles.filter(p => 
    ['commercial', 'manager', 'admin'].includes(p.role)
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations de base */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Informations générales</h3>
          
          {/* Logo upload */}
          <FormField
            control={form.control}
            name="logo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo</FormLabel>
                <FormControl>
                  <LogoUploadField
                    currentLogoUrl={field.value}
                    entityType="partenaire"
                    onLogoUploaded={(url) => field.onChange(url || "")}
                    size="md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du partenaire <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du partenaire" required aria-required="true" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type_partenaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value} required>
                      <SelectTrigger aria-required="true">
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="institutionnel">Institutionnel</SelectItem>
                        <SelectItem value="industriel">Industriel</SelectItem>
                        <SelectItem value="prestataire">Prestataire</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="sous_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sous-type / Spécialité</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: ARS, Fournisseur logiciel, Consultant..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Coordonnées */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Coordonnées</h3>
          
          <FormField
            control={form.control}
            name="adresse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="Adresse complète" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="code_postal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code postal</FormLabel>
                  <FormControl>
                    <Input placeholder="Code postal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ville"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Ville" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Région</FormLabel>
                  <FormControl>
                    <Input placeholder="Région" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="Téléphone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Email principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="site_web"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site web</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Informations relationnelles */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Relation partenariale</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="statut_relation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Statut de la relation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="actif">Actif</SelectItem>
                        <SelectItem value="inactif">Inactif</SelectItem>
                        <SelectItem value="termine">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsable_marque_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsable OpenPulse</FormLabel>
                  <FormControl>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "none"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {responsables.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.prenom} {profile.nom} ({profile.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="date_debut_partenariat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date début partenariat</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date_fin_partenariat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date fin partenariat</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dernier_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dernier contact</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prochaine_action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prochaine action</FormLabel>
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
            name="valeur_partenariat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valeur du partenariat (€)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Valeur estimée en euros"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="engagement_score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Score d'engagement: {field.value}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[field.value || 0]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                    className="py-4"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notes internes sur le partenaire..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
