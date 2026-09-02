import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { useForumPost } from "@/hooks/forum/useForumPosts";
import { ForumPostCard } from "@/components/forum/ForumPostCard";
import { CommentSection } from "@/components/forum/CommentSection";
import { incrementForumPostView } from "@/services/forum/forumViews";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/forum/ScrollToTop";
import { PageDataState } from "@/components/common/PageDataState";

interface ForumPostDetailProps {
  context?: "public" | "internal";
}

export default function ForumPostDetail({ context = "internal" }: ForumPostDetailProps) {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading, isError, error, refetch } = useForumPost(postId || "");

  // Incrémenter le compteur de vues
  useEffect(() => {
    if (postId) {
      void incrementForumPostView(postId);
    }
  }, [postId]);

  if (isLoading || isError || !post) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!isLoading && !isError && !post}
        emptyTitle="Post introuvable"
        emptyDescription="Le post demandé n'existe pas ou a été supprimé."
        onRetry={() => refetch()}
      >
        <></>
      </PageDataState>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 space-y-6 max-w-5xl">
        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(context === "public" ? '/formation#forum' : '/forum-moderation')}
            className="gap-2 hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            {context === "public" ? "Espace Formation" : "Forum"}
          </Button>
          <span>/</span>
          <span className="text-foreground font-medium line-clamp-1">
            {post.titre}
          </span>
        </nav>

        <Button 
          variant="outline" 
          onClick={() => {
            if (context === "public") {
              navigate('/formation#forum');
            } else {
              navigate(-1);
            }
          }} 
          className="gap-2 hover:scale-105 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="animate-fade-in [animation-delay:100ms]">
          <ForumPostCard post={post as any} context={context} />
        </div>

        <div className="animate-fade-in [animation-delay:200ms]">
          <CommentSection postId={postId || ""} />
        </div>
        
        <ScrollToTop />
      </div>
    </ErrorBoundary>
  );
}
