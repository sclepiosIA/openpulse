import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { Eye, EyeOff, Copy, RefreshCw, Loader2, Key, Info } from "lucide-react";
import { useState } from "react";
import { generateSecurePassword, useAdminResetPassword } from "@/hooks/auth/useAdminResetPassword";
import { useToast } from "@/hooks/shared/use-toast";
import { debug } from "@/lib/debug";
import type { ResetPasswordUser } from "@/types/ui-states";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ResetPasswordUser;
  password: string;
  onPasswordChange: (p: string) => void;
}

export function ResetPasswordDialog({ open, onOpenChange, user, password, onPasswordChange }: Props) {
  const { toast } = useToast();
  const adminResetPassword = useAdminResetPassword();
  const [showPassword, setShowPassword] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    toast({ title: "Copié !", description: "Le mot de passe a été copié dans le presse-papier" });
  };

  const handleReset = async () => {
    if (!user || !password) return;
    try {
      await adminResetPassword.mutateAsync({ userId: user.id, newPassword: password });
      onOpenChange(false);
      onPasswordChange('');
    } catch (error) {
      debug.error('Error resetting password:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Définissez un nouveau mot de passe temporaire pour {user?.prenom} {user?.nom}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nouveau mot de passe temporaire</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  minLength={8}
                  className="pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)} aria-label="Masquer">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {password && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                      onClick={handleCopy} aria-label="Copier">
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => onPasswordChange(generateSecurePassword(12))} className="shrink-0">
                <RefreshCw className="h-4 w-4 mr-1" />
                Générer
              </Button>
            </div>
            {password && <PasswordStrengthIndicator password={password} />}
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              L'utilisateur devra changer ce mot de passe à sa prochaine connexion.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleReset} disabled={adminResetPassword.isPending || !password || password.length < 8}>
            {adminResetPassword.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Réinitialisation...</>
            ) : (
              <><Key className="h-4 w-4 mr-2" />Réinitialiser</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
