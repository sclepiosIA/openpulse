import { Card, CardContent } from '@/components/ui/card'
import { CharterSectionHeader } from '@/components/formations/CharterSectionHeader'
import { Phone, Mail, PhoneCall, HelpCircle, MapPin } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { DpoConfig } from '@/lib/dpo-content'

interface DpoContactSectionProps {
  contactDpo: DpoConfig['contactDpo']
  faq: DpoConfig['faq']
}

export function DpoContactSection({ contactDpo, faq }: DpoContactSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Contact DPO & FAQ"
        subtitle="Une question sur vos données ? Contactez notre délégué à la protection des données"
        icon={Phone}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contact card */}
        <Card className="bg-marque-grille text-white border-none">
          <CardContent className="p-8 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-card/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-sofia text-2xl font-bold mb-2">Contactez le DPO</h3>
              <p className="font-titillium text-white/70 text-sm mb-6">
                Pour toute question relative à la protection de vos données personnelles ou pour
                exercer vos droits, n'hésitez pas à nous contacter.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-white/70 shrink-0" />
                <a
                  href={`mailto:${contactDpo.email}`}
                  className="font-titillium text-white hover:text-marque-cyan transition-colors break-all"
                >
                  {contactDpo.email}
                </a>
              </div>
              {contactDpo.phone && (
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-5 w-5 text-white/70 shrink-0" />
                  <a
                    href={`tel:${contactDpo.phone.replace(/\s/g, '')}`}
                    className="font-titillium text-white hover:text-marque-cyan transition-colors"
                  >
                    {contactDpo.phone}
                  </a>
                </div>
              )}
            </div>
            {contactDpo.adresse && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-white/70 shrink-0 mt-0.5" />
                <span className="font-titillium text-sm text-white/80">{contactDpo.adresse}</span>
              </div>
            )}
            <div className="pt-4 border-t border-white/10">
              <p className="font-titillium text-xs text-white/50">
                Délai de réponse : 30 jours maximum conformément au RGPD
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-5 w-5 text-marque-blue" />
            <h3 className="font-sofia text-xl font-bold text-marque-blue">Questions fréquentes</h3>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faq.map((item, i) => (
              <AccordionItem
                key={`faq-${item.question}`}
                value={`faq-${i}`}
                className="border rounded-xl px-4 bg-card"
              >
                <AccordionTrigger className="font-titillium text-sm font-medium text-left hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="font-titillium text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </>
  )
}
