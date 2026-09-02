import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, AlertTriangle, Award, Clock, CheckCircle2 } from 'lucide-react';
import type { RgpdKPIs } from '@/types/rgpd';

interface RgpdDashboardTabProps {
  kpis: RgpdKPIs;
}

export function RgpdDashboardTab({ kpis }: RgpdDashboardTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traitements actifs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.traitements_actifs}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.traitements_sensibles} avec données sensibles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demandes de droits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.demandes_en_cours}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.demandes_en_retard > 0 && (
                <span className="text-destructive">{kpis.demandes_en_retard} en retard</span>
              )}
              {kpis.demandes_en_retard === 0 && 'Aucune en retard'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violations ouvertes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.violations_ouvertes}</div>
            <p className="text-xs text-muted-foreground">
              Nécessitent un suivi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.certifications_valides}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.certifications_expirant_bientot > 0 && (
                <span className="text-warning">{kpis.certifications_expirant_bientot} expire(nt) bientôt</span>
              )}
              {kpis.certifications_expirant_bientot === 0 && 'Toutes à jour'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>DPIA en attente</CardTitle>
            <CardDescription>
              Analyses d'impact requises mais non réalisées
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.dpia_en_attente > 0 ? (
              <div className="flex items-center gap-2 text-warning">
                <Clock className="h-5 w-5" />
                <span>{kpis.dpia_en_attente} DPIA en attente</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Toutes les DPIA sont à jour</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sous-traitants (DPA)</CardTitle>
            <CardDescription>
              Contrats de sous-traitance actifs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>DPA actifs</span>
                <Badge variant="outline">{kpis.dpa_actifs}</Badge>
              </div>
              {kpis.dpa_expirant_bientot > 0 && (
                <div className="flex items-center justify-between text-warning">
                  <span>Expirant dans 90 jours</span>
                  <Badge variant="destructive">{kpis.dpa_expirant_bientot}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
