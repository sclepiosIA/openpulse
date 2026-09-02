import { useState } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { CheckCircle, XCircle, Loader2, Clock, User, Calendar, Sparkles, AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingAbsence {
  id: string;
  profile_id: string;
  type_absence: string;
  date_debut: string | null;
  date_fin: string | null;
  nb_jours: number | null;
  demandeur_commentaire: string | null;
  statut: string;
  created_at: string | null;
  profiles: {
    prenom: string | null;
    nom: string | null;
    email: string;
  } | null;
}

interface ConflictAnalysis {
  hasConflict: boolean;
  riskScore: number;
  warnings: string[];
  recommendation: string;
}

const TYPE_LABELS: Record<string, string> = {
  'conge_paye': 'Congé payé',
  'rtt': 'RTT',
  'sans_solde': 'Sans solde',
  'maladie': 'Maladie',
  'maternite': 'Maternité/Paternité',
  'formation': 'Formation',
  'autre': 'Autre',
};

export function RHValidationConges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedAbsence, setSelectedAbsence] = useState<PendingAbsence | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [conflictAnalysis, setConflictAnalysis] = useState<ConflictAnalysis | null>(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Récupérer les demandes en attente
  const { data: pendingAbsences, isLoading } = useQuery({
    queryKey: ['pending-absences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_absences')
        .select(`
          *,
          profiles!rh_absences_profile_id_fkey (prenom, nom, email)
        `)
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingAbsence[];
    },
    enabled: !!user
  });

  // Analyse des conflits IA
  const fetchConflictAnalysis = async (absence: PendingAbsence) => {
    if (!absence.date_debut || !absence.date_fin) return;
    
    setLoadingConflicts(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-absence-conflicts', {
        body: {
          profile_id: absence.profile_id,
          date_debut: absence.date_debut,
          date_fin: absence.date_fin,
          type_absence: absence.type_absence,
        },
      });

      if (error) throw error;
      setConflictAnalysis(data);
    } catch (error) {
      debug.error('Error fetching conflict analysis:', error);
    } finally {
      setLoadingConflicts(false);
    }
  };

  const handleSelectAbsence = (absence: PendingAbsence, action: 'approve' | 'reject') => {
    setSelectedAbsence(absence);
    setActionType(action);
    setConflictAnalysis(null);
    
    if (action === 'approve') {
      fetchConflictAnalysis(absence);
    }
  };

  const handleValidation = async (approve: boolean) => {
    if (!selectedAbsence || !user) return;

    if (!approve && !rejectReason.trim()) {
      toast({
        title: "Motif requis",
        description: "Veuillez indiquer le motif du refus",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    try {
      const updateData: Record<string, any> = {
        statut: approve ? 'validee' : 'refusee',
        validateur_id: user.id,
        validated_at: new Date().toISOString()
      };

      if (!approve) {
        updateData.rejection_reason = rejectReason;
      }

      const { error } = await supabase
        .from('rh_absences')
        .update(updateData as never)
        .eq('id', selectedAbsence.id);

      if (error) throw error;

      toast({
        title: approve ? "Demande validée" : "Demande refusée",
        description: `La demande de ${selectedAbsence.profiles?.prenom || 'l\'employé'} a été ${approve ? 'approuvée' : 'refusée'}`,
      });

      // Envoyer notification push à l'employé
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: selectedAbsence.profile_id,
            title: approve ? 'Congé approuvé ✅' : 'Congé refusé ❌',
            body: approve 
              ? `Votre demande de congé du ${selectedAbsence.date_debut ? format(new Date(selectedAbsence.date_debut), 'dd/MM') : 'N/A'} au ${selectedAbsence.date_fin ? format(new Date(selectedAbsence.date_fin), 'dd/MM') : 'N/A'} a été validée`
              : `Votre demande de congé a été refusée: ${rejectReason}`,
            url: '/people'
          }
        });
      } catch (notifError) {
        debug.error('Error sending notification:', notifError);
      }

      // Fermer le dialog et reset
      setSelectedAbsence(null);
      setRejectReason('');
      setActionType(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['pending-absences'] });
      queryClient.invalidateQueries({ queryKey: ['rh-absences'] });

    } catch (error: unknown) {
      debug.error('Error validating absence:', error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasPending = pendingAbsences && pendingAbsences.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Demandes en attente
            {hasPending && (
              <Badge variant="secondary">{pendingAbsences.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Validez ou refusez les demandes de congés de votre équipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasPending ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
              <p>Aucune demande en attente de validation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAbsences.map((absence) => (
                <div
                  key={absence.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {absence.profiles?.prenom} {absence.profiles?.nom}
                        </span>
                        <Badge variant="outline">
                          {TYPE_LABELS[absence.type_absence] || absence.type_absence}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {absence.date_debut && absence.date_fin ? (
                          <>
                            {format(new Date(absence.date_debut), 'dd MMM', { locale: fr })} → {format(new Date(absence.date_fin), 'dd MMM yyyy', { locale: fr })}
                            <span className="text-primary font-medium">
                              ({absence.nb_jours || 1} jour{(absence.nb_jours || 1) > 1 ? 's' : ''})
                            </span>
                          </>
                        ) : 'Dates non définies'}
                      </div>
                      {absence.demandeur_commentaire && (
                        <p className="text-sm text-muted-foreground italic">
                          "{absence.demandeur_commentaire}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleSelectAbsence(absence, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleSelectAbsence(absence, 'reject')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmation */}
      <Dialog open={!!selectedAbsence && !!actionType} onOpenChange={() => {
        setSelectedAbsence(null);
        setActionType(null);
        setRejectReason('');
        setConflictAnalysis(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Valider la demande' : 'Refuser la demande'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? `Confirmez-vous la validation du congé de ${selectedAbsence?.profiles?.prenom} ${selectedAbsence?.profiles?.nom} ?`
                : `Indiquez le motif du refus pour ${selectedAbsence?.profiles?.prenom} ${selectedAbsence?.profiles?.nom}`
              }
            </DialogDescription>
          </DialogHeader>

          {selectedAbsence && (
            <div className="py-4 space-y-3">
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm">
                  <strong>Type:</strong> {TYPE_LABELS[selectedAbsence.type_absence] || selectedAbsence.type_absence}
                </p>
                <p className="text-sm">
                  <strong>Période:</strong> {selectedAbsence.date_debut && selectedAbsence.date_fin ? `${format(new Date(selectedAbsence.date_debut), 'dd/MM/yyyy')} - ${format(new Date(selectedAbsence.date_fin), 'dd/MM/yyyy')}` : 'Non définie'}
                </p>
                <p className="text-sm">
                  <strong>Durée:</strong> {selectedAbsence.nb_jours || 1} jour(s)
                </p>
              </div>

              {/* Analyse IA des conflits */}
              {actionType === 'approve' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Analyse IA des conflits
                  </div>
                  
                  {loadingConflicts ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Analyse en cours...</span>
                    </div>
                  ) : conflictAnalysis ? (
                    <div className={`p-3 rounded-lg border ${
                      conflictAnalysis.riskScore >= 50 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                        : conflictAnalysis.riskScore >= 25 
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                          : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {conflictAnalysis.riskScore >= 50 ? (
                            <span className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" /> Risque élevé
                            </span>
                          ) : conflictAnalysis.riskScore >= 25 ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-4 w-4" /> Attention
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600">
                              <ShieldCheck className="h-4 w-4" /> Aucun conflit
                            </span>
                          )}
                        </span>
                        <Badge variant="outline">{conflictAnalysis.riskScore}%</Badge>
                      </div>
                      
                      <Progress value={conflictAnalysis.riskScore} className="h-2 mb-2" />
                      
                      {conflictAnalysis.warnings.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-1 mb-2">
                          {conflictAnalysis.warnings.map((warning, i) => (
                            <li key={`warning-${i}-${warning.slice(0, 20)}`} className="flex items-start gap-1">
                              <span className="text-amber-500">•</span> {warning}
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      <p className="text-sm italic text-muted-foreground">
                        {conflictAnalysis.recommendation}
                      </p>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => selectedAbsence && fetchConflictAnalysis(selectedAbsence)}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Analyser les conflits
                    </Button>
                  )}
                </div>
              )}

              {actionType === 'reject' && (
                <Textarea
                  placeholder="Motif du refus..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAbsence(null);
                setActionType(null);
                setRejectReason('');
              }}
            >
              Annuler
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={() => handleValidation(actionType === 'approve')}
              disabled={isValidating}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : actionType === 'approve' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Refuser
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
