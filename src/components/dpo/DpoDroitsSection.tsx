import { Card, CardContent } from "@/components/ui/card";
import { CharterSectionHeader } from "@/components/formations/CharterSectionHeader";
import { UserCog } from "lucide-react";
import type { DpoDroit } from "@/lib/dpo-content";

interface DpoDroitsSectionProps {
  droits: DpoDroit[];
}

export function DpoDroitsSection({ droits }: DpoDroitsSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Vos droits"
        subtitle="En tant que patient ou professionnel de santé, vous disposez de droits sur vos données personnelles"
        icon={UserCog}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {droits.map((droit) => {
          const Icon = droit.icon;
          return (
            <Card key={`droit-${droit.title}`} className="group hover:shadow-lg hover:border-marque-blue/30 transition-all duration-300">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-marque-orange/20 to-marque-orange/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-7 w-7 text-marque-orange" />
                </div>
                <h3 className="font-sofia text-lg font-bold text-marque-blue">{droit.title}</h3>
                <p className="font-titillium text-sm text-muted-foreground leading-relaxed">{droit.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
