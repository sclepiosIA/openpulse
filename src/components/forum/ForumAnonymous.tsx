import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debug } from "@/lib/debug";
import { fetchAnonymousForumPosts, fetchAnonymousForumComments, invokeForumAction, type ForumAnonymousPost, type ForumAnonymousComment } from "@/services/forum/forumPublic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { toast } from "sonner";
import { MessageSquare, ThumbsUp, Send, Loader2, AlertCircle, ArrowLeft, Sparkles, Flame, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RichTextEditor } from "@/components/email/LazyRichTextEditor";
import { SafeHtmlContent } from "@/components/forum/SafeHtmlContent";
import { ForumFilters } from "@/components/forum/ForumFilters";
import { ForumStats } from "@/components/forum/ForumStats";
import { CreatePostDialog } from "@/components/forum/CreatePostDialog";

import { ForumAvatar } from "@/components/forum/ForumAvatar";
import { ForumPost as ForumPostType } from "@/types/forum";

interface ForumPostLocal extends Omit<ForumPostType, 'user_id' | 'etablissement_id'> {
  id: string;
  titre: string;
  contenu: string;
  theme: string;
  author_nom: string | null;
  author_prenom: string | null;
  author_role?: string | null;
  author_service?: string | null;
  author_etablissement_nom: string | null;
  created_at: string;
  upvotes: number | null;
  nombre_commentaires: number | null;
}

interface ForumComment {
  id: string;
  contenu: string;
  author_nom: string | null;
  author_prenom: string | null;
  author_etablissement_nom: string | null;
  created_at: string;
  upvotes: number | null;
}

