import { useState } from "react";
import { SafeHtmlContent } from "./SafeHtmlContent";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PostPreviewProps {
  content: string;
  maxLines?: number;
}

export function PostPreview({ content, maxLines = 3 }: PostPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Nettoyer le HTML pour la preview
  const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const shouldTruncate = cleanText.length > 200;

  if (!shouldTruncate) {
    return (
      <div className="text-sm text-muted-foreground mt-2">
        <SafeHtmlContent html={content} className="prose-sm" />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div 
        className={`text-sm text-muted-foreground transition-all duration-300 ${
          isExpanded ? '' : 'line-clamp-3'
        }`}
      >
        {isExpanded ? (
          <SafeHtmlContent html={content} className="prose-sm" />
        ) : (
          <p>{cleanText.slice(0, 200)}...</p>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-auto p-0 text-primary hover:text-primary/80 font-medium"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Voir moins
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Lire la suite
          </>
        )}
      </Button>
    </div>
  );
}
