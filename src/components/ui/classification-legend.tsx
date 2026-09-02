import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PartenaireBadge } from "./partenaire-badge";
import { GroupeBadge } from "./groupe-badge";
import { EmailEtablissementBadge } from "@/components/email/EmailEtablissementBadge";

export function ClassificationLegend() {
  return (
    <Card className="p-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Code couleur des classifications</CardTitle>
        <CardDescription>
          Chaque type d'entité a une couleur dédiée pour faciliter l'identification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Établissement */}
          <div className="flex items-center gap-3">
            <EmailEtablissementBadge 
              etablissementId="demo" 
              etablissementNom="Établissement" 
              size="sm"
              showLink={false}
            />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Vert :</span> Établissement de santé
            </span>
          </div>

          {/* Groupes */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <GroupeBadge type="GHT" nom="Groupe GHT" showIcon={true} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Bleu :</span> Groupe public (GHT)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <GroupeBadge type="Groupe Cliniques" nom="Groupe Cliniques" showIcon={true} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Violet :</span> Groupe privé (Cliniques)
              </span>
            </div>
          </div>

          {/* Partenaires */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-3">
              <PartenaireBadge type="institutionnel" nom="ARS" size="sm" showLink={false} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Indigo :</span> Partenaire institutionnel
              </span>
            </div>
            <div className="flex items-center gap-3">
              <PartenaireBadge type="industriel" nom="Fournisseur" size="sm" showLink={false} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Orange :</span> Partenaire industriel
              </span>
            </div>
            <div className="flex items-center gap-3">
              <PartenaireBadge type="prestataire" nom="Consultant" size="sm" showLink={false} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Ambre :</span> Partenaire prestataire
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
