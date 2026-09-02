import { useState, useEffect } from "react";
import { useForumPosts, useVotePost } from "@/hooks/forum/useForumPosts";
import { ForumPostCard } from "./ForumPostCard";
import { CreatePostDialog } from "./CreatePostDialog";
import { ForumSortFilter, SortOption } from "./ForumSortFilter";
import { ForumStatsPanel } from "./ForumStatsPanel";
import { ForumSkeleton } from "./ForumSkeleton";
import { ScrollToTop } from "./ScrollToTop";
import { ForumPostDetailModal } from "./ForumPostDetailModal";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";

interface ForumModernProps {
  context?: "public" | "internal";
}

export function ForumModern({ context = "internal" }: ForumModernProps) {
  const { etablissementUser } = useEtablissementUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem("forum-sort") as SortOption) || "recent";
  });
  
  const { data: posts, isLoading } = useForumPosts({ 
    theme: selectedTheme || undefined,
    sortBy 
  });
  const votePost = useVotePost();

  const { ref: bottomRef, inView } = useInView();

  // Sauvegarder la préférence de tri
  useEffect(() => {
    localStorage.setItem("forum-sort", sortBy);
  }, [sortBy]);

  // Filtrer les posts par recherche
  const filteredPosts = posts?.filter(post => {
    const searchLower = searchTerm.toLowerCase();
    return (
      post.titre.toLowerCase().includes(searchLower) ||
      post.contenu.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleVote = async (postId: string) => {
    await votePost.mutateAsync({ postId });
  };

  const handleComment = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handleOpenDetail = (postId: string) => {
    setSelectedPostId(postId);
  };

  const themeOptions = [
    { value: "", label: "Tous les thèmes" },
    { value: "pmsi", label: "PMSI" },
    { value: "smr", label: "SMR" },
    { value: "urgences", label: "Urgences" },
    { value: "completion_dossier", label: "Complétion dossier" },
    { value: "dictee_vocale", label: "Dictée vocale" },
    { value: "astuces", label: "Astuces" },
    { value: "bugs", label: "Bugs" },
    { value: "support", label: "Support" },
    { value: "autre", label: "Autre" },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Contenu principal */}
        <div className="flex-1 space-y-6">
          {/* Header avec recherche et filtres */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-4 border-b">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans le forum..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="px-4 py-2 rounded-md border bg-background text-foreground text-sm hover:bg-muted transition-colors"
              >
                {themeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

          <ForumSortFilter value={sortBy} onChange={setSortBy} />

          <CreatePostDialog />
            </div>
          </div>

          {/* Liste des posts */}
          {isLoading ? (
            <ForumSkeleton />
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucun post trouvé</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {filteredPosts.map((post, index) => (
              <div
                key={post.id}
                className="cursor-pointer"
                onClick={() => handleOpenDetail(post.id)}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <ForumPostCard
                  post={post as any}
                  onVote={handleVote}
                  onComment={handleComment}
                  onOpenDetail={handleOpenDetail}
                  context={context}
                />
              </div>
                ))}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={bottomRef} className="h-20 flex items-center justify-center">
                {inView && filteredPosts.length >= 20 && (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar stats (desktop uniquement) */}
        <aside className="hidden lg:block w-80 shrink-0">
          <ForumStatsPanel />
        </aside>
      </div>

      {/* Modal pour les détails du post */}
      <ForumPostDetailModal 
        postId={selectedPostId}
        open={!!selectedPostId}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
        context={context}
      />

      <ScrollToTop />
    </div>
  );
}
