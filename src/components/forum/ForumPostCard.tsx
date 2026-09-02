import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbsUp, MessageCircle, Eye, AlertCircle, Trash2, Shield, Pencil, CheckCircle, Star } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useMaskForumPost, useDeleteForumPost, useIsForumModerator } from "@/hooks/forum/useForumModeration";
import { useDeleteOwnPost, useToggleResolved } from "@/hooks/forum/useForumPosts";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";
import { useIsTeamMember } from "@/hooks/hr/useTeamMember";
import { EditPostDialog } from "./EditPostDialog";
import { ForumAvatar } from "./ForumAvatar";
import { PostBadges } from "./PostBadges";
import { PostPreview } from "./PostPreview";
import { EmojiReactionPicker } from "./EmojiReactionPicker";
import { UserProfileHoverCard } from "./UserProfileHoverCard";
import { toast } from "sonner";
import { fetchForumPostAuthorIsTeamMember } from "@/services/forum/forumPublic";

interface ForumPost {
  id: string;
  user_id?: string | null;
  titre: string;
  contenu: string;
  theme: string;
  author_nom?: string | null;
  author_prenom?: string | null;
  author_role?: string | null;
  author_service?: string | null;
  author_etablissement_nom?: string | null;
  upvotes: number | null;
  nombre_commentaires: number | null;
  nombre_vues: number | null;
  visibilite: string;
  etablissement_id?: string | null;
  resolu?: boolean | null;
  modere?: boolean | null;
  raison_moderation?: string | null;
  created_at: string;
  // Allow additional props from DB
  [key: string]: unknown;
}

interface ForumPostCardProps {
  post: ForumPost;
  onVote?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onOpenDetail?: (postId: string) => void;
  context?: "public" | "internal";
}

