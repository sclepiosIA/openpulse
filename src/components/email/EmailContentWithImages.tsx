import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { sanitizeEmailHtml, sanitizeEmailText, fixMalformedEncoding } from "@/lib/emailUtils";
import { useMessageAttachments } from "@/hooks/email/useThreadImages";
import { debug } from "@/lib/debug";

interface EmailContentWithImagesProps {
  htmlContent?: string;
  textContent?: string;
  messageId?: string;
  className?: string;
}

export function EmailContentWithImages({ 
  htmlContent, 
  textContent, 
  messageId,
  className = "" 
}: EmailContentWithImagesProps) {
  const [showImages, setShowImages] = useState(true);
  const [encodingCorrected, setEncodingCorrected] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Fetch attachments to resolve CID references
  const { attachments, resolveCid, isLoading } = useMessageAttachments(messageId || '');
  
  // Check if encoding was corrected
  useEffect(() => {
    if (htmlContent) {
      const original = htmlContent;
      const fixed = fixMalformedEncoding(original);
      setEncodingCorrected(fixed !== original);
    }
  }, [htmlContent]);
  
  // Dynamically resolve CID images whenever attachments change or load
  useEffect(() => {
    if (!contentRef.current || !messageId || isLoading) return;
    
    const resolveAllCidImages = () => {
      const cidImages = contentRef.current?.querySelectorAll('img.cid-image');
      if (!cidImages || cidImages.length === 0) return;
      
      debug.log(`🖼️ Attempting to resolve ${cidImages.length} CID images`);
      let resolvedCount = 0;
      
      cidImages.forEach((img) => {
        const htmlImg = img as HTMLImageElement;
        const cid = htmlImg.getAttribute('data-cid');
        
        if (cid) {
          const resolvedUrl = resolveCid(cid);
          if (resolvedUrl) {
            debug.log(`✅ Resolved CID ${cid} to URL`);
            
            // Add loading state
            htmlImg.style.opacity = '0';
            htmlImg.style.transition = 'opacity 0.3s ease-in';
            
            // Update image source
            htmlImg.src = resolvedUrl;
            htmlImg.classList.remove('cid-image');
            htmlImg.removeAttribute('data-cid');
            htmlImg.style.display = '';
            htmlImg.style.width = '';
            htmlImg.style.maxWidth = '100%';
            htmlImg.style.height = 'auto';
            
            // Defensive error handler
            htmlImg.onerror = () => {
              htmlImg.style.display = 'none';
              htmlImg.onerror = null;
            };
            
            // Fade in when loaded
            htmlImg.onload = () => {
              htmlImg.style.opacity = '1';
            };
            
            resolvedCount++;
          } else {
            // Hide unresolved CID images instead of showing ugly placeholder
            htmlImg.style.display = 'none';
          }
        }
      });
      
      if (resolvedCount > 0) {
        debug.log(`✅ Successfully resolved ${resolvedCount} CID images`);
      }
    };
    
    resolveAllCidImages();
  }, [attachments, isLoading, messageId, resolveCid]);
  
  // External images are now loaded directly - no blocked image handling needed
  
  if (!htmlContent && !textContent) {
    return (
      <div className="text-muted-foreground italic text-sm">
        Aucun contenu disponible
      </div>
    );
  }
  
  // Prefer HTML content if available
  if (htmlContent) {
    const sanitizedHtml = sanitizeEmailHtml(htmlContent);
    // Check if sanitized HTML is effectively empty (only whitespace/&nbsp;)
    const textOnly = sanitizedHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!textOnly) {
      return (
        <div className="text-muted-foreground italic text-sm py-2">
          Le corps de cet email est vide — seul le sujet a été renseigné par l'expéditeur.
        </div>
      );
    }
    
    return (
      <div>
        {encodingCorrected && (
          <div className="mb-3">
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 h-fit text-xs opacity-70 hover:opacity-100 transition-opacity"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="sr-only sm:not-sr-only">Encodage corrigé</span>
            </Badge>
          </div>
        )}
        
        <div
          ref={contentRef}
          className={`email-content prose prose-sm max-w-none dark:prose-invert break-words ${className}`}
          // safe: sanitizedHtml is produced via DOMPurify/sanitizeEmailHtml above
          dangerouslySetInnerHTML={{
            __html: sanitizedHtml
          }}
          style={{
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
