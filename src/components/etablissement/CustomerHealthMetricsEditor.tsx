import { useState } from 'react'
import { debug } from '@/lib/debug'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { UpdateHealthMetricsSchema, type UpdateHealthMetricsData } from '@/lib/validations'
import { useUpdateHealthMetrics, type HealthMetrics } from '@/hooks/crm/useCustomerHealthMetrics'
import { toast } from 'sonner'

interface CustomerHealthMetricsEditorProps {
  etablissementId: string
  currentMetrics?: HealthMetrics | null
  onSuccess?: () => void
}

export function CustomerHealthMetricsEditor({
  etablissementId,
  currentMetrics,
  onSuccess,
}: CustomerHealthMetricsEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const updateMetrics = useUpdateHealthMetrics()

  const form = useForm<UpdateHealthMetricsData>({
    resolver: zodResolver(UpdateHealthMetricsSchema),
    defaultValues: {
      taux_utilisation_cotation: currentMetrics?.taux_utilisation_cotation || 0,
      taux_completion_dossier: currentMetrics?.taux_completion_dossier || 0,
      taux_uhcd_mono_rum: currentMetrics?.taux_uhcd_mono_rum || 0,
      nombre_avis_specialise: currentMetrics?.nombre_avis_specialise || 0,
      nombre_ccmu_2_plus: currentMetrics?.nombre_ccmu_2_plus || 0,
      nombre_ccmu_3_plus: currentMetrics?.nombre_ccmu_3_plus || 0,
      nps_score: currentMetrics?.nps_score || undefined,
      nps_survey_date: currentMetrics?.nps_survey_date || '',
      satisfaction_score: currentMetrics?.satisfaction_score || undefined,
      support_tickets_open: currentMetrics?.support_tickets_open || 0,
      support_tickets_closed_30d: currentMetrics?.support_tickets_closed_30d || 0,
      avg_resolution_time_hours: currentMetrics?.avg_resolution_time_hours || undefined,
      last_ticket_date: currentMetrics?.last_ticket_date || '',
      payment_status: currentMetrics?.payment_status || 'on_time',
      contract_value: currentMetrics?.contract_value || undefined,
      contract_start_date: currentMetrics?.contract_start_date || '',
      contract_end_date: currentMetrics?.contract_end_date || '',
      roi_annuel: currentMetrics?.roi_annuel || 0,
      notes: currentMetrics?.notes || '',
    },
  })

  const tauxCotation = form.watch('taux_utilisation_cotation')
  const tauxCompletion = form.watch('taux_completion_dossier')

  // Calcul automatique du taux d'adoption
  const adoptionRate =
    (tauxCotation !== undefined && tauxCompletion !== undefined)
      ? Math.round((tauxCotation + tauxCompletion) / 2)
      : 0

  const onSubmit = async (data: UpdateHealthMetricsData) => {
    try {
      setIsSubmitting(true)

      // Calculer l'adoption_rate automatiquement
      const adoption_rate = data.taux_utilisation_cotation && data.taux_completion_dossier
        ? ((data.taux_utilisation_cotation + data.taux_completion_dossier) / 2)
        : 0

      // Calculer le health_score avec les nouvelles métriques médicales
      const factorAdoption = adoption_rate * 0.30 // 30%
      
      const factorQualiteMedicale = (
        ((data.nombre_avis_specialise || 0) > 10 ? 100 : (data.nombre_avis_specialise || 0) * 10) * 0.10 +
        ((data.nombre_ccmu_2_plus || 0) > 50 ? 100 : (data.nombre_ccmu_2_plus || 0) * 2) * 0.08 +
        ((data.nombre_ccmu_3_plus || 0) > 20 ? 100 : (data.nombre_ccmu_3_plus || 0) * 5) * 0.07
      ) // 25%
      
      const factorUHCD = ((data.taux_uhcd_mono_rum || 0) * 1.0) * 0.15 // 15%
      
      const factorSupport = (
        data.support_tickets_open === 0 ? 100 : Math.max(0, 100 - data.support_tickets_open! * 10)
      ) * 0.15 // 15%
      
      const factorPaiement = (
        data.payment_status === 'on_time' ? 100 : 
        data.payment_status === 'late' ? 70 : 40
      ) * 0.10 // 10%
      
      const factorNPS = (
        data.nps_score ? (data.nps_score <= 6 ? 40 : data.nps_score <= 8 ? 75 : 100) : 70
      ) * 0.05 // 5%
      
      const bonusROI = (data.roi_annuel && data.roi_annuel > 0) ? 5 : 0 // 5% bonus

      const health_score = Math.round(
        factorAdoption +
        factorQualiteMedicale +
        factorUHCD +
        factorSupport +
        factorPaiement +
        factorNPS +
        bonusROI
      )

      const health_status =
        health_score >= 80 ? 'healthy' :
        health_score >= 60 ? 'at-risk' :
        health_score >= 40 ? 'churn-risk' : 'critical'

      await updateMetrics.mutateAsync({
        ...data,
        etablissement_id: etablissementId,
        adoption_rate,
        health_score,
        health_status,
        calculated_at: new Date().toISOString(),
      })

      toast.success('Métriques mises à jour avec succès')
      onSuccess?.()
    } catch (error) {
      debug.error('Error updating metrics:', error)
      toast.error('Erreur lors de la mise à jour des métriques')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Accordion type="multiple" defaultValue={['adoption', 'satisfaction', 'support', 'contract']} className="w-full">
          {/* Section Adoption & Qualité Médicale */}
          <AccordionItem value="adoption">
            <AccordionTrigger className="text-lg font-semibold">
              📊 Adoption & Qualité Médicale
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taux_utilisation_cotation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux d'utilisation cotation (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Pourcentage de dossiers avec cotation complète
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taux_completion_dossier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de complétion dossier (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Pourcentage de dossiers complets aux urgences
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Taux d'adoption global calculé</div>
                <div className="text-2xl font-bold">{adoptionRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Moyenne : (Cotation + Complétion) / 2
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Optimisation UHCD & Qualité</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="taux_uhcd_mono_rum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taux UHCD mono-RUM (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Taux d'UHCD avec un seul RUM
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nombre_avis_specialise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre d'avis spécialisés</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Nombre total d'avis spécialisés demandés
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nombre_ccmu_2_plus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de CCMU 2+</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Patients classés CCMU 2 et plus
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nombre_ccmu_3_plus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de CCMU 3 et +</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Patients classés CCMU 3 et au-dessus
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section Satisfaction */}
          <AccordionItem value="satisfaction">
            <AccordionTrigger className="text-lg font-semibold">
              😊 Satisfaction Client
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nps_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score NPS (0-10)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Score Net Promoter Score
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nps_survey_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date enquête NPS</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString() || '')}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="satisfaction_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score satisfaction (1-5)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Score de satisfaction global
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section Support */}
          <AccordionItem value="support">
            <AccordionTrigger className="text-lg font-semibold">
              🎫 Support & Tickets
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="support_tickets_open"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tickets ouverts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Nombre de tickets actuellement ouverts
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="support_tickets_closed_30d"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tickets résolus (30j)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avg_resolution_time_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temps résolution moyen (h)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_ticket_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date dernier ticket</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString() || '')}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section Contrat */}
          <AccordionItem value="contract">
            <AccordionTrigger className="text-lg font-semibold">
              📝 Contrat & Paiement
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut paiement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un statut" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on_time">À jour</SelectItem>
                          <SelectItem value="late">En retard</SelectItem>
                          <SelectItem value="overdue">En souffrance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valeur contrat (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date début contrat</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString() || '')}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date fin contrat</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString() || '')}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="roi_annuel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ROI Annuel (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Retour sur investissement annuel calculé
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section Notes */}
          <AccordionItem value="notes">
            <AccordionTrigger className="text-lg font-semibold">
              📝 Notes & Observations
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ajoutez des notes sur la santé client..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Notes internes sur la santé du client (max 2000 caractères)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
