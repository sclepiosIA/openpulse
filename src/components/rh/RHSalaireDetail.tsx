import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SalaireProfile {
  prenom?: string;
  nom?: string;
}

interface Salaire {
  profiles?: SalaireProfile;
  mois: string;
  salaire_brut: number;
  cotisations_salariales: number;
  cotisations_patronales: number;
  salaire_net: number;
  net_paye?: number;
  primes?: number;
  heures_supplementaires?: number;
}

interface RHSalaireDetailProps {
  salaire: Salaire;
}

export function RHSalaireDetail({ salaire }: RHSalaireDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Détail du salaire</CardTitle>
        <CardDescription>
          {salaire.profiles?.prenom} {salaire.profiles?.nom} - {salaire.mois}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Salaire brut</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.salaire_brut)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cotisations salariales (23%)</p>
            <p className="text-lg font-semibold text-red-600">
              -{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.cotisations_salariales)}
            </p>
          </div>
          {salaire.primes && (
            <div>
              <p className="text-sm text-muted-foreground">Primes</p>
              <p className="text-lg font-semibold text-green-600">
                +{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.primes)}
              </p>
            </div>
          )}
          {salaire.heures_supplementaires && (
            <div>
              <p className="text-sm text-muted-foreground">Heures supplémentaires</p>
              <p className="text-lg font-semibold text-green-600">
                +{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.heures_supplementaires)}
              </p>
            </div>
          )}
          <div className="col-span-2 pt-4 border-t">
            <p className="text-sm text-muted-foreground">Net Payé</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.net_paye || salaire.salaire_net)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Cotisations patronales (45%)</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salaire.cotisations_patronales)}
            </p>
          </div>
          <div className="col-span-2 pt-4 border-t">
            <p className="text-sm text-muted-foreground">Coût total employeur</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                salaire.salaire_brut + salaire.cotisations_patronales
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
