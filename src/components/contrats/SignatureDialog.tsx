import { useState } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSendSignature } from "@/hooks/contracts/useSignatureRequest";
import { toast } from "sonner";

interface Signer {
  name: string;
  email: string;
  role?: string;
}

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratId: string;
  contratTitre: string;
  clientNom: string;
  contactEmail?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignatureDialog({
  open,
  onOpenChange,
  contratId,
  contratTitre,
  clientNom,
  contactEmail,
}: SignatureDialogProps) {
  const [signers, setSigners] = useState<Signer[]>([
    { name: clientNom, email: contactEmail || "", role: "Client" },
  ]);
  const [expireDays, setExpireDays] = useState<number>(30);
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<{ success: boolean; message: string; signers?: Signer[] } | null>(null);

  const send = useSendSignature();

  const addSigner = () => setSigners([...signers, { name: "", email: "", role: "" }]);
  const removeSigner = (index: number) => {
    if (signers.length > 1) setSigners(signers.filter((_, i) => i !== index));
  };
  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const isValid =
    signers.every((s) => s.name.trim() && EMAIL_REGEX.test(s.email.trim())) &&
    expireDays >= 1 &&
    expireDays <= 365;

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error("Veuillez remplir tous les champs (email valide, expiration 1-365 jours)");
      return;
    }
    setResult(null);
    try {
      await send.mutateAsync({
        contratId,
        signers: signers.map((s) => ({
          name: s.name.trim(),
          email: s.email.trim().toLowerCase(),
          role: s.role?.trim() || undefined,
        })),
        message: message.trim() || undefined,
        expireDays,
      });
      setResult({
        success: true,
        message: "Demande de signature envoyée avec succès !",
        signers,
      });
    } catch (error: unknown) {
      debug.error("Erreur signature:", error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Erreur lors de l'envoi de la demande",
      });
    }
  };

  const handleClose = () => {
    if (!send.isPending) {
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Signature électronique
          </DialogTitle>
          <DialogDescription>
            Envoyer "{contratTitre}" pour signature via DocuSeal.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4">
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
            {result.success && result.signers && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Emails envoyés à :</p>
                <div className="flex flex-wrap gap-2">
                  {result.signers.map((s) => (
                    <Badge key={`signer-${s.email}`} variant="secondary" className="gap-1">
                      {s.email}
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                {signers.map((signer, index) => (
                  // stable: positional editable signer block without id
                  <div key={`signer-row-${index}`} className="p-3 border rounded-lg space-y-3 relative">
                    {signers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => removeSigner(index)}
                        disabled={send.isPending} aria-label="Supprimer">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nom *</Label>
                        <Input
                          value={signer.name}
                          onChange={(e) => updateSigner(index, "name", e.target.value)}
                          placeholder="Jean Dupont"
                          disabled={send.isPending}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={signer.email}
                          onChange={(e) => updateSigner(index, "email", e.target.value)}
                          placeholder="jean@example.com"
                          disabled={send.isPending}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rôle (optionnel)</Label>
                      <Input
                        value={signer.role || ""}
                        onChange={(e) => updateSigner(index, "role", e.target.value)}
                        placeholder="Client, Représentant légal…"
                        disabled={send.isPending}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addSigner}
                className="w-full"
                disabled={send.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un signataire
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Expiration (jours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expireDays}
                    onChange={(e) => setExpireDays(parseInt(e.target.value || "30", 10))}
                    disabled={send.isPending}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Message personnalisé (optionnel)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Bonjour, merci de bien vouloir signer ce contrat…"
                  rows={3}
                  maxLength={1000}
                  disabled={send.isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={send.isPending}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || send.isPending}>
                {send.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer ({signers.length} signataire{signers.length > 1 ? "s" : ""})
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
