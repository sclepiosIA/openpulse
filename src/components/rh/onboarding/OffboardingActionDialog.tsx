import { debug } from "@/lib/debug";
import { useState } from "react";
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invokeEdge } from "@/services/edgeFunctions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";
import { supabase } from "@/integrations/supabase/client";

interface OffboardingActionDialogProps {
  profileId: string;
  profileName: string;
  onCompleted?: () => void;
}

export function OffboardingActionDialog({
  profileId,
  profileName,
  onCompleted,
}: OffboardingActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reassignTo, setReassignTo] = useState<string>("__none__");
  const [dateSortie, setDateSortie] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: profiles } = useProfilesWithRoles();
  const queryClient = useQueryClient();

  const candidates = (profiles || []).filter(
    (p) => p.id !== profileId && p.actif !== false
  );

  const expectedConfirm = `OFFBOARD ${profileName.trim().toUpperCase()}`;
  const canSubmit = confirm.trim().toUpperCase() === expectedConfirm && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // 1) Persiste motif/date dans rh_onboarding_offboarding (sans bloquer)
      try {
        await supabase
          .from("rh_onboarding_offboarding")
          .upsert(
            {
              profile_id: profileId,
              statut: "sorti",
              date_sortie: dateSortie || null,
              motif_sortie: motif || null,
            },
            { onConflict: "profile_id" }
          );
      } catch (e) {
        // non bloquant — on continue l'offboarding
        debug.warn("[offboarding] persist motif failed", e);
      }

      // 2) Appel edge function offboard-user (réassigne, désactive, supprime auth)
      const data = await invokeEdge<any>("offboard-user", {
          target_profile_id: profileId,
          reassign_to_user_id:
            reassignTo && reassignTo !== "__none__" ? reassignTo : null,
        },);
    const error = null;

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const summary = data?.summary || {};
      toast.success(`Offboarding terminé pour ${profileName}`, {
        description: `Tâches: ${summary.taches_reassigned ?? 0} • Évén.: ${
          summary.events_reassigned ?? 0
        } • Comptes email: ${summary.email_accounts_deactivated ?? 0}`,
      });

      // Invalidations
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-offboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["taches"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar_events"] }),
      ]);

      setOpen(false);
      setConfirm("");
      onCompleted?.();
    } catch (e: unknown) {
      toast.error("Échec de l'offboarding", {
        description: sanitizeSupabaseError(e) || "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <UserMinus className="h-4 w-4" />
        Offboarder ce collaborateur
      </Button>

      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-destructive" />
            Offboarding — {profileName}
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Elle réassigne les tâches et
            événements, supprime les calendriers et accès, désactive les comptes
            email et bloque la connexion.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Le profil sera marqué <strong>inactif</strong>, le compte
              d'authentification supprimé et les rôles révoqués.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="off-date">Date de sortie</Label>
            <Input
              id="off-date"
              type="date"
              value={dateSortie}
              onChange={(e) => setDateSortie(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="off-motif">Motif de sortie</Label>
            <Textarea
              id="off-motif"
              placeholder="Démission, fin de contrat, rupture conventionnelle…"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Réassigner les tâches et événements à</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Aucune réassignation (laisser vacant)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  Aucune réassignation (laisser vacant)
                </SelectItem>
                {candidates.map((p) => (
                  <SelectItem key={p.id} value={p.user_id || p.id}>
                    {p.prenom} {p.nom}
                    {p.email ? ` — ${p.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="off-confirm">
              Pour confirmer, tapez :{" "}
              <code className="text-destructive">{expectedConfirm}</code>
            </Label>
            <Input
              id="off-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={expectedConfirm}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer l'offboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
