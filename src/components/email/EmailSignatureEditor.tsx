import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { updateProfileEmailSignature } from "@/services/profile/profileMutations";
import { Save, Loader2, Code, Eye } from "lucide-react";
import { cleanEmailSignature, sanitizeEmailHtml } from "@/lib/emailUtils";

interface EmailSignatureEditorProps {
  profileId: string;
  initialSignature?: string;
  onSaved?: () => void;
}

export function EmailSignatureEditor({ profileId, initialSignature, onSaved }: EmailSignatureEditorProps) {
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load and decode HTML signature
  useEffect(() => {
    if (initialSignature) {
      const decoded = cleanEmailSignature(initialSignature);
      setSignature(decoded);
    } else {
      setSignature("");
    }
  }, [initialSignature]);

  const handleSave = async () => {
    if (!signature.trim()) {
      toast({
        title: "Erreur",
        description: "La signature ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfileEmailSignature(profileId, signature);

      toast({
        title: "Signature enregistrée",
        description: "Votre signature email a été mise à jour avec succès",
      });

      onSaved?.();
    } catch (error: unknown) {
      debug.error("Save signature error:", error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature email</CardTitle>
        <CardDescription>
          Personnalisez votre signature qui sera automatiquement ajoutée à tous vos emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Code HTML
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Aperçu
            </TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="mt-3">
            <Textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Collez ou écrivez votre signature HTML ici..."
              className="font-mono text-sm min-h-[300px] resize-y"
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-3">
            <div className="overflow-auto min-h-[300px] max-h-[500px] border rounded-md bg-background p-4">
              {signature ? (
              <div className="email-signature-wrapper">
                <div
                  // safe: sanitizeEmailHtml strips dangerous tags/attrs via DOMPurify
                  dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(signature) }}
                />
              </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Aucune signature à afficher
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer la signature
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}