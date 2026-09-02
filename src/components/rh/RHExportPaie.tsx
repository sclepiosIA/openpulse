import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRHSalaires } from "@/hooks/hr/useRHSalaires";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export function RHExportPaie() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const { salaires } = useRHSalaires(selectedMonth);

  const exportToCSV = () => {
    if (!salaires || salaires.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = [
      "Nom",
      "Prénom",
      "Email",
      "Salaire brut",
      "Cotisations patronales",
      "Cotisations salariales",
      "Primes",
      "Heures supplémentaires",
      "Salaire net",
      "Coût total"
    ];

    const rows = salaires.map(s => [
      s.profiles?.nom || "",
      s.profiles?.prenom || "",
      s.profiles?.email || "",
      s.salaire_brut.toFixed(2),
      s.cotisations_patronales.toFixed(2),
      s.cotisations_salariales.toFixed(2),
      (s.primes || 0).toFixed(2),
      (s.heures_supplementaires || 0).toFixed(2),
      s.salaire_net.toFixed(2),
      (s.salaire_brut + s.cotisations_patronales).toFixed(2)
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `salaires_${selectedMonth}.csv`;
    link.click();

    toast.success("Export CSV réussi");
  };

  const exportToExcel = () => {
    toast.info("Export Excel en cours de développement");
  };

  const generateBulletins = () => {
    toast.info("Génération des bulletins de paie en cours de développement");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exports RH</CardTitle>
          <CardDescription>Exportez les données RH pour la paie et la comptabilité</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mois à exporter</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 mt-2"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Button onClick={exportToCSV} className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exporter en CSV
            </Button>
            <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exporter en Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulletins de paie</CardTitle>
          <CardDescription>Générez les bulletins de paie pour tous les employés</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateBulletins} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Générer les bulletins de paie
          </Button>
        </CardContent>
      </Card>

      {salaires && salaires.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif {selectedMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre d'employés:</span>
                <span className="font-semibold">{salaires.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Masse salariale brute:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                    salaires.reduce((sum, s) => sum + s.salaire_brut, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Masse salariale nette:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                    salaires.reduce((sum, s) => sum + s.salaire_net, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Coût total employeur:</span>
                <span className="font-semibold text-lg">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                    salaires.reduce((sum, s) => sum + s.salaire_brut + s.cotisations_patronales, 0)
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