export function ForumAnonymous() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ForumPostLocal[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPostLocal | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({ titre: "", contenu: "", theme: "autre" });
  const [newComment, setNewComment] = useState("");

  const getUserData = () => {
    const userDataStr = sessionStorage.getItem("emargement_user");
    if (userDataStr) {
      try {
        return JSON.parse(userDataStr);
      } catch (e) {
        debug.error("Erreur parsing userData:", e);
      }
    }
    return null;
  };

  // READ operations remain as direct queries (public data, no sensitive structure)
  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAnonymousForumPosts();
      setPosts(data as unknown as ForumPostLocal[]);
    } catch (error) {
      debug.error("Erreur:", error);
      toast.error("Impossible de charger le forum");
    }
    setIsLoading(false);
  };

  const loadComments = async (postId: string) => {
    try {
      const data = await fetchAnonymousForumComments(postId);
      setComments(data);
    } catch (error) {
      debug.error("Erreur:", error);
      toast.error("Impossible de charger les commentaires");
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (selectedPost) {
      loadComments(selectedPost.id);
    }
  }, [selectedPost]);

  // WRITE operations via Edge Function
  const handleCreatePost = async () => {
    if (!newPost.titre || !newPost.contenu) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const userData = getUserData();
    if (!userData) {
      toast.error("Veuillez d'abord compléter votre émargement");
      return;
    }

    setIsSubmittingPost(true);

    try {
      await invokeForumAction({
        action: 'create_post',
        titre: newPost.titre,
        contenu: newPost.contenu,
        theme: newPost.theme,
        author_nom: userData.nom,
        author_prenom: userData.prenom,
        author_etablissement_nom: userData.etablissement_nom,
      });
      toast.success("Post publié !");
      setNewPost({ titre: "", contenu: "", theme: "autre" });
      loadPosts();
    } catch (error) {
      debug.error("Erreur:", error);
      toast.error("Erreur lors de la création");
    }

    setIsSubmittingPost(false);
  };

  const handleCreateComment = async () => {
    if (!newComment || !selectedPost) {
      toast.error("Veuillez écrire un commentaire");
      return;
    }

    const userData = getUserData();
    if (!userData) {
      toast.error("Veuillez d'abord compléter votre émargement");
      return;
    }

    setIsSubmittingComment(true);

    try {
      await invokeForumAction({
        action: 'create_comment',
        post_id: selectedPost.id,
        contenu: newComment,
        author_nom: userData.nom,
        author_prenom: userData.prenom,
        author_etablissement_nom: userData.etablissement_nom,
      });
      toast.success("Commentaire publié !");
      setNewComment("");
      loadComments(selectedPost.id);
      loadPosts();
    } catch {
      toast.error("Erreur");
    }

    setIsSubmittingComment(false);
  };

  const handleUpvotePost = async (postId: string) => {
    await invokeForumAction({ action: 'upvote_post', post_id: postId });
    toast.success("Vote enregistré !");
    loadPosts();
  };

  const handleUpvoteComment = async (commentId: string) => {
    await invokeForumAction({ action: 'upvote_comment', comment_id: commentId });
    toast.success("Vote enregistré !");
    if (selectedPost) loadComments(selectedPost.id);
  };

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(post => {
      counts[post.theme] = (counts[post.theme] || 0) + 1;
    });
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let filtered = posts;
    if (selectedTheme) {
      filtered = filtered.filter(post => post.theme === selectedTheme);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        post =>
          post.titre.toLowerCase().includes(term) ||
          post.contenu.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [posts, selectedTheme, searchTerm]);

  const isNewPost = (createdAt: string) => {
    const diffInHours = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  };

  const isHotPost = (post: ForumPostLocal) => {
    return (post.upvotes || 0) > 5 || (post.nombre_commentaires || 0) > 3;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedPost) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedPost(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour au forum
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{selectedPost.titre}</CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <ForumAvatar
                nom={selectedPost.author_nom ?? undefined}
                prenom={selectedPost.author_prenom ?? undefined}
                className="h-6 w-6"
              />
              <span>{selectedPost.author_prenom} {selectedPost.author_nom}</span>
              {selectedPost.author_role && (
                <>
                  <span>•</span>
                  <span>{selectedPost.author_role}</span>
                </>
              )}
              {selectedPost.author_service && (
                <>
                  <span>•</span>
                  <span>{selectedPost.author_service}</span>
                </>
              )}
              {selectedPost.author_etablissement_nom && (
                <>
                  <span>•</span>
                  <span>{selectedPost.author_etablissement_nom}</span>
                </>
              )}
              <span>•</span>
              <span>{formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true, locale: fr })}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SafeHtmlContent html={selectedPost.contenu} />
            <Separator />
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleUpvotePost(selectedPost.id)}>
                <ThumbsUp className="h-4 w-4" />
                {selectedPost.upvotes || 0}
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>{selectedPost.nombre_commentaires || 0} commentaire(s)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commentaires ({comments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <RichTextEditor content={newComment} onChange={setNewComment} placeholder="Partagez votre avis..." />
              <Button onClick={handleCreateComment} disabled={isSubmittingComment || !newComment} className="w-full gap-2">
                {isSubmittingComment ? <><Loader2 className="h-4 w-4 animate-spin" />Publication...</> : <><Send className="h-4 w-4" />Publier</>}
              </Button>
            </div>
            <Separator />
            {comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun commentaire</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <ForumAvatar
                          nom={comment.author_nom ?? undefined}
                          prenom={comment.author_prenom ?? undefined}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{comment.author_prenom} {comment.author_nom}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</span>
                          </div>
                          <SafeHtmlContent html={comment.contenu} className="text-sm" />
                          <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleUpvoteComment(comment.id)}>
                            <ThumbsUp className="h-3 w-3" />
                            {comment.upvotes || 0}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Forum de la communauté</h2>
        <p className="text-muted-foreground">Échangez avec d'autres professionnels</p>
      </div>

      <ForumStats posts={posts as ForumPostType[]} />

      <div className="flex justify-end">
        <CreatePostDialog />
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <ForumFilters selectedTheme={selectedTheme} onThemeSelect={setSelectedTheme} themeCounts={themeCounts} />
      </div>

      {filteredPosts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucun post trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/formation/post/${post.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{post.titre}</CardTitle>
                    <CardDescription className="flex items-center gap-2 flex-wrap mt-2">
                      <ForumAvatar
                        nom={post.author_nom ?? undefined}
                        prenom={post.author_prenom ?? undefined}
                        className="h-5 w-5"
                      />
                       <span>{post.author_prenom} {post.author_nom}</span>
                      {post.author_role && (
                        <>
                          <span>•</span>
                          <span>{post.author_role}</span>
                        </>
                      )}
                      {post.author_service && (
                        <>
                          <span>•</span>
                          <span>{post.author_service}</span>
                        </>
                      )}
                      {post.author_etablissement_nom && (
                        <>
                          <span>•</span>
                          <span>{post.author_etablissement_nom}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isNewPost(post.created_at) && (
                      <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />Nouveau</Badge>
                    )}
                    {isHotPost(post) && (
                      <Badge variant="destructive" className="gap-1"><Flame className="h-3 w-3" />Hot</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SafeHtmlContent html={post.contenu.substring(0, 200) + "..."} className="text-sm text-muted-foreground mb-4" />
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{post.upvotes || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>{post.nombre_commentaires || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
