/**
 * Carte Groupe/GHT extraite de `EmailThread.tsx` (session 101).
 * Affichée uniquement quand le thread est rattaché à un groupe contenant
 * plusieurs établissements. Liste les établissements + progression + tâches restantes.
 */
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2 } from "lucide-react";

interface EtabSummary {
  id: string;
  nom: string;
  ville?: string | null;
  progression?: number | null;
  taches?: Array<{ statut: string; titre: string; echeance: string }>;
}

interface Props {
  groupeNom: string | null;
  groupeId: string | null;
  etablissementsGroupe: EtabSummary[];
}

export function EmailThreadGroupeCard({ groupeNom, groupeId, etablissementsGroupe }: Props) {
  const navigate = useNavigate();
  const avgProgression = Math.round(
    etablissementsGroupe.reduce((sum, e) => sum + (e.progression || 0), 0) /
      etablissementsGroupe.length,
  );
  const totalTaches = etablissementsGroupe.reduce(
    (sum, e) => sum + (e.taches?.filter((t) => t.statut !== "Terminé").length || 0),
    0,
  );

  return (
    <Card className="mt-3 p-3 bg-primary/5 border-primary/20">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">
              {groupeNom} ({etablissementsGroupe.length} étab.)
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate(`/groupes/${groupeId}`)}
          >
            Voir le groupe
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            Progression: {avgProgression}%
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {totalTaches} tâches
          </Badge>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {etablissementsGroupe.map((etab) => {
            const nextTask = etab.taches
              ?.filter((t) => t.statut === "A faire")
              .sort(
                (a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime(),
              )[0];

            return (
              <AccordionItem key={etab.id} value={etab.id}>
                <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                  <div className="flex items-center gap-2 flex-1 text-left">
                    <span className="font-medium">{etab.nom}</span>
                    {etab.ville && (
                      <span className="text-muted-foreground text-[10px]">({etab.ville})</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1.5 pl-2 pt-1 text-xs">
                    {etab.progression !== null && etab.progression !== undefined && (
                      <div className="flex items-center gap-2">
                        <Progress value={etab.progression || 0} className="h-1 flex-1" />
                        <span className="text-muted-foreground">{etab.progression}%</span>
                      </div>
                    )}
                    {nextTask && (
                      <p className="text-muted-foreground truncate">📌 {nextTask.titre}</p>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[10px]"
                      onClick={() => navigate(`/etablissements/${etab.id}`)}
                    >
                      Voir la fiche →
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </Card>
  );
}
