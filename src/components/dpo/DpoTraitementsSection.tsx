import { CharterSectionHeader } from "@/components/formations/CharterSectionHeader";
import { ScrollText } from "lucide-react";
import type { DpoTraitement } from "@/lib/dpo-content";

interface DpoTraitementsSectionProps {
  traitements: DpoTraitement[];
}

export function DpoTraitementsSection({ traitements }: DpoTraitementsSectionProps) {
  return (
    <>
      <CharterSectionHeader
        title="Registre des traitements"
        subtitle="Transparence complète sur les finalités et les bases légales de nos traitements"
        icon={ScrollText}
      />
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-marque-blue text-white">
              <th className="text-left px-4 py-3 font-sofia font-semibold">Finalité</th>
              <th className="text-left px-4 py-3 font-sofia font-semibold">Base légale</th>
              <th className="text-left px-4 py-3 font-sofia font-semibold">Catégories de données</th>
              <th className="text-left px-4 py-3 font-sofia font-semibold">Durée de conservation</th>
            </tr>
          </thead>
          <tbody>
            {traitements.map((t, i) => (
              <tr key={`traitement-row-${t.finalite}`} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                <td className="px-4 py-3 font-titillium font-medium text-foreground">{t.finalite}</td>
                <td className="px-4 py-3 font-titillium text-muted-foreground">{t.baseLegale}</td>
                <td className="px-4 py-3 font-titillium text-muted-foreground">{t.categories}</td>
                <td className="px-4 py-3 font-titillium text-muted-foreground">{t.conservation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {traitements.map((t) => (
          <div key={`traitement-card-${t.finalite}`} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h4 className="font-sofia font-bold text-marque-blue">{t.finalite}</h4>
            <div className="grid grid-cols-1 gap-1 text-sm font-titillium">
              <div><span className="text-muted-foreground">Base légale : </span><span className="text-foreground">{t.baseLegale}</span></div>
              <div><span className="text-muted-foreground">Données : </span><span className="text-foreground">{t.categories}</span></div>
              <div><span className="text-muted-foreground">Conservation : </span><span className="text-foreground">{t.conservation}</span></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
