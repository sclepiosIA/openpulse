import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Languages, Loader2, Eye, Columns2 } from "lucide-react";
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { EmailContentWithImages } from "./EmailContentWithImages";

interface BilingualEmailContentProps {
  originalHtml?: string | null;
  originalText?: string | null;
  translationText?: string | null;
  detectedLanguage?: string | null;
  messageId: string;
  className?: string;
}

const languageFlags: Record<string, { flag: string; name: string }> = {
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  de: { flag: "🇩🇪", name: "Deutsch" },
  it: { flag: "🇮🇹", name: "Italiano" },
  pt: { flag: "🇵🇹", name: "Português" },
  nl: { flag: "🇳🇱", name: "Nederlands" },
  pl: { flag: "🇵🇱", name: "Polski" },
  ru: { flag: "🇷🇺", name: "Русский" },
  zh: { flag: "🇨🇳", name: "中文" },
  ja: { flag: "🇯🇵", name: "日本語" },
  ar: { flag: "🇸🇦", name: "العربية" },
  fr: { flag: "🇫🇷", name: "Français" },
};

export function BilingualEmailContent({
  originalHtml,
  originalText,
  translationText,
  detectedLanguage,
  messageId,
  className = "",
}: BilingualEmailContentProps) {
  const [viewMode, setViewMode] = useState<"original" | "translation" | "both">(
    translationText ? "both" : "original"
  );
  const [translating, setTranslating] = useState(false);
  const [localTranslation, setLocalTranslation] = useState<string | null>(translationText || null);

  const langInfo = detectedLanguage 
    ? languageFlags[detectedLanguage] || { flag: "🌐", name: detectedLanguage.toUpperCase() }
    : null;

  const handleTranslateNow = async () => {
    if (!originalText && !originalHtml) {
      toast.error("Pas de contenu à traduire");
      return;
    }

    setTranslating(true);
    try {
      const textToTranslate = originalText || originalHtml?.replace(/<[^>]*>/g, ' ').trim();
      
      const data = await invokeEdge<any>("detect-and-translate-email", {
          message_id: messageId,
          text: textToTranslate,
          force_translate: true,
        });
      if (data.french_translation) {
        setLocalTranslation(data.french_translation);
        setViewMode("both");
        toast.success("Traduction effectuée");
      } else {
        toast.error("La traduction a échoué");
      }
    } catch (error: unknown) {
      debug.error("Translation error:", error);
      toast.error(sanitizeSupabaseError(error));
    } finally {
      setTranslating(false);
    }
  };

  const hasTranslation = !!localTranslation;
  const showTranslationNeeded = !hasTranslation && detectedLanguage && detectedLanguage !== 'fr';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with language badge and view controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {langInfo && (
            <Badge variant="secondary" className="flex items-center gap-1.5">
              <span>{langInfo.flag}</span>
              <span className="text-xs">{langInfo.name} détecté</span>
            </Badge>
          )}
          
          {showTranslationNeeded && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslateNow}
              disabled={translating}
            >
              {translating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Traduction...
                </>
              ) : (
                <>
                  <Languages className="h-3.5 w-3.5 mr-1.5" />
                  Traduire en français
                </>
              )}
            </Button>
          )}
        </div>

        {hasTranslation && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="original" className="text-xs px-2.5">
                <Eye className="h-3 w-3 mr-1" />
                Original
              </TabsTrigger>
              <TabsTrigger value="translation" className="text-xs px-2.5">
                🇫🇷 Français
              </TabsTrigger>
              <TabsTrigger value="both" className="text-xs px-2.5">
                <Columns2 className="h-3 w-3 mr-1" />
                Côte à côte
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Content display */}
      {viewMode === "both" && hasTranslation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-l-4 border-l-muted">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                {langInfo?.flag} Original ({langInfo?.name})
              </span>
            </div>
            <EmailContentWithImages
              htmlContent={originalHtml || undefined}
              textContent={originalText || undefined}
              messageId={messageId}
              className="text-sm"
            />
          </Card>

          <Card className="p-4 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <span className="text-sm font-medium text-primary flex items-center gap-1.5">
                🇫🇷 Traduction française
              </span>
            </div>
            <div 
              className="prose prose-sm max-w-none dark:prose-invert text-sm"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {localTranslation}
            </div>
          </Card>
        </div>
      ) : viewMode === "translation" && hasTranslation ? (
        <Card className="p-4 border-l-4 border-l-primary">
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {localTranslation}
          </div>
        </Card>
      ) : (
        <EmailContentWithImages
          htmlContent={originalHtml || undefined}
          textContent={originalText || undefined}
          messageId={messageId}
        />
      )}
    </div>
  );
}