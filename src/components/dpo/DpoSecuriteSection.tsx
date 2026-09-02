import { Card, CardContent } from "@/components/ui/card";
import { CharterSectionHeader } from "@/components/formations/CharterSectionHeader";
import { Lock } from "lucide-react";
import type { DpoSecuriteItem } from "@/lib/dpo-content";

interface DpoSecuriteSectionProps {
  items: DpoSecuriteItem[];
}

export function DpoSecuriteSection({ items }: DpoSecuriteSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Mesures de sécurité"
        subtitle="Des mesures techniques et organisationnelles de pointe pour protéger vos données"
        icon={Lock}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={`securite-${item.title}`} className="group hover:shadow-lg hover:border-marque-blue/30 transition-all duration-300 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-marque-cyan to-marque-blue" />
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-marque-cyan/20 to-marque-blue/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-marque-blue" />
                </div>
                <h3 className="font-sofia text-lg font-bold text-marque-blue">{item.title}</h3>
                <p className="font-titillium text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
