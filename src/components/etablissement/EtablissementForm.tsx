import { UseFormReturn } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { CreateEtablissementData } from '@/hooks/crm/useEtablissements'
import { LogoUploadField } from '@/components/ui/LogoUploadField'
import { CsrfToken } from '@/components/security/CsrfToken'
import { EtablissementFormPalliersSection } from './EtablissementFormPalliersSection'

interface EtablissementFormProps {
  form: UseFormReturn<CreateEtablissementData>
  onSubmit: (data: CreateEtablissementData) => Promise<void>
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

export const EtablissementForm: React.FC<EtablissementFormProps> = ({
  form,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  allProfiles = [],
}) => {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <CsrfToken />
        {/* Message informatif */}
        <div className="bg-muted rounded-md p-3 text-sm">
          <p className="text-muted-foreground">
            Les champs marqués d'un <span className="text-destructive font-semibold">*</span> sont
            obligatoires.
          </p>
        </div>

        {/* Logo upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Logo</label>
          <LogoUploadField
            currentLogoUrl={form.watch('logo_url') as string | undefined}
            entityType="etablissement"
            onLogoUploaded={(url) => form.setValue('logo_url', url || '')}
            size="md"
          />
        </div>

        {/* Résumé des erreurs */}
        {Object.keys(form.formState.errors).length > 0 && (
          <div className="bg-destructive/10 border border-destructive rounded-md p-4">
            <h4 className="font-semibold text-destructive mb-2">
              Veuillez corriger les erreurs suivantes :
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
              {form.formState.errors.nom && <li>{form.formState.errors.nom.message}</li>}
              {form.formState.errors.ville && <li>{form.formState.errors.ville.message}</li>}
              {form.formState.errors.region && <li>{form.formState.errors.region.message}</li>}
              {form.formState.errors.type && <li>{form.formState.errors.type.message}</li>}
              {form.formState.errors.date_prise_contact && (
                <li>{form.formState.errors.date_prise_contact.message}</li>
              )}
              {form.formState.errors.email && <li>{form.formState.errors.email.message}</li>}
              {form.formState.errors.directeur_general_email && (
                <li>{form.formState.errors.directeur_general_email.message}</li>
              )}
              {form.formState.errors.nombre_passages_urgences_annuel && (
                <li>{form.formState.errors.nombre_passages_urgences_annuel.message}</li>
              )}
            </ul>
          </div>
        )}

        {/* Informations de base */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Nom de l'établissement <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nom de l'établissement"
                    maxLength={255}
                    {...field}
                    className={
                      form.formState.errors.nom
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Type <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={
                        form.formState.errors.type
                          ? 'border-destructive focus-visible:ring-destructive'
                          : ''
                      }
                    >
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CH">CH</SelectItem>
                      <SelectItem value="GHT">GHT</SelectItem>
                      <SelectItem value="CHU">CHU</SelectItem>
                      <SelectItem value="ESPIC">ESPIC</SelectItem>
                      <SelectItem value="Privé">Privé</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Localisation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ville"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Ville <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ville"
                    {...field}
                    className={
                      form.formState.errors.ville
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }
                  />
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
                <FormLabel>
                  Région <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Région"
                    {...field}
                    className={
                      form.formState.errors.region
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Pays */}
        <FormField
          control={form.control}
          name="pays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pays</FormLabel>
              <FormControl>
                <Input placeholder="Pays" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Adresse */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="adresse"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="Adresse" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code_postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code postal</FormLabel>
                <FormControl>
                  <Input placeholder="Code postal" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input placeholder="Téléphone" {...field} value={field.value || ''} />
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
                  <Input type="email" placeholder="Email" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Informations spécifiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre_passages_urgences_annuel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passages aux urgences annuel</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={1000000}
                    placeholder="Nombre de passages"
                    value={field.value || ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dpi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DPI</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le DPI" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hopital Manager">Hopital Manager</SelectItem>
                      <SelectItem value="ORBIS">ORBIS</SelectItem>
                      <SelectItem value="Care4U">Care4U</SelectItem>
                      <SelectItem value="Easily">Easily</SelectItem>
                      <SelectItem value="Axigate">Axigate</SelectItem>
                      <SelectItem value="ResUrgences">ResUrgences</SelectItem>
                      <SelectItem value="Terminal Urgences">Terminal Urgences</SelectItem>
                      <SelectItem value="Sillage">Sillage</SelectItem>
                      <SelectItem value="Cerner">Cerner</SelectItem>
                      <SelectItem value="UrQual">UrQual</SelectItem>
                      <SelectItem value="TrakCare">TrakCare</SelectItem>
                      <SelectItem value="DxCare">DxCare</SelectItem>
                      <SelectItem value="Xtreme Santé">Xtreme Santé</SelectItem>
                      <SelectItem value="M-Crossway">M-Crossway</SelectItem>
                      <SelectItem value="Mediburn">Mediburn</SelectItem>
                      <SelectItem value="Maincare">Maincare</SelectItem>
                      <SelectItem value="Autre Lourd">Autre Lourd</SelectItem>
                      <SelectItem value="Autre Web">Autre Web</SelectItem>
                      <SelectItem value="Inconnu">Inconnu</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* DPI Portail Client */}
        <FormField
          control={form.control}
          name="dpi_portail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DPI Portail Client</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || 'hm'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la plateforme du portail" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hm">HM (Hôpital Manager)</SelectItem>
                    <SelectItem value="resurgences">Résurgences</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Détermine la plateforme de formation/roadmap affichée au client dans son espace
                portail.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Directeur général */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Directeur général</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="directeur_general_prenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="Prénom" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="directeur_general_nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="directeur_general_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Email" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* SIREN */}
        <FormField
          control={form.control}
          name="siren_client"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SIREN client</FormLabel>
              <FormControl>
                <Input placeholder="SIREN" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contrat */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <FormField
            control={form.control}
            name="date_prise_contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="min-h-[2.5rem] flex items-end">
                  Date de prise de contact <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    className={
                      form.formState.errors.date_prise_contact
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date_signature"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="min-h-[2.5rem] flex items-end">Date de signature</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <FormField
            control={form.control}
            name="date_previsionnelle_signature"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="min-h-[2.5rem] flex items-end">
                  Date prévisionnelle de signature
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date_fin_contrat"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="min-h-[2.5rem] flex items-end">Date fin de contrat</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Statut étendu */}
        <FormField
          control={form.control}
          name="statut"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Statut</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le statut" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="Prospect">Prospect</SelectItem>
                    <SelectItem value="Refus">Refus</SelectItem>
                    <SelectItem value="Reporté">Reporté</SelectItem>
                    <SelectItem value="Bloqué">Bloqué</SelectItem>
                    <SelectItem value="Contacté">Contacté</SelectItem>
                    <SelectItem value="Attente RDV">Attente RDV</SelectItem>
                    <SelectItem value="RDV pris">RDV pris</SelectItem>
                    <SelectItem value="Attente post RDV">Attente post RDV</SelectItem>
                    <SelectItem value="Dans les RDV">Dans les RDV</SelectItem>
                    <SelectItem value="Etude émise">Etude émise</SelectItem>
                    <SelectItem value="Dans les RDV post EME">Dans les RDV post EME</SelectItem>
                    <SelectItem value="Négociation">Négociation</SelectItem>
                    <SelectItem value="Contractualisation">Contractualisation</SelectItem>
                    <SelectItem value="Vendu">Vendu</SelectItem>
                    <SelectItem value="Contractuel">Contractuel</SelectItem>
                    <SelectItem value="Conformité">Conformité</SelectItem>
                    <SelectItem value="Déploiement">Déploiement</SelectItem>
                    <SelectItem value="Formation">Formation</SelectItem>
                    <SelectItem value="Go-Live">Go-Live</SelectItem>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Modules proposés */}
        <FormField
          control={form.control}
          name="modules_proposes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modules proposés</FormLabel>
              <div className="flex flex-wrap gap-4">
                {['Urgences', 'MCO', 'SMR'].map((module) => (
                  <div key={module} className="flex items-center space-x-2">
                    <Checkbox
                      id={module}
                      checked={field.value?.includes(module) || false}
                      onCheckedChange={(checked) => {
                        const currentModules = field.value || []
                        if (checked) {
                          field.onChange([...currentModules, module])
                        } else {
                          field.onChange(currentModules.filter((m) => m !== module))
                        }
                      }}
                    />
                    <label htmlFor={module} className="text-sm font-medium">
                      {module}
                    </label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type d'offre + palliers — extrait dans EtablissementFormPalliersSection (session 95) */}
        <EtablissementFormPalliersSection form={form} />

        {/* Équipe */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Équipe assignée</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="commercial_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commercial</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {allProfiles
                          ?.filter((p) => p.role === 'commercial')
                          .map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.prenom} {profile.nom}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chef_projet_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chef de projet</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {allProfiles
                          ?.filter((p) => p.role === 'chef_projet')
                          .map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.prenom} {profile.nom}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="csm_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSM</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {allProfiles
                          ?.filter((p) => p.role === 'csm')
                          .map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.prenom} {profile.nom}
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
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Notes..." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
