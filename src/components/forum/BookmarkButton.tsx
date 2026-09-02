import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useToggleBookmark, useForumBookmarks } from "@/hooks/forum/useForumBookmarks";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";
import { toast } from "sonner";

interface BookmarkButtonProps {
  postId: string;
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
}

export function BookmarkButton({ postId, variant = "ghost", size = "sm" }: BookmarkButtonProps) {
  const { etablissementUser } = useEtablissementUser();
  const { data: bookmarks = [] } = useForumBookmarks();
  const toggleBookmark = useToggleBookmark();

  const isBookmarked = bookmarks.includes(postId);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!etablissementUser) {
      toast.error("Vous devez être connecté pour ajouter aux favoris");
      return;
    }

    toggleBookmark.mutate({ postId, isBookmarked });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={toggleBookmark.isPending}
      className={`gap-2 transition-all ${
        isBookmarked ? "text-yellow-500 hover:text-yellow-600" : ""
      }`}
    >
      <Star
        className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
      />
      {size !== "icon" && (isBookmarked ? "Favori" : "Favoris")}
    </Button>
  );
}
