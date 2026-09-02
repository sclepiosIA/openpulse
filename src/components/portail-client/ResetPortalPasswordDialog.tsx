import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, KeyRound } from "lucide-react";
import { useResetClientPortalPassword } from "@/hooks/portail/useClientPortal";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  userEmail?: string;
}

export function ResetPortalPasswordDialog({ open, onOpenChange, userId, userEmail }: Props) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reset = useResetClientPortalPassword();

  useEffect(() => {
    if (!open) {
      setTempPassword(null);
      setCopied(false);
    }
  }, [open]);

  const handleReset = async () => {
    if (!userId) return;
    const res = await reset.mutateAsync(userId);
    setTempPassword(res.temp_password);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {userEmail ? <>Compte : <strong>{userEmail}</strong></> : "Génère un nouveau mot de passe temporaire."}
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Nouveau mot de passe</AlertTitle>
              <AlertDescription>
                À communiquer au client. Il ne sera plus visible après fermeture.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input value={tempPassword} readOnly className="font-mono" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Valider">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleReset} disabled={reset.isPending || !userId}>
              {reset.isPending ? "Génération..." : "Générer un nouveau mot de passe"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
