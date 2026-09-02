import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { useToggleReaction, useReactionCounts } from "@/hooks/forum/useForumReactions";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

const EMOJI_OPTIONS = ['👍', '❤️', '😄', '🎉', '🚀'] as const;

interface EmojiReactionPickerProps {
  targetId: string;
  targetType: 'post' | 'comment';
  compact?: boolean;
}

export function EmojiReactionPicker({ targetId, targetType, compact = false }: EmojiReactionPickerProps) {
  const { user } = useAuth();
  const { etablissementUser } = useEtablissementUser();
  const { data: reactionCounts } = useReactionCounts(targetId, targetType);
  const toggleReaction = useToggleReaction();
  const [open, setOpen] = useState(false);

  // Utiliser etablissementUser.id si disponible, sinon user.id
  const currentUserId = etablissementUser?.id || user?.id;

  const handleReaction = async (emoji: string) => {
    if (!currentUserId) {
      toast.error("Vous devez être connecté pour réagir");
      return;
    }

    try {
      await toggleReaction.mutateAsync({
        targetId,
        targetType,
        emoji,
        userId: currentUserId,
      });
      setOpen(false);
    } catch (error) {
      debug.error('Error toggling reaction:', error);
      toast.error("Erreur lors de la réaction");
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Afficher les réactions existantes */}
      {reactionCounts && Object.entries(reactionCounts).map(([emoji, count]) => (
        count > 0 && (
          <Button
            key={emoji}
            variant="ghost"
            size={compact ? "sm" : "default"}
            onClick={() => handleReaction(emoji)}
            className="gap-1 hover:scale-110 transition-transform"
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-xs text-muted-foreground">{count}</span>
          </Button>
        )
      ))}

      {/* Picker pour ajouter une nouvelle réaction */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size={compact ? "sm" : "default"}
            className="gap-2 hover:scale-110 transition-transform"
          >
            <Smile className="h-4 w-4" />
            {!compact && <span className="text-xs">Réagir</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => handleReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-2"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
