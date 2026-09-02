import { Card, CardContent } from "@/components/ui/card";
import { CharterSectionHeader } from "@/components/formations/CharterSectionHeader";
import { Shield } from "lucide-react";
import type { DpoEngagement } from "@/lib/dpo-content";

interface DpoEngagementsSectionProps {
  engagements: DpoEngagement[];
}

export function DpoEngagementsSection({ engagements }: DpoEngagementsSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Nos engagements RGPD"
        subtitle="OpenPulse s'engage à respecter les plus hauts standards de protection des données de santé"
        icon={Shield}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {engagements.map((engagement) => {
          const Icon = engagement.icon;
          return (
            <Card key={`engagement-${engagement.title}`} className="group hover:shadow-lg hover:border-marque-blue/30 transition-all duration-300">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-marque-cyan/20 to-marque-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-7 w-7 text-marque-blue" />
                </div>
                <h3 className="font-sofia text-lg font-bold text-marque-blue">{engagement.title}</h3>
                <p className="font-titillium text-sm text-muted-foreground leading-relaxed">{engagement.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
