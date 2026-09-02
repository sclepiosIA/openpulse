import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Languages, Check, Copy } from "lucide-react";

interface TranslationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  onUseTranslation: () => void;
  onUseBoth: () => void;
}

const languageNames: Record<string, { flag: string; name: string }> = {
  en: { flag: "🇬🇧", name: "Anglais" },
  es: { flag: "🇪🇸", name: "Espagnol" },
  de: { flag: "🇩🇪", name: "Allemand" },
  it: { flag: "🇮🇹", name: "Italien" },
  pt: { flag: "🇵🇹", name: "Portugais" },
  fr: { flag: "🇫🇷", name: "Français" },
};

export function TranslationPreviewDialog({
  open,
  onOpenChange,
  originalText,
  translatedText,
  targetLanguage,
  onUseTranslation,
  onUseBoth,
}: TranslationPreviewDialogProps) {
  const langInfo = languageNames[targetLanguage] || { flag: "🌐", name: targetLanguage.toUpperCase() };

  const sanitizedOriginal = useMemo(() => DOMPurify.sanitize(originalText), [originalText]);
  const sanitizedTranslated = useMemo(() => DOMPurify.sanitize(translatedText), [translatedText]);

  const handleUseTranslation = () => {
    onUseTranslation();
    onOpenChange(false);
  };

  const handleUseBoth = () => {
    onUseBoth();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[98vw] !max-w-[1600px] sm:!w-[98vw] sm:!max-w-[1600px] max-h-[88vh] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Prévisualisation de la traduction
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original French */}
          <Card className="p-4 border-l-4 border-l-muted">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                🇫🇷 Français (original)
              </span>
            </div>
            <ScrollArea className="h-[300px]">
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-sm pr-4"
                // safe: sanitizedOriginal is produced via DOMPurify earlier in this component
                dangerouslySetInnerHTML={{ __html: sanitizedOriginal }}
              />
            </ScrollArea>
          </Card>

          {/* Translation */}
          <Card className="p-4 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <span className="text-sm font-medium text-primary flex items-center gap-1.5">
                {langInfo.flag} {langInfo.name} (traduction)
              </span>
            </div>
            <ScrollArea className="h-[300px]">
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-sm pr-4"
                // safe: sanitizedTranslated is produced via DOMPurify earlier in this component
                dangerouslySetInnerHTML={{ __html: sanitizedTranslated }}
              />
            </ScrollArea>
          </Card>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="secondary" onClick={handleUseBoth}>
            <Copy className="h-4 w-4 mr-2" />
            Garder les deux versions
          </Button>
          <Button onClick={handleUseTranslation}>
            <Check className="h-4 w-4 mr-2" />
            Utiliser la traduction uniquement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}