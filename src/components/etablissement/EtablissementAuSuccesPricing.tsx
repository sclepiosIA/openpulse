import { UseFormReturn } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CreateEtablissementData } from '@/hooks/crm/useEtablissements'

interface Props {
  form: UseFormReturn<CreateEtablissementData>
}

const PALLIER_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'] as const
const PALLIER_KEYS = ['palier1', 'palier2', 'palier3', 'palier4'] as const

function PallierSelect({ form, name, label }: { form: UseFormReturn<CreateEtablissementData>; name: 'pallier_vise' | 'pallier_realise'; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le pallier" />
              </SelectTrigger>
              <SelectContent>
                {PALLIER_COLORS.map((color, i) => (
                  <SelectItem key={i} value={`Pallier ${i + 1}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      Pallier {i + 1}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function EtablissementAuSuccesPricing({ form }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PallierSelect form={form} name="pallier_vise" label="Pallier visé" />
        <PallierSelect form={form} name="pallier_realise" label="Pallier réalisé" />
      </div>

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
                  value={(field.value as any)?.fixe ?? ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      field.onChange({ ...(field.value as any), fixe: parseFloat(e.target.value) })
                    } else {
                      const next = { ...(field.value as any) }
                      delete next.fixe
                      field.onChange(Object.keys(next).length > 0 ? next : undefined)
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-semibold">Configuration des palliers</h5>
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
            <span>Pallier</span>
            <span>Seuil (%)</span>
            <span>Tarif (€)</span>
          </div>
          {PALLIER_KEYS.map((pallierKey, index) => (
            <div key={pallierKey} className="grid grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${PALLIER_COLORS[index]}`} />
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
                        value={(field.value as any)?.[pallierKey] ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            field.onChange({ ...(field.value as any), [pallierKey]: parseFloat(e.target.value) })
                          } else {
                            const next = { ...(field.value as any) }
                            delete next[pallierKey]
                            field.onChange(Object.keys(next).length > 0 ? next : undefined)
                          }
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
                        value={(field.value as any)?.[pallierKey] ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            field.onChange({ ...(field.value as any), [pallierKey]: parseFloat(e.target.value) })
                          } else {
                            const next = { ...(field.value as any) }
                            delete next[pallierKey]
                            field.onChange(Object.keys(next).length > 0 ? next : undefined)
                          }
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
  )
}
