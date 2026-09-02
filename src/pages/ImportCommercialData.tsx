import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { importCommercialData } from "@/services/admin/backendTools";
import { commercialImportPayload } from "@/data/commercial-import-payload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, Building2, Users, ListTodo, Handshake } from "lucide-react";
import { ActionProgress, useActionProgress } from "@/components/shared/ActionProgress";
import { toast } from "sonner";

interface ImportReport {
  etablissements_created: number;
  etablissements_updated: number;
  contacts_created: number;
  contacts_skipped: number;
  taches_created: number;
  partenaires_created: number;
  partenaires_contacts_created: number;
  errors: string[];
}

export default function ImportCommercialData() {
  const navigate = useNavigate();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [tasksOnly, setTasksOnly] = useState(false);
  const progress = useActionProgress();

  const totalContacts = commercialImportPayload.etablissements.reduce(
    (sum, e) => sum + e.contacts.length, 0
  );
  const totalPartenaireContacts = commercialImportPayload.partenaires.reduce(
    (sum, p) => sum + p.contacts.length, 0
  );

  const handleImport = async () => {
    setIsImporting(true);
    setReport(null);
    progress.start("Importation des données commerciales en cours...");

    try {
      const data = await importCommercialData({
        etablissements: commercialImportPayload.etablissements,
        partenaires: commercialImportPayload.partenaires,
        commercial_category_id: '95f29cef-5826-4ec5-9698-43038b2e4413',
        tasks_only: tasksOnly,
      });

      if (data?.report) {
        const r = data.report as ImportReport;
        setReport(r);
        progress.complete();
        if (r.errors.length > 0) {
          toast.warning(`Import terminé avec ${r.errors.length} erreur(s)`);
        } else {
          toast.success("Import terminé avec succès !");
        }
      } else {
        throw new Error("Pas de rapport reçu");
      }
    } catch (err: any) {
      console.error("Import error:", err);
      progress.fail(err.message || "Erreur lors de l'import");
      toast.error("Erreur lors de l'import");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parametres')} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Import des données commerciales</h1>
            <p className="text-sm text-muted-foreground">
              Matrices de suivi opérationnel et actions structurantes
            </p>
          </div>
        </div>

        {/* Preview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold">{commercialImportPayload.etablissements.length}</p>
                <p className="text-xs text-muted-foreground">Établissements</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{totalContacts}</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ListTodo className="h-8 w-8 text-amber-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{commercialImportPayload.etablissements.length + commercialImportPayload.partenaires.length}</p>
                <p className="text-xs text-muted-foreground">Tâches</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Handshake className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{commercialImportPayload.partenaires.length}</p>
                <p className="text-xs text-muted-foreground">Partenaires</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Regions breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par région</CardTitle>
            <CardDescription>
              Établissements extraits des matrices de suivi commercial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                commercialImportPayload.etablissements.reduce((acc, e) => {
                  acc[e.region] = (acc[e.region] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .map(([region, count]) => (
                  <Badge key={region} variant="secondary" className="text-xs">
                    {region}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Progress */}
        <ActionProgress
          status={progress.status}
          progress={progress.progress}
          message={progress.message}
          successMessage="Import terminé avec succès !"
          errorMessage={progress.message}
        />

        {/* Import Button */}
        {!report && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tasksOnly 
                    ? "Mode tâches uniquement : seules les tâches commerciales seront créées (établissements et contacts existants utilisés)."
                    : "L'import va créer les établissements manquants, ajouter les contacts (dédupliqués par email), et générer les tâches commerciales correspondantes."}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tasksOnly}
                      onChange={(e) => setTasksOnly(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-muted-foreground">Tâches uniquement</span>
                  </label>
                </div>
                <Button
                  size="lg"
                  onClick={handleImport}
                  disabled={isImporting}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? "Import en cours..." : tasksOnly ? "Importer les tâches" : "Lancer l'import"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Rapport d'import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-green-600">{report.etablissements_created}</p>
                  <p className="text-xs text-muted-foreground">Établissements créés</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-blue-600">{report.etablissements_updated}</p>
                  <p className="text-xs text-muted-foreground">Établissements mis à jour</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-green-600">{report.contacts_created}</p>
                  <p className="text-xs text-muted-foreground">Contacts créés</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-muted-foreground">{report.contacts_skipped}</p>
                  <p className="text-xs text-muted-foreground">Contacts existants (ignorés)</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-amber-600">{report.taches_created}</p>
                  <p className="text-xs text-muted-foreground">Tâches créées</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold text-green-600">{report.partenaires_created}</p>
                  <p className="text-xs text-muted-foreground">Partenaires créés</p>
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">{report.errors.length} erreurs</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-muted/50 rounded p-3 text-xs space-y-1">
                    {report.errors.map((err, i) => (
                      <p key={`err-${i}-${err.slice(0, 30)}`} className="text-destructive">{err}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/etablissements')}>
                  Voir les établissements
                </Button>
                <Button variant="outline" onClick={() => navigate('/partenaires')}>
                  Voir les partenaires
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
