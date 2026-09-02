import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEmployeeCertifications,
  useReferentielCertifications,
} from "@/hooks/hr/useEmployeeCertifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileOption {
  id: string;
  nom: string | null;
  prenom: string | null;
}

/**
 * Dialogue d'ajout d'une certification employé.
 * Fix audit run-full-20260618-010843 (P2) : remplace le toast "module en finalisation".
 */
export default function AddEmployeeCertificationDialog({ open, onOpenChange }: Props) {
  const { certifications, isLoading: refLoading } = useReferentielCertifications();
  const { addCertification } = useEmployeeCertifications();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profileId, setProfileId] = useState("");
  const [certificationId, setCertificationId] = useState("");
  const [dateObtention, setDateObtention] = useState(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .eq("actif", true)
        .order("nom");
      if (!cancelled && !error && data) setProfiles(data as ProfileOption[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setProfileId("");
    setCertificationId("");
    setDateObtention(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async () => {
    if (!profileId || !certificationId) {
      toast.error("Sélectionnez un employé et une certification");
      return;
    }
    try {
      await addCertification.mutateAsync({
        profile_id: profileId,
        certification_id: certificationId,
        date_obtention: dateObtention,
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast géré par le hook
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une certification</DialogTitle>
          <DialogDescription>
            Associez une certification du référentiel à un employé actif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cert-profile">Employé *</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger id="cert-profile">
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prenom} {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert-ref">Certification *</Label>
            <Select
              value={certificationId}
              onValueChange={setCertificationId}
              disabled={refLoading}
            >
              <SelectTrigger id="cert-ref">
                <SelectValue
                  placeholder={
                    refLoading ? "Chargement..." : "Sélectionner une certification"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {certifications.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                    {c.organisme ? ` — ${c.organisme}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert-date">Date d'obtention</Label>
            <Input
              id="cert-date"
              type="date"
              value={dateObtention}
              onChange={(e) => setDateObtention(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addCertification.isPending || !profileId || !certificationId}
          >
            {addCertification.isPending ? "Ajout..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
