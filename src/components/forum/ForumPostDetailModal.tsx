import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForumPost } from "@/hooks/forum/useForumPosts";
import { ForumPostCard } from "./ForumPostCard";
import { CommentSection } from "./CommentSection";
import { incrementForumPostView } from "@/services/forum/forumViews";

interface ForumPostDetailModalProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: "public" | "internal";
}

export function ForumPostDetailModal({ 
  postId, 
  open, 
  onOpenChange,
  context = "internal" 
}: ForumPostDetailModalProps) {
  const { data: post, isLoading, error } = useForumPost(postId || "");

  // Incrémenter le compteur de vues
  useEffect(() => {
    if (postId && open) {
      incrementForumPostView(postId);
    }
  }, [postId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:!max-w-[96vw] lg:!max-w-[96vw] 2xl:!max-w-[96vw] max-h-[90vh] overflow-y-auto px-4 sm:px-8" aria-describedby={undefined}>
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold line-clamp-1 flex-1 pr-4">
              {post?.titre || "Chargement..."}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="shrink-0" aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error || (!post && !isLoading) ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Post introuvable ou erreur de chargement</p>
            </div>
          ) : null}

          {post && (
            <>
              <div className="animate-fade-in">
                <ForumPostCard post={post} context={context} />
              </div>

              <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                <CommentSection postId={postId || ""} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
