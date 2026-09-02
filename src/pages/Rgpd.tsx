import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle } from 'lucide-react';
import {
  useRgpdTraitements,
  useRgpdDemandes,
  useRgpdViolations,
  useRgpdDpas,
  useRgpdCertifications,
  useRgpdConsentements,
  useRgpdAuditLogs,
  useRgpdKPIs,
} from '@/hooks/auth/useRgpd';
import { RgpdDashboardTab } from '@/components/rgpd/RgpdDashboardTab';
import { RgpdTraitementsTab } from '@/components/rgpd/RgpdTraitementsTab';
import { RgpdDemandesTab } from '@/components/rgpd/RgpdDemandesTab';
import { RgpdConsentementsTab } from '@/components/rgpd/RgpdConsentementsTab';
import { RgpdDpaTab } from '@/components/rgpd/RgpdDpaTab';
import { RgpdViolationsTab } from '@/components/rgpd/RgpdViolationsTab';
import { RgpdCertificationsTab } from '@/components/rgpd/RgpdCertificationsTab';
import { RgpdAuditTab } from '@/components/rgpd/RgpdAuditTab';

export default function Rgpd() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const kpis = useRgpdKPIs();
  const { data: traitements, error: errorTraitements } = useRgpdTraitements(false);
  const { data: demandes, error: errorDemandes } = useRgpdDemandes();
  const { data: violations, error: errorViolations } = useRgpdViolations();
  const { data: dpas, error: errorDpas } = useRgpdDpas(false);
  const { data: certifications, error: errorCertifications } = useRgpdCertifications(false);
  const { data: consentements, error: errorConsentements } = useRgpdConsentements();
  const { data: auditLogs, error: errorAudit } = useRgpdAuditLogs({ limit: 50 });

  const loadErrors = [
    errorTraitements && { label: 'Traitements', error: errorTraitements },
    errorDemandes && { label: 'Demandes', error: errorDemandes },
    errorViolations && { label: 'Violations', error: errorViolations },
    errorDpas && { label: 'Sous-traitants (DPA)', error: errorDpas },
    errorCertifications && { label: 'Certifications', error: errorCertifications },
    errorConsentements && { label: 'Consentements', error: errorConsentements },
    errorAudit && { label: 'Journaux d\'audit', error: errorAudit },
  ].filter(Boolean) as { label: string; error: Error }[];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            RGPD & Conformité
          </h1>
          <p className="text-muted-foreground">
            Gestion de la conformité réglementaire et protection des données
          </p>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Certaines données n'ont pas pu être chargées
            </CardTitle>
            <CardDescription>
              Vérifiez vos droits (admin + 2FA requis pour audit, demandes, consentements, violations) ou réessayez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {loadErrors.map(({ label, error }) => (
                <li key={label} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{label} :</span>{' '}
                  {error?.message || 'erreur inconnue'}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="traitements">Traitements</TabsTrigger>
          <TabsTrigger value="demandes">Droits</TabsTrigger>
          <TabsTrigger value="consentements">Consentements</TabsTrigger>
          <TabsTrigger value="dpa">Sous-traitants</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <RgpdDashboardTab kpis={kpis} />
        </TabsContent>

        <TabsContent value="traitements">
          <RgpdTraitementsTab traitements={traitements} />
        </TabsContent>

        <TabsContent value="demandes">
          <RgpdDemandesTab demandes={demandes} />
        </TabsContent>

        <TabsContent value="consentements">
          <RgpdConsentementsTab consentements={consentements} />
        </TabsContent>

        <TabsContent value="dpa">
          <RgpdDpaTab dpas={dpas} />
        </TabsContent>

        <TabsContent value="violations">
          <RgpdViolationsTab violations={violations} />
        </TabsContent>

        <TabsContent value="certifications">
          <RgpdCertificationsTab certifications={certifications} />
        </TabsContent>

        <TabsContent value="audit">
          <RgpdAuditTab auditLogs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
