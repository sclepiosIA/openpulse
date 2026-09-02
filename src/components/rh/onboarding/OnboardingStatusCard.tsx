import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { OnboardingOffboardingData } from "@/hooks/tasks/useOnboardingOffboarding";

interface OnboardingStatusCardProps {
  data: OnboardingOffboardingData;
  profileName: string;
  completionRate: number;
}

const STATUS_CONFIG = {
  en_cours: { label: "En cours", className: "bg-orange-500" },
  actif: { label: "Actif", className: "bg-green-500" },
  sortie_prevue: { label: "Sortie prévue", className: "bg-yellow-500" },
  sorti: { label: "Sorti", className: "bg-gray-500" }
};

export function OnboardingStatusCard({ data, profileName, completionRate }: OnboardingStatusCardProps) {
  const statusConfig = STATUS_CONFIG[data.statut];
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-xl">{profileName}</CardTitle>
              <Badge className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Complétude</div>
            <div className="text-2xl font-bold text-foreground">{completionRate}%</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={completionRate} className="h-2" />
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          {data.date_entree && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Date d'entrée</div>
                <div className="font-medium">
                  {format(new Date(data.date_entree), "dd MMMM yyyy", { locale: fr })}
                </div>
              </div>
            </div>
          )}
          
          {data.date_sortie && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Date de sortie</div>
                <div className="font-medium">
                  {format(new Date(data.date_sortie), "dd MMMM yyyy", { locale: fr })}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {data.motif_sortie && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground">Motif de sortie</div>
            <div className="text-sm">{data.motif_sortie}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
