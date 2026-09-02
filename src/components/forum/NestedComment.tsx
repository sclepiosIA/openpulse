import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThumbsUp, MessageSquare, Shield, User, Star } from "lucide-react";
import { ForumAvatar } from "./ForumAvatar";
import { UserProfileHoverCard } from "./UserProfileHoverCard";
import { EmojiReactionPicker } from "./EmojiReactionPicker";
import { useAuth } from "@/hooks/shared/useAuth";
import { useIsTeamMember, useTeamMemberProfile } from "@/hooks/hr/useTeamMember";
import { useEtablissementUser } from "@/hooks/crm/useEtablissementUser";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseBrowser";
import { RichTextEditor } from "@/components/email/LazyRichTextEditor";
import { SafeHtmlContent } from "./SafeHtmlContent";

interface ForumCommentUser {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  fonction?: string | null;
  service?: string | null;
  etablissements?: {
    nom: string;
  };
}

interface ForumComment {
  id: string;
  user_id: string | null;
  contenu: string;
  upvotes: number;
  created_at: string;
  author_prenom?: string | null;
  author_nom?: string | null;
  author_role?: string | null;
  etablissement_users?: ForumCommentUser | null;
  replies?: ForumComment[];
}

interface NestedCommentProps {
  comment: ForumComment;
  postId: string;
  onVote: (commentId: string) => void;
  onReply: (parentId: string, content: string, authorData: { prenom: string; nom: string; role: string }) => Promise<void>;
  level?: number;
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

export function NestedComment({ 
  comment, 
  postId,
  onVote, 
  onReply,
  level = 0 
}: NestedCommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyPrenom, setReplyPrenom] = useState("");
  const [replyNom, setReplyNom] = useState("");
  const [replyRole, setReplyRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCommentAuthorTeamMember, setIsCommentAuthorTeamMember] = useState(false);
  
  const { user } = useAuth();
  const { data: isCurrentUserTeamMember } = useIsTeamMember();
  const { data: teamProfile } = useTeamMemberProfile();
  const { etablissementUser } = useEtablissementUser();

  // Vérifier si l'auteur du commentaire est membre de l'équipe OpenPulse
  useEffect(() => {
    const checkTeamMember = async () => {
      if (!comment.user_id) {
        setIsCommentAuthorTeamMember(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', comment.user_id)
        .in('role', ['admin', 'csm', 'chef_projet', 'commercial'])
        .maybeSingle();

      setIsCommentAuthorTeamMember(!!data && !error);
    };

    checkTeamMember();
  }, [comment.user_id]);

  // Auto-remplissage du formulaire de réponse
  useEffect(() => {
    if (showReplyForm) {
      if (isCurrentUserTeamMember && teamProfile) {
        setReplyPrenom(teamProfile.prenom || "");
        setReplyNom(teamProfile.nom || "");
        setReplyRole(teamProfile.fonction || "Équipe OpenPulse");
      } else if (etablissementUser) {
        setReplyPrenom(etablissementUser.prenom || "");
        setReplyNom(etablissementUser.nom || "");
        setReplyRole(etablissementUser.fonction || "");
      }
    }
  }, [showReplyForm, isCurrentUserTeamMember, teamProfile, etablissementUser]);

  // Déterminer si c'est un utilisateur identifié ou anonyme
  const isAnonymous = !comment.user_id;
  const displayName = isAnonymous
    ? `${comment.author_prenom || ''} ${comment.author_nom || 'Anonyme'}`.trim()
    : `${comment.etablissement_users?.prenom || ''} ${comment.etablissement_users?.nom || ''}`.trim();
  
  const displayRole = isAnonymous 
    ? comment.author_role 
    : comment.etablissement_users?.fonction;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!replyContent.trim() || replyContent === '<p></p>') {
      toast.error("La réponse ne peut pas être vide");
      return;
    }

    if (!replyPrenom.trim() || !replyNom.trim() || !replyRole) {
      toast.error("Prénom, nom et fonction sont obligatoires");
      return;
    }

    setIsSubmitting(true);
    try {
      await onReply(comment.id, replyContent, {
        prenom: replyPrenom,
        nom: replyNom,
        role: replyRole
      });
      setReplyContent("");
      setReplyPrenom("");
      setReplyNom("");
      setReplyRole("");
      setShowReplyForm(false);
      toast.success("Réponse publiée !");
    } catch (error) {
      debug.error('Error replying:', error);
      toast.error("Erreur lors de la publication");
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxLevel = 3;
  const canNest = level < maxLevel;

  return (
    <div className={`${level > 0 ? 'ml-8 mt-4 border-l-2 border-muted pl-4' : ''}`}>
      <Card className="animate-fade-in hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            {!isAnonymous && comment.etablissement_users ? (
              <UserProfileHoverCard
                userId={comment.etablissement_users?.id}
                nom={comment.etablissement_users?.nom}
                prenom={comment.etablissement_users?.prenom}
                role={comment.etablissement_users?.fonction}
                service={comment.etablissement_users?.service}
                etablissement={comment.etablissement_users?.etablissements?.nom}
              >
                <div>
                  <ForumAvatar
                    nom={comment.etablissement_users?.nom ?? undefined}
                    prenom={comment.etablissement_users?.prenom ?? undefined}
                    className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  />
                </div>
              </UserProfileHoverCard>
            ) : (
              <div>
                <ForumAvatar
                  nom={comment.author_nom || 'A'}
                  prenom={comment.author_prenom || ''}
                />
              </div>
            )}
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    {!isAnonymous && comment.etablissement_users ? (
                      <UserProfileHoverCard
                        userId={comment.etablissement_users?.id}
                        nom={comment.etablissement_users?.nom}
                        prenom={comment.etablissement_users?.prenom}
                        role={comment.etablissement_users?.fonction}
                        service={comment.etablissement_users?.service}
                        etablissement={comment.etablissement_users?.etablissements?.nom}
                      >
                        <p className="font-semibold hover:text-primary cursor-pointer transition-colors">
                          {displayName}
                        </p>
                      </UserProfileHoverCard>
                    ) : (
                      <UserProfileHoverCard
                        userId={comment.etablissement_users?.id}
                        nom={comment.etablissement_users?.nom ?? undefined}
                        prenom={comment.etablissement_users?.prenom ?? undefined}
                        role={comment.etablissement_users?.fonction}
                        service={comment.etablissement_users?.service}
                        etablissement={comment.etablissement_users?.etablissements?.nom}
                      >
                        <p className="font-semibold">{displayName}</p>
                      </UserProfileHoverCard>
                    )}
                    {!isCommentAuthorTeamMember && displayRole && (
                      <p className="text-sm text-muted-foreground">
                        {displayRole}
                      </p>
                    )}
                  </div>
                  
                  {/* Badge statut */}
                  {isCommentAuthorTeamMember ? (
                    <Badge variant="default" className="text-xs bg-gradient-to-r from-primary to-primary/80">
                      <Star className="w-3 h-3 mr-1" />
                      OpenPulse
                    </Badge>
                  ) : isAnonymous ? (
                    <Badge variant="outline" className="text-xs">
                      <User className="w-3 h-3 mr-1" />
                      Contributeur
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Compte vérifié
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(comment.created_at), 'PPp', { locale: fr })}
                </span>
              </div>

              <div className="prose prose-sm max-w-none">
                <SafeHtmlContent 
                  html={comment.contenu} 
                  className="text-foreground"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVote(comment.id)}
                  className="gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>{comment.upvotes || 0}</span>
                </Button>

