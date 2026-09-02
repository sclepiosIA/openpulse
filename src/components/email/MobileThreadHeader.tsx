import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Reply, MoreVertical, Sparkles, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileThreadHeaderProps {
  thread: any;
  onBack: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onArchive: () => void;
  onMarkSpam: () => void;
  isArchiving?: boolean;
}

export function MobileThreadHeader({
  thread,
  onBack,
  onReply,
  onReplyAll,
  onArchive,
  onMarkSpam,
  isArchiving
}: MobileThreadHeaderProps) {
  const [showFullSummary, setShowFullSummary] = useState(false);
  const title = sanitizeEmailSubject(thread.ai_generated_title || thread.subject);
  const summary = sanitizeEmailSubject(thread.ai_summary || "");
  const isLongSummary = summary.length > 80;

  return (
    <div className="space-y-3">
      {/* Header compact */}
      <div className="flex items-start gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="flex-shrink-0 h-9 w-9 -ml-2" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-base font-semibold leading-tight line-clamp-2 break-words hyphens-auto">
            {title}
          </h1>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onReply}
            className="h-9 w-9" aria-label="Répondre">
            <Reply className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Plus d'options">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReplyAll}>
                Répondre à tous
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive} disabled={isArchiving}>
                {thread.is_archived ? "Désarchiver" : "Archiver"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMarkSpam}>
                {thread.is_spam ? "Retirer du spam" : "Marquer spam"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Badges - ligne 1: statut, ligne 2: entité */}
      <div className="flex flex-wrap gap-1.5">
        {thread.category && (
          <Badge variant="secondary" className="text-xs">
            {thread.category}
          </Badge>
        )}
        {thread.priority === "high" && (
          <Badge variant="destructive" className="text-xs">
            Priorité haute
          </Badge>
        )}
        {thread.is_archived && (
          <Badge variant="outline" className="text-xs">
            Archivé
          </Badge>
        )}
        {thread.account?.email_address && (
          <Badge variant="outline" className="text-xs truncate max-w-[150px]">
            {thread.account.email_address}
          </Badge>
        )}
      </div>

      {/* Résumé IA amélioré avec Card et gradient */}
      {thread.ai_summary && (
        <Card 
          className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-primary/20 overflow-hidden cursor-pointer"
          onClick={() => setShowFullSummary(!showFullSummary)}
        >
          <div className="flex items-start gap-2.5 p-3">
            {/* Icône IA avec animation */}
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                  Résumé IA
                </span>
                {isLongSummary && (
                  <span className="text-muted-foreground">
                    {showFullSummary ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                )}
              </div>
              
              {/* Texte du résumé */}
              <p className={`text-sm text-foreground leading-relaxed ${!showFullSummary ? 'line-clamp-2' : ''}`}>
                {summary}
              </p>
              
              {/* Actions suggérées (visible quand expanded) */}
              {showFullSummary && thread.suggested_actions?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-primary/10">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Actions suggérées
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {thread.suggested_actions.map((action: string, idx: number) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs bg-background/50 border-primary/20 py-1"
                      >
                        <Lightbulb className="h-3 w-3 mr-1 text-amber-500" />
                        <span className="truncate max-w-[150px]">{action}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
