import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrentTresorerieSolde, useProchainePaie } from "@/hooks/tresorerie/useTresorerieWidgetData";

export function RHTresorerieWidget() {
  const navigate = useNavigate();
  const { data: solde } = useCurrentTresorerieSolde();
  const { data: prochainePaie } = useProchainePaie();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trésorerie
            </CardTitle>
            <CardDescription>Vue rapide de la trésorerie</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tresorerie')}>
            Voir tout <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Solde actuel</p>
          <p className="text-2xl font-bold">
            {solde ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(solde.solde_fin || 0) : '-'}
          </p>
        </div>
        
        {prochainePaie && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">Prochaine échéance de paie</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(prochainePaie.montant)}
            </p>
            <p className="text-xs text-muted-foreground">
              Le {new Date(prochainePaie.date_prevue).toLocaleDateString('fr-FR')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
