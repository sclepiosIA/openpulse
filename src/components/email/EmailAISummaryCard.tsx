import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface EmailAISummaryCardProps {
  thread: {
    ai_summary?: string;
    suggested_actions?: string[];
  };
  className?: string;
}

export function EmailAISummaryCard({ thread, className }: EmailAISummaryCardProps) {
  const [showFullSummary, setShowFullSummary] = useState(false);
  const summary = sanitizeEmailSubject(thread.ai_summary || "");
  const isLongSummary = summary.length > 120;

  if (!thread.ai_summary) return null;

  return (
    <Card className={cn(
      "bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20 overflow-hidden",
      className
    )}>
      <div className="flex items-start gap-3 p-3">
        {/* AI Icon */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              Résumé IA
            </span>
            {isLongSummary && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] text-muted-foreground hover:text-foreground -mr-1 px-1"
                onClick={() => setShowFullSummary(!showFullSummary)}
              >
                {showFullSummary ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
          
          {/* Summary text */}
          <p className={cn(
            "text-sm leading-relaxed text-foreground",
            !showFullSummary && isLongSummary && "line-clamp-3"
          )}>
            {summary}
          </p>
          
          {/* Suggested actions */}
          {thread.suggested_actions && thread.suggested_actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-primary/10">
              {thread.suggested_actions.slice(0, 2).map((action: string, idx: number) => (
                <Button 
                  key={idx} 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-[10px] bg-background/50 hover:bg-primary/5 border-primary/20 hover:border-primary/40 transition-colors px-2"
                >
                  <Lightbulb className="h-2.5 w-2.5 mr-1 text-warning" />
                  <span className="truncate max-w-[120px]">{action}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
