import { useState, useEffect } from 'react'
import { debug } from '@/lib/debug'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, BarChart3 } from 'lucide-react'
import {
  useUpdateEtablissement,
  type CreateEtablissementData,
  type Etablissement,
} from '@/hooks/crm/useEtablissements'
import { useProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { CreateEtablissementSchema } from '@/lib/validations'
import { EntityLogoUpload } from '@/components/ui/EntityLogoUpload'
import {
  buildEtablissementFormDefaults,
  sanitizeEtablissementPayload,
} from './etablissementFormHelpers'
import { EtablissementAuSuccesPricing } from './EtablissementAuSuccesPricing'

interface EtablissementEditFormProps {
  etablissement: Etablissement
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EtablissementEditForm({
  etablissement,
  open,
  onOpenChange,
}: EtablissementEditFormProps) {
  const { data: allProfiles } = useProfilesWithRoles()
  const updateEtablissement = useUpdateEtablissement()
  const queryClient = useQueryClient()

  // Apporteurs d'affaires (partenaires taggés "apporteur-affaires")
  const { data: apporteursList = [] } = useQuery({
    queryKey: ['partenaires', 'apporteurs-affaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partenaires')
        .select('id, nom')
        .contains('tags', ['apporteur-affaires'])
        .order('nom')
      if (error) throw error
      return (data ?? []) as { id: string; nom: string }[]
    },
    staleTime: 5 * 60 * 1000,
  })
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(
    etablissement.logo_url || null
  )

  // Sync logo URL when etablissement changes
  useEffect(() => {
    setCurrentLogoUrl(etablissement.logo_url || null)
  }, [etablissement.logo_url])

  const handleLogoChange = (newUrl: string | null) => {
    setCurrentLogoUrl(newUrl)
    queryClient.invalidateQueries({ queryKey: ['etablissement', etablissement.id] })
  }

  const form = useForm<CreateEtablissementData>({
    resolver: zodResolver(CreateEtablissementSchema),
    mode: 'onBlur',
    defaultValues: buildEtablissementFormDefaults(etablissement),
  })

  const onSubmit = async (data: CreateEtablissementData) => {
    debug.log('🔍 Tentative de mise à jour établissement:', etablissement.nom)
    try {
      await updateEtablissement.mutateAsync({
        id: etablissement.id,
        data: sanitizeEtablissementPayload(data),
      })
      debug.log('✅ Mise à jour réussie')
      onOpenChange(false)
    } catch (error) {
      debug.error('❌ Erreur lors de la mise à jour:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'établissement</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l'établissement {etablissement.nom}
          </DialogDescription>
        </DialogHeader>

        {/* Logo upload section */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <EntityLogoUpload
            entityType="etablissement"
            entityId={etablissement.id}
            entityName={etablissement.nom}
            currentLogoUrl={currentLogoUrl}
            onLogoChange={handleLogoChange}
            size="lg"
          />
          <div>
            <p className="text-sm font-medium">Logo de l'établissement</p>
            <p className="text-xs text-muted-foreground">
              Cliquez sur l'avatar pour modifier le logo (max 2 Mo)
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              debug.error('❌ Erreurs de validation:', errors)
            })}
            className="space-y-4"
          >
            {/* Informations de base */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'établissement</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de l'établissement" {...field} />
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
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
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

            {/* Adresse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="adresse"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input placeholder="Adresse" {...field} />
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
                      <Input placeholder="Code postal" {...field} />
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
                      <Input type="email" placeholder="Email" {...field} />
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
                        value={field.value ?? ''}
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
                        <Input placeholder="Prénom" {...field} />
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
                        <Input placeholder="Nom" {...field} />
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
                        <Input type="email" placeholder="Email" {...field} />
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
                    <Input placeholder="SIREN" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contrat */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <FormField
                control={form.control}
                name="date_signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="min-h-[2.5rem] flex items-end">
                      Date de signature
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_previsionnelle_signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="min-h-[2.5rem] flex items-end">
                      Date prévisionnelle de signature
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel className="min-h-[2.5rem] flex items-end">
                      Date fin de contrat
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date de Go-Live pour les établissements en Production */}
            <FormField
              control={form.control}
              name="date_go_live"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de Go-Live</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Date de mise en production effective de l'établissement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {/* Ciblage apporteurs d'affaires */}
            <FormField
              control={form.control}
              name="apporteurs_affaires_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciblage apporteurs d'affaires</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    {apporteursList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun apporteur d'affaires disponible
                      </p>
                    ) : (
                      apporteursList.map((a) => (
                        <div key={a.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`apporteur-${a.id}`}
                            checked={field.value?.includes(a.id) || false}
                            onCheckedChange={(checked) => {
                              const current = field.value || []
                              if (checked) {
                                field.onChange([...current, a.id])
                              } else {
                                field.onChange(current.filter((id: string) => id !== a.id))
                              }
                            }}
                          />
                          <label htmlFor={`apporteur-${a.id}`} className="text-sm font-medium">
                            {a.nom}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="type_offre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type d'offre</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Statique">Statique</SelectItem>
                          <SelectItem value="Au succès">Au succès</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('type_offre') === 'Statique' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="modele_statique_succes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarif fixe (€)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Entrer le tarif fixe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {form.watch('type_offre') === 'Au succès' && (
                <EtablissementAuSuccesPricing form={form} />
              )}
            </div>

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
                            <SelectItem value="unassigned">Aucun</SelectItem>
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
                            <SelectItem value="unassigned">Aucun</SelectItem>
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
                            <SelectItem value="unassigned">Aucun</SelectItem>
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
                    <Textarea placeholder="Notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Section Statistiques - Visible uniquement pour les établissements en Production */}
            {etablissement.statut === 'Production' && (
              <>
                <Separator className="my-6" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Configuration des statistiques</h3>
                    <Badge variant="outline">Production</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    URLs des dashboards de statistiques (backend OpenPulse-IA)
                  </p>

                  <FormField
                    control={form.control}
                    name="stats_utilisation_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL - Statistiques d'utilisation</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://backend-api.exploitant.example.org/stats/?type=graph&..."
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          URL complète de l'iframe des statistiques d'utilisation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stats_urgences_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL - Activité des urgences</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://backend-api.exploitant.example.org/stats/dpi?..."
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          URL complète de l'iframe de l'activité DPI
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateEtablissement.isPending}>
                {updateEtablissement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