                {canNest && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Répondre
                  </Button>
                )}

                <EmojiReactionPicker
                  targetId={comment.id}
                  targetType="comment"
                />
              </div>

              {/* Formulaire de réponse */}
              {showReplyForm && (
                <form onSubmit={handleReply} className="mt-4">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`reply-content-${comment.id}`} className="text-sm">Votre réponse *</Label>
                          <RichTextEditor
                            content={replyContent}
                            onChange={setReplyContent}
                            placeholder="Votre réponse... Utilisez la barre d'outils pour formater votre texte."
                            disabled={isSubmitting}
                          />
                        </div>
                        
                        {/* Section "Vos informations" - Format harmonisé */}
                        <div className="space-y-3 pt-2 border-t">
                          <h4 className="text-xs font-semibold">Vos informations</h4>
                          
                          {/* Prénom et Nom - Grid 2 colonnes */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`reply-prenom-${comment.id}`} className="text-xs">Prénom *</Label>
                              <Input
                                id={`reply-prenom-${comment.id}`}
                                value={replyPrenom}
                                onChange={(e) => setReplyPrenom(e.target.value)}
                                placeholder="Jean"
                                required
                                disabled={isCurrentUserTeamMember}
                                className={isCurrentUserTeamMember ? "bg-muted" : ""}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`reply-nom-${comment.id}`} className="text-xs">Nom *</Label>
                              <Input
                                id={`reply-nom-${comment.id}`}
                                value={replyNom}
                                onChange={(e) => setReplyNom(e.target.value)}
                                placeholder="Dupont"
                                required
                                disabled={isCurrentUserTeamMember}
                                className={isCurrentUserTeamMember ? "bg-muted" : ""}
                              />
                            </div>
                          </div>

                          {/* Fonction - Ligne complète */}
                          <div className="space-y-1.5">
                            <Label htmlFor={`reply-role-${comment.id}`} className="text-xs">Fonction *</Label>
                            {isCurrentUserTeamMember ? (
                              <Input 
                                id={`reply-role-${comment.id}`}
                                value={replyRole} 
                                disabled 
                                className="bg-muted" 
                              />
                            ) : (
                              <Select value={replyRole} onValueChange={setReplyRole}>
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
                            size="sm"
                            onClick={() => setShowReplyForm(false)}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || !replyContent.trim() || !replyPrenom || !replyNom || !replyRole}
                          >
                            {isSubmitting ? "Envoi..." : "Répondre"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-4 mt-4">
          {comment.replies.map((reply) => (
            <NestedComment
              key={reply.id}
              comment={reply}
              postId={postId}
              onVote={onVote}
              onReply={onReply}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
