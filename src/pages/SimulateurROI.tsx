import { SimulatorContainer } from '@/components/simulator';

export default function SimulateurROI() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Simulateur de Valorisation des Urgences</h1>
        <p className="text-muted-foreground">
          Calculez les gains financiers liés à l'optimisation de votre taux d'UHCD
        </p>
      </div>
      <SimulatorContainer mode="standalone" />
    </div>
  );
}