export function ForumPostCard({ post, onVote, onComment, onOpenDetail, context = "internal" }: ForumPostCardProps) {
  const [moderationReason, setModerationReason] = useState("");
  const [showModerationDialog, setShowModerationDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAuthorDeleteDialog, setShowAuthorDeleteDialog] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isPostAuthorTeamMember, setIsPostAuthorTeamMember] = useState(false);
  
  const { data: isModerator } = useIsForumModerator();
  const { data: isTeamMember } = useIsTeamMember();
  const { etablissementUser } = useEtablissementUser();
  const maskPost = useMaskForumPost();
  const deletePost = useDeleteForumPost();
  const deleteOwnPost = useDeleteOwnPost();
  const toggleResolved = useToggleResolved();
  
  const isAuthor = etablissementUser?.id === post.user_id;

  // Vérifier si l'auteur du post est membre de l'équipe OpenPulse
  useEffect(() => {
    const checkPostAuthorTeamMember = async () => {
      if (!post.user_id) {
        setIsPostAuthorTeamMember(false);
        return;
      }

      const isTeamMember = await fetchForumPostAuthorIsTeamMember(post.user_id);
      setIsPostAuthorTeamMember(isTeamMember);
    };

    checkPostAuthorTeamMember();
  }, [post.user_id]);

  const handleMask = async () => {
    await maskPost.mutateAsync({ postId: post.id, reason: moderationReason });
    setShowModerationDialog(false);
    setModerationReason("");
    toast.success("Post masqué avec succès");
  };

  const handleDelete = async () => {
    await deletePost.mutateAsync(post.id);
    setShowDeleteDialog(false);
    toast.success("Post supprimé avec succès");
  };

  const handleAuthorDelete = async () => {
    await deleteOwnPost.mutateAsync({ 
      postId: post.id, 
      isTeamMember: isTeamMember || false,
      context: context
    });
    setShowAuthorDeleteDialog(false);
    toast.success("Post supprimé avec succès");
  };

  const handleToggleResolved = async () => {
    await toggleResolved.mutateAsync({ postId: post.id, resolu: !post.resolu });
    toast.success(post.resolu ? "Post marqué comme non résolu" : "Post marqué comme résolu");
  };

  const handleVote = async () => {
    if (isVoting) return;
    setIsVoting(true);
    
    try {
      if (onVote) {
        await onVote(post.id);
        toast.success("Vote enregistré !");
      }
    } finally {
      setTimeout(() => setIsVoting(false), 300);
    }
  };

  const themeLabels: Record<string, string> = {
    pmsi: "PMSI",
    smr: "SMR",
    urgences: "Urgences",
    completion_dossier: "Complétion dossier",
    dictee_vocale: "Dictée vocale",
    astuces: "Astuces",
    bugs: "Bugs",
    support: "Support",
    autre: "Autre"
  };

  const themeColors: Record<string, string> = {
    pmsi: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    smr: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    urgences: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    completion_dossier: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    dictee_vocale: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    astuces: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    bugs: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    support: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
    autre: "bg-gray-500/10 text-foreground dark:text-muted-foreground border-gray-500/20"
  };

  return (
    <Card 
      className={`
        ${post.modere ? "border-destructive/50" : "border-border"} 
        transition-all duration-300 hover:shadow-lg hover:scale-[1.01]
        group animate-fade-in
      `}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            {/* Badges ligne supérieure */}
            <div className="flex flex-wrap gap-2">
              <PostBadges
                createdAt={post.created_at}
                upvotes={post.upvotes ?? 0}
                commentsCount={post.nombre_commentaires ?? 0}
                views={post.nombre_vues ?? 0}
              />
              <Badge 
                variant="secondary" 
                className={themeColors[post.theme] || themeColors.autre}
              >
                {themeLabels[post.theme] || post.theme}
              </Badge>
              <Badge variant="outline">
                {post.visibilite === 'global' ? 'Public' : 'Établissement'}
              </Badge>
              {post.resolu && (
                <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-3 w-3" />
                  Résolu
                </Badge>
              )}
              {post.modere && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Modéré
                </Badge>
              )}
            </div>

            {/* Titre */}
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {post.titre}
            </CardTitle>

            {/* Preview du contenu */}
            <PostPreview content={post.contenu} />

            {/* Auteur avec avatar et hover card */}
            <UserProfileHoverCard
              userId={post.user_id}
              nom={post.author_nom}
              prenom={post.author_prenom}
              role={post.author_role}
              service={post.author_service}
              etablissement={post.author_etablissement_nom}
            >
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <ForumAvatar 
                  nom={post.author_nom ?? undefined} 
                  prenom={post.author_prenom ?? undefined}
                  className="h-10 w-10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-foreground font-medium">
                    <span className="truncate">
                      {post.author_prenom} {post.author_nom}
                    </span>
                    {isPostAuthorTeamMember ? (
                      <Badge variant="default" className="text-xs bg-gradient-to-r from-primary to-primary/80">
                        <Star className="w-3 h-3 mr-1" />
                        OpenPulse
                      </Badge>
                    ) : post.author_role && (
                      <span className="text-muted-foreground">• {post.author_role}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {!isPostAuthorTeamMember && post.author_service && <span>{post.author_service}</span>}
                    {post.author_etablissement_nom && (
                      <span>{!isPostAuthorTeamMember && post.author_service ? '•' : ''} {post.author_etablissement_nom}</span>
                    )}
                    <span>
                      • {format(new Date(post.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                </div>
              </div>
            </UserProfileHoverCard>
          </div>

          {isAuthor && !post.modere && !(context === "public" && isTeamMember) && (
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToggleResolved}
                disabled={toggleResolved.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {post.resolu ? "Non résolu" : "Marquer résolu"}
              </Button>
              <AlertDialog open={showAuthorDeleteDialog} onOpenChange={setShowAuthorDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir supprimer ce post ? Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAuthorDelete}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {isModerator && (
            <div className="flex gap-2">
              {!post.modere && (
                <AlertDialog open={showModerationDialog} onOpenChange={setShowModerationDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Masquer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Masquer ce post ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le post sera masqué pour les utilisateurs mais restera visible pour les modérateurs.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-4">
                      <Label htmlFor="reason">Raison de la modération (optionnel)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Ex: Contenu inapproprié, spam, etc."
                        value={moderationReason}
                        onChange={(e) => setModerationReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMask}>Confirmer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer définitivement ce post ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le post sera supprimé définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardHeader>

      {post.modere && post.raison_moderation && (
        <div className="mx-6 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">
            <strong>Raison de la modération :</strong> {post.raison_moderation}
          </p>
        </div>
      )}

      <CardContent>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleVote}
            disabled={isVoting}
            className={`
              gap-2 transition-all duration-200
              ${isVoting ? 'scale-110' : 'hover:scale-105'}
              hover:text-primary hover:bg-primary/5
            `}
          >
            <ThumbsUp className={`h-4 w-4 ${isVoting ? 'animate-bounce' : ''}`} />
            <span className="font-medium">{post.upvotes}</span>
          </Button>

          <EmojiReactionPicker targetId={post.id} targetType="post" compact />

          <button
            onClick={() => onComment?.(post.id)}
            className="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">{post.nombre_commentaires}</span>
          </button>

          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium">{post.nombre_vues}</span>
          </div>
        </div>
      </CardContent>
      
      <EditPostDialog 
        post={{
          id: post.id,
          titre: post.titre,
          contenu: post.contenu,
          theme: post.theme,
          visibilite: (post.visibilite === 'etablissement' || post.visibilite === 'global') 
            ? post.visibilite 
            : 'global',
          etablissement_id: post.etablissement_id ?? undefined,
        }}
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
      />
    </Card>
  );
}
