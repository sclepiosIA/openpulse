import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import { SimulatorContainer } from './SimulatorContainer';

interface SimulatorSectionProps {
  etablissementId: string;
  etablissementNom: string;
  initialPassages?: number;
  initialBaseline?: number;
  initialDPIType?: string;
  initialCenterType?: string;
}

/**
 * Wrapper component for SimulatorContainer to ensure proper mounting/unmounting
 * and stable hook order. This component should be conditionally rendered
 * instead of SimulatorContainer directly.
 */
export function SimulatorSection({
  etablissementId,
  etablissementNom,
  initialPassages,
  initialBaseline,
  initialDPIType,
  initialCenterType,
}: SimulatorSectionProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Simulateur de valorisation des urgences
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Configurez l'offre commerciale pour cet établissement
        </p>
      </CardHeader>
      <CardContent>
        <SimulatorContainer
          mode="etablissement"
          etablissementId={etablissementId}
          etablissementNom={etablissementNom}
          initialPassages={initialPassages}
          initialBaseline={initialBaseline}
          initialDPIType={initialDPIType}
          initialCenterType={initialCenterType}
        />
      </CardContent>
    </Card>
  );
}
