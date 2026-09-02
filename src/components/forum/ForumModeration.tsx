import { useState } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useForumPostsForModeration,
  useMaskForumPost,
  useDeleteForumPost,
  useApproveForumPost,
  useArchiveForumPost,
} from "@/hooks/forum/useForumModeration";
import { Shield, Trash2, CheckCircle, Archive, AlertCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ForumPost } from "@/types/forum";
import { SafeHtmlContent } from "./SafeHtmlContent";

export function ForumModeration() {
  const { data: posts, isLoading } = useForumPostsForModeration();
  const maskPost = useMaskForumPost();
  const deletePost = useDeleteForumPost();
  const approvePost = useApproveForumPost();
  const archivePost = useArchiveForumPost();

  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [action, setAction] = useState<'mask' | 'delete' | 'approve' | 'archive' | null>(null);
  const [moderationReason, setModerationReason] = useState("");

  const handleAction = async () => {
    if (!selectedPost) return;

    try {
      switch (action) {
        case 'mask':
          await maskPost.mutateAsync({ postId: selectedPost.id, reason: moderationReason });
          break;
        case 'delete':
          await deletePost.mutateAsync(selectedPost.id);
          break;
        case 'approve':
          await approvePost.mutateAsync(selectedPost.id);
          break;
        case 'archive':
          await archivePost.mutateAsync(selectedPost.id);
          break;
      }
      setAction(null);
      setSelectedPost(null);
      setModerationReason("");
    } catch (error) {
      debug.error('Error performing action:', error);
    }
  };

  const openActionDialog = (post: ForumPost, actionType: 'mask' | 'delete' | 'approve' | 'archive') => {
    setSelectedPost(post);
    setAction(actionType);
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  const allPosts = posts || [];
  const moderatedPosts = allPosts.filter(p => p.modere);
  const activePosts = allPosts.filter(p => !p.modere && !p.archive);
  const archivedPosts = allPosts.filter(p => p.archive);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Modération du Forum
          </CardTitle>
          <CardDescription>
            Gérer les posts du forum de formation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">
                Actifs ({activePosts.length})
              </TabsTrigger>
              <TabsTrigger value="moderated">
                Modérés ({moderatedPosts.length})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archivés ({archivedPosts.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                Tous ({allPosts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <PostsList 
                posts={activePosts} 
                onAction={openActionDialog}
                showActions={['mask', 'archive', 'delete']}
              />
            </TabsContent>

            <TabsContent value="moderated">
              <PostsList 
                posts={moderatedPosts} 
                onAction={openActionDialog}
                showActions={['approve', 'delete']}
              />
            </TabsContent>

            <TabsContent value="archived">
              <PostsList 
                posts={archivedPosts} 
                onAction={openActionDialog}
                showActions={['delete']}
              />
            </TabsContent>

            <TabsContent value="all">
              <PostsList 
                posts={allPosts} 
                onAction={openActionDialog}
                showActions={['mask', 'approve', 'archive', 'delete']}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'mask' && "Masquer ce post ?"}
              {action === 'delete' && "Supprimer définitivement ce post ?"}
              {action === 'approve' && "Approuver ce post ?"}
              {action === 'archive' && "Archiver ce post ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'delete' && "Cette action est irréversible. Le post sera supprimé définitivement."}
              {action === 'mask' && "Le post sera masqué pour les utilisateurs mais restera visible pour les modérateurs."}
              {action === 'approve' && "Le post redeviendra visible pour tous les utilisateurs."}
              {action === 'archive' && "Le post sera archivé et ne sera plus visible dans le forum principal."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {action === 'mask' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Raison de la modération (optionnel)</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Contenu inapproprié, spam, etc."
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PostsListProps {
  posts: ForumPost[];
  onAction: (post: ForumPost, action: 'mask' | 'delete' | 'approve' | 'archive') => void;
  showActions: Array<'mask' | 'delete' | 'approve' | 'archive'>;
}

function PostsList({ posts, onAction, showActions }: PostsListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun post dans cette catégorie
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Card key={post.id} className={post.modere ? "border-destructive" : ""}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <CardTitle className="text-lg">{post.titre}</CardTitle>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Par {post.author_prenom} {post.author_nom}</span>
                  {post.author_role && <span>• {post.author_role}</span>}
                  {post.author_service && <span>• {post.author_service}</span>}
                  {post.author_etablissement_nom && <span>• {post.author_etablissement_nom}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{post.theme}</Badge>
                  <Badge variant="outline">{post.visibilite}</Badge>
                  {post.modere && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Modéré
                    </Badge>
                  )}
                  {post.archive && (
                    <Badge variant="secondary" className="gap-1">
                      <Archive className="h-3 w-3" />
                      Archivé
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(post.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {showActions.includes('approve') && post.modere && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction(post, 'approve')}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approuver
                  </Button>
                )}
                {showActions.includes('mask') && !post.modere && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction(post, 'mask')}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Masquer
                  </Button>
                )}
                {showActions.includes('archive') && !post.archive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction(post, 'archive')}
                    className="gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archiver
                  </Button>
                )}
                {showActions.includes('delete') && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onAction(post, 'delete')}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SafeHtmlContent 
              html={post.contenu}
              className="text-foreground"
            />
            {post.modere && post.raison_moderation && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm font-medium text-destructive">Raison de la modération :</p>
                <p className="text-sm text-muted-foreground mt-1">{post.raison_moderation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
