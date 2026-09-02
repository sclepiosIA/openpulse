import { sanitizeEmailHtml, sanitizeEmailText } from "@/lib/emailUtils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, FileText } from "lucide-react";

interface EmailContentProps {
  htmlContent?: string;
  textContent?: string;
  className?: string;
}

export function EmailContent({ htmlContent, textContent, className = "" }: EmailContentProps) {
  const [showExternalImages, setShowExternalImages] = useState(false);
  const [showPlainText, setShowPlainText] = useState(false);
  if (!htmlContent && !textContent) {
    return (
      <div className="text-muted-foreground italic text-sm">
        Aucun contenu disponible
      </div>
    );
  }

  // Show plain text mode if toggled or no HTML
  if (showPlainText || !htmlContent) {
    return (
      <div>
        {htmlContent && (
          <div className="mb-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlainText(false)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Afficher en HTML
            </Button>
          </div>
        )}
        <div
          className={`email-content text-sm break-words whitespace-pre-wrap ${className}`}
          // safe: sanitizeEmailText escapes plain-text content before HTML injection
          dangerouslySetInnerHTML={{
            __html: sanitizeEmailText(textContent || '')
          }}
        />
      </div>
    );
  }

  // Prefer HTML content if available
  if (htmlContent) {
    const sanitizedHtml = sanitizeEmailHtml(htmlContent);
    const hasBlockedImages = sanitizedHtml.includes('data-original-src');

    return (
      <div>
        {hasBlockedImages && !showExternalImages && (
          <div className="mb-3 p-3 bg-muted/50 rounded-md flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              🖼️ Les images externes sont bloquées pour votre sécurité
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExternalImages(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Afficher les images
            </Button>
          </div>
        )}
        <div className="flex gap-2 mb-2">
          {textContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlainText(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Texte brut
            </Button>
          )}
          {showExternalImages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExternalImages(false)}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Masquer les images
            </Button>
          )}
        </div>
        <div
          className={`email-content prose prose-sm max-w-none dark:prose-invert break-words ${className}`}
          // safe: sanitizedHtml is produced via sanitizeEmailHtml (DOMPurify) above
          dangerouslySetInnerHTML={{
            __html: showExternalImages
              ? sanitizedHtml.replace(/data-original-src="([^"]*)"/g, 'src="$1"')
              : sanitizedHtml
          }}
          style={{
            // Ensure images fit within container
            '--tw-prose-body': 'hsl(var(--foreground))',
            '--tw-prose-headings': 'hsl(var(--foreground))',
            '--tw-prose-links': 'hsl(var(--primary))',
          } as React.CSSProperties}
        />
      </div>
    );
  }

  // Fallback to text content
  return (
    <div
      className={`email-content text-sm break-words ${className}`}
      // safe: sanitizeEmailText escapes plain-text content before HTML injection
      dangerouslySetInnerHTML={{
        __html: sanitizeEmailText(textContent || '')
      }}
    />
  );
}
