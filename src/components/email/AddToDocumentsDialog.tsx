import { useState } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { FileText, Loader2 } from "lucide-react";

interface AddToDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: {
    id: string;
    filename: string;
    content_type: string;
    storage_path?: string;
  };
  etablissementId: string;
}

const DOCUMENT_TYPES = [
  'Contrat',
  'Facture',
  'Devis',
  'Présentation',
  'Documentation technique',
  'Autre',
];

export function AddToDocumentsDialog({ open, onOpenChange, attachment, etablissementId }: AddToDocumentsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    documentType: 'Autre',
    customName: attachment.filename,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First, ensure the attachment is downloaded to storage
      if (!attachment.storage_path) {
        const { error: downloadError } = await supabase.functions.invoke('download-attachment', {
          body: { attachment_id: attachment.id },
        });

        if (downloadError) throw downloadError;
      }

      // Copy file from email-attachments to documents bucket
      const sourcePath = attachment.storage_path || `attachments/${attachment.id}/${attachment.filename}`;
      const destPath = `${etablissementId}/${Date.now()}_${formData.customName}`;

      // Download from source
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('email-attachments')
        .download(sourcePath);

      if (downloadError) throw downloadError;

      // Upload to documents bucket
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(destPath, fileData, {
          contentType: attachment.content_type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Note: Document saved to storage. Linking to tasks can be done when creating/editing tasks
      // For now, we just store it in the documents bucket with metadata in the filename

      toast({
        title: "Document ajouté",
        description: "La pièce jointe a été ajoutée aux documents de l'établissement",
      });

      onOpenChange(false);
    } catch (error: unknown) {
      debug.error('Error adding document:', error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ajouter aux documents
          </DialogTitle>
          <DialogDescription>
            Enregistrer cette pièce jointe comme document officiel de l'établissement
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="documentType">Type de document</Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, documentType: value }))}
            >
              <SelectTrigger id="documentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="customName">Nom du fichier</Label>
            <Input
              id="customName"
              value={formData.customName}
              onChange={(e) => setFormData(prev => ({ ...prev, customName: e.target.value }))}
              placeholder="Nom personnalisé"
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ajouter des notes sur ce document..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
