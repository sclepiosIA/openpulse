import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Users, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BackfillReport {
  etablissement_id: string;
  etablissement_nom: string;
  etablissement_ville: string;
  threads_processed: number;
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  contacts_errors: number;
}

interface BackfillResult {
  success: boolean;
  message: string;
  threads_processed: number;
  etablissements_processed: number;
  total_contacts_created: number;
  total_contacts_updated: number;
  total_contacts_skipped: number;
  total_errors: number;
  report: BackfillReport[];
}

export function BackfillContactsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  const handleBackfill = async () => {
    setIsLoading(true);
    try {
      toast.info("Démarrage du backfill des contacts...");

      const data = await invokeEdge<any>("backfill-contacts-from-ai-data", {});
      setResult(data as BackfillResult);
      setShowReport(true);

      toast.success(
        `Backfill terminé : ${data.total_contacts_created} créés, ${data.total_contacts_updated} enrichis sur ${data.etablissements_processed} établissements`
      );
    } catch (error: unknown) {
      debug.error("Erreur lors du backfill:", error);
      toast.error(`Erreur : ${sanitizeSupabaseError(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleBackfill}
        disabled={isLoading}
        variant="outline"
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        Importer contacts historiques
      </Button>

      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rapport d'import des contacts</DialogTitle>
            <DialogDescription>
              Résultat de l'import automatique des contacts depuis l'historique des emails
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Résumé global */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Threads traités</p>
                  <p className="text-2xl font-bold">{result.threads_processed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Établissements</p>
                  <p className="text-2xl font-bold">{result.etablissements_processed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacts créés</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.total_contacts_created}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacts enrichis</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {result.total_contacts_updated}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacts ignorés</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {result.total_contacts_skipped}
                  </p>
                </div>
              </div>

              {result.total_errors > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive">
                    {result.total_errors} erreur(s) rencontrée(s)
                  </p>
                </div>
              )}

              {/* Détail par établissement */}
              <div>
                <h4 className="font-semibold mb-2">Détail par établissement</h4>
                <ScrollArea className="h-[400px] rounded-md border">
                  <div className="p-4 space-y-3">
                    {result.report.map((item) => (
                      <div
                        key={item.etablissement_id}
                        className="p-3 bg-card border rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.etablissement_nom}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.etablissement_ville}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {item.threads_processed} thread(s)
                          </Badge>
                        </div>

                        <div className="flex gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 font-medium">
                              {item.contacts_created}
                            </span>
                            <span className="text-muted-foreground">créés</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-medium">
                              {item.contacts_updated}
                            </span>
                            <span className="text-muted-foreground">enrichis</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-orange-600 font-medium">
                              {item.contacts_skipped}
                            </span>
                            <span className="text-muted-foreground">ignorés</span>
                          </div>
                          {item.contacts_errors > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-destructive font-medium">
                                {item.contacts_errors}
                              </span>
                              <span className="text-muted-foreground">erreurs</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowReport(false)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
