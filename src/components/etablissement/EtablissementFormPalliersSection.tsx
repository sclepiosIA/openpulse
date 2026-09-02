import { UseFormReturn } from 'react-hook-form'
import {
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
import type { CreateEtablissementData } from '@/hooks/crm/useEtablissements'

interface EtablissementFormPalliersSectionProps {
  form: UseFormReturn<CreateEtablissementData>
}

/**
 * Section « Type d'offre / Palliers » du formulaire de création d'un établissement.
 * Extraite de `EtablissementForm.tsx` (session 95) pour réduire la taille
 * du composant principal et faciliter la réutilisation.
 */
export function EtablissementFormPalliersSection({
  form,
}: EtablissementFormPalliersSectionProps) {
  return (
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
                      <Input
                        type="number"
                        placeholder="Entrer le tarif fixe"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {form.watch('type_offre') === 'Au succès' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pallier_vise"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallier visé</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner le pallier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pallier 1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                Pallier 1
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                Pallier 2
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                Pallier 3
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                Pallier 4
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pallier_realise"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallier réalisé</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner le pallier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pallier 1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                Pallier 1
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                Pallier 2
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                Pallier 3
                              </div>
                            </SelectItem>
                            <SelectItem value="Pallier 4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                Pallier 4
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Frais d'accès au service */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="tarifs_palliers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frais d'accès au service (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Frais d'accès unique en euros"
                          value={field.value?.fixe || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined
                            field.onChange({
                              ...field.value,
                              fixe: value,
                            })
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Seuils et tarifs des palliers */}
              <div className="space-y-2">
                <h5 className="text-sm font-semibold">Configuration des palliers</h5>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
                    <span>Pallier</span>
                    <span>Seuil (%)</span>
                    <span>Tarif (€)</span>
                  </div>
                  {['palier1', 'palier2', 'palier3', 'palier4'].map((pallierKey, index) => (
                    <div key={pallierKey} className="grid grid-cols-3 gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            index === 0
                              ? 'bg-red-500'
                              : index === 1
                                ? 'bg-orange-500'
                                : index === 2
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                          }`}
                        ></div>
                        <span className="text-sm font-medium">Pallier {index + 1}</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="seuils_palliers"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="ex: 85.5"
                                value={field.value?.[pallierKey] || ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                  field.onChange({
                                    ...field.value,
                                    [pallierKey]: value,
                                  })
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tarifs_palliers"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="ex: 5000.00"
                                value={field.value?.[pallierKey] || ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                  field.onChange({
                                    ...field.value,
                                    [pallierKey]: value,
                                  })
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
  )
}
