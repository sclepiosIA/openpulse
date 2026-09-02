import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForumComments, useCreateForumComment, useVoteComment } from "@/hooks/forum/useForumComments";
import { useAuth } from "@/hooks/shared/useAuth";
import { useIsTeamMember, useTeamMemberProfile } from "@/hooks/hr/useTeamMember";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";
import { RichTextEditor } from "@/components/email/LazyRichTextEditor";
import { toast } from "sonner";
import { ForumSkeleton } from "./ForumSkeleton";
import { NestedComment } from "./NestedComment";

interface CommentSectionProps {
  postId: string;
}

const fonctions = [
  "Médecin",
  "Infirmier(ère)",
  "Aide-soignant(e)",
  "Cadre de santé",
  "Directeur/Directrice",
  "Attaché(e) d'administration",
  "DIM/Département d'information médicale",
  "Contrôleur de gestion",
  "Informaticien(ne)",
  "Secrétaire médicale",
  "Pharmacien(ne)",
  "Manipulateur radio",
  "Technicien(ne) de laboratoire",
  "Autre"
];

export function CommentSection({ postId }: CommentSectionProps) {
  const { data: comments, isLoading } = useForumComments(postId);
  const createComment = useCreateForumComment();
  const voteComment = useVoteComment();
  
  const { user } = useAuth();
  const { data: isTeamMember } = useIsTeamMember();
  const { data: teamProfile } = useTeamMemberProfile();
  const { etablissementUser } = useEtablissementUser();
  
  const [newComment, setNewComment] = useState("");
  const [authorPrenom, setAuthorPrenom] = useState("");
  const [authorNom, setAuthorNom] = useState("");
  const [authorRole, setAuthorRole] = useState("");

  // Auto-remplissage des informations utilisateur
  useEffect(() => {
    if (isTeamMember && teamProfile) {
      // Membre de l'équipe OpenPulse
      setAuthorPrenom(teamProfile.prenom || "");
      setAuthorNom(teamProfile.nom || "");
      setAuthorRole(teamProfile.fonction || "Équipe OpenPulse");
    } else if (etablissementUser) {
      // Utilisateur avec profil établissement
      setAuthorPrenom(etablissementUser.prenom || "");
      setAuthorNom(etablissementUser.nom || "");
      setAuthorRole(etablissementUser.fonction || "");
    }
  }, [isTeamMember, teamProfile, etablissementUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || newComment === '<p></p>') {
      toast.error("Le commentaire ne peut pas être vide");
      return;
    }

    if (!authorPrenom.trim() || !authorNom.trim() || !authorRole) {
      toast.error("Prénom, nom et fonction sont obligatoires");
      return;
    }

    try {
      await createComment.mutateAsync({
        post_id: postId,
        user_id: null, // Commentaire anonyme
        contenu: newComment,
        author_nom: authorNom,
        author_prenom: authorPrenom,
        author_role: authorRole,
      });
      
      setNewComment("");
      setAuthorPrenom("");
      setAuthorNom("");
      setAuthorRole("");
      toast.success("Commentaire publié avec succès !");
    } catch (error: unknown) {
      debug.error('Error creating comment:', error);
      toast.error("Erreur lors de la publication du commentaire");
    }
  };

  const handleReply = async (parentId: string, content: string, authorData: { prenom: string; nom: string; role: string }) => {
    await createComment.mutateAsync({
      post_id: postId,
      user_id: null,
      contenu: content,
      parent_comment_id: parentId,
      author_nom: authorData.nom,
      author_prenom: authorData.prenom,
      author_role: authorData.role,
    });
  };

  const handleVote = async (commentId: string) => {
    try {
      await voteComment.mutateAsync({ commentId });
    } catch (error: unknown) {
      debug.error('Error voting comment:', error);
    }
  };

  if (isLoading) {
    return <ForumSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Commentaires ({comments?.length || 0})
        </h3>
        
        {/* Liste des commentaires avec nested replies */}
        <div className="space-y-4 mb-8">
          {comments && comments.length > 0 ? (
            comments.map((comment: any) => (
              <NestedComment
                key={comment.id}
                comment={comment}
                postId={postId}
                onVote={handleVote}
                onReply={handleReply}
              />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucun commentaire pour le moment. Soyez le premier à commenter !
            </p>
          )}
        </div>

        {/* Formulaire de nouveau commentaire */}
        <div className="border-t pt-6">
          <h3 className="text-base font-semibold mb-4">Ajouter un commentaire</h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Zone de commentaire principale */}
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-sm">Votre commentaire *</Label>
                <RichTextEditor
                  content={newComment}
                  onChange={setNewComment}
                  placeholder="Partagez votre expérience, posez une question ou répondez aux autres... Utilisez la barre d'outils pour formater votre texte."
                  disabled={createComment.isPending}
                />
              </div>

              {/* Section "Vos informations" */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold">Vos informations</h3>
                
                {/* Prénom et Nom - Grid 2 colonnes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={authorPrenom}
                      onChange={(e) => setAuthorPrenom(e.target.value)}
                      placeholder="Jean"
                      required
                      disabled={isTeamMember}
                      className={isTeamMember ? "bg-muted" : ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={authorNom}
                      onChange={(e) => setAuthorNom(e.target.value)}
                      placeholder="Dupont"
                      required
                      disabled={isTeamMember}
                      className={isTeamMember ? "bg-muted" : ""}
                    />
                  </div>
                </div>

                {/* Fonction - Ligne complète */}
                <div className="space-y-1.5">
                  <Label htmlFor="fonction">Fonction *</Label>
                  {isTeamMember ? (
                    <Input 
                      id="fonction" 
                      value={authorRole} 
                      disabled 
                      className="bg-muted" 
                    />
                  ) : (
                    <Select value={authorRole} onValueChange={setAuthorRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre fonction" />
                      </SelectTrigger>
                      <SelectContent>
                        {fonctions.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewComment("");
                    setAuthorPrenom("");
                    setAuthorNom("");
                    setAuthorRole("");
                  }}
                >
                  Réinitialiser
                </Button>
                <Button 
                  type="submit" 
                  disabled={createComment.isPending || !newComment.trim() || !authorPrenom || !authorNom || !authorRole}
                  className="min-w-[120px]"
                >
                  {createComment.isPending ? "Envoi..." : "Publier"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
