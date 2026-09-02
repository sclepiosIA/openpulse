import { Card, CardContent } from "@/components/ui/card";
import { CharterSectionHeader } from "@/components/formations/CharterSectionHeader";
import { Server } from "lucide-react";
import type { DpoHebergementItem } from "@/lib/dpo-content";

interface DpoHebergementSectionProps {
  items: DpoHebergementItem[];
}

export function DpoHebergementSection({ items }: DpoHebergementSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Hébergement & Infrastructure"
        subtitle="Une infrastructure certifiée pour la protection de vos données de santé"
        icon={Server}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={`hebergement-${item.title}`} className="group hover:shadow-lg hover:border-marque-blue/30 transition-all duration-300">
              <CardContent className="p-6 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-marque-cyan/20 to-marque-blue/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-marque-blue" />
                </div>
                <div>
                  <h3 className="font-sofia text-lg font-bold text-marque-blue mb-2">{item.title}</h3>
                  <p className="font-titillium text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
