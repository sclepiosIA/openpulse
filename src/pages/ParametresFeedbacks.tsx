import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  ArrowLeft,
  Image,
  Terminal,
  AlertTriangle,
  AlertCircle,
  Info,
  Minus,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Trash2,
  ExternalLink,
  Filter,
  Archive,
  ArchiveRestore,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/shared/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useFeedbackList, useFeedbackStats, useUpdateFeedback, useDeleteFeedback, useArchiveFeedback, UserFeedback } from '@/hooks/forms/useFeedbackList';
import { cn } from '@/lib/utils';
import { PageDataState } from '@/components/common/PageDataState';

const typeConfig = {
  bug: { icon: Bug, label: 'Bug', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  amelioration: { icon: Lightbulb, label: 'Amélioration', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  autre: { icon: MessageSquare, label: 'Autre', color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

const priorityConfig = {
  low: { icon: Minus, label: 'Basse', color: 'text-muted-foreground', variant: 'outline' as const },
  medium: { icon: Info, label: 'Moyenne', color: 'text-blue-500', variant: 'secondary' as const },
  high: { icon: AlertCircle, label: 'Haute', color: 'text-amber-500', variant: 'default' as const },
  critical: { icon: AlertTriangle, label: 'Critique', color: 'text-destructive', variant: 'destructive' as const },
};

const statusConfig = {
  new: { icon: Clock, label: 'Nouveau', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  reviewed: { icon: Eye, label: 'Examiné', color: 'text-purple-500', bgColor: 'bg-purple-500' },
  in_progress: { icon: RefreshCw, label: 'En cours', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  resolved: { icon: CheckCircle, label: 'Résolu', color: 'text-green-500', bgColor: 'bg-green-500' },
  wont_fix: { icon: XCircle, label: 'Won\'t fix', color: 'text-muted-foreground', bgColor: 'bg-muted-foreground' },
};

export default function ParametresFeedbacks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<UserFeedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: feedbacks, isLoading, isError, refetch } = useFeedbackList({
    type: filterType !== 'all' ? filterType : undefined,
    status: filterStatus !== 'all' ? filterStatus : undefined,
    priority: filterPriority !== 'all' ? filterPriority : undefined,
    showArchived,
  });

  const { data: stats } = useFeedbackStats();
  const updateFeedback = useUpdateFeedback();
  const deleteFeedback = useDeleteFeedback();
  const archiveFeedback = useArchiveFeedback();

  const handleStatusChange = async (feedbackId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === 'resolved' || newStatus === 'wont_fix') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user?.id;
      }

      await updateFeedback.mutateAsync({ id: feedbackId, updates });
      toast({ title: 'Statut mis à jour' });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le statut', variant: 'destructive' });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedFeedback) return;

    try {
      await updateFeedback.mutateAsync({
        id: selectedFeedback.id,
        updates: { admin_notes: adminNotes },
      });
      toast({ title: 'Notes sauvegardées' });
      setSelectedFeedback({ ...selectedFeedback, admin_notes: adminNotes });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder les notes', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeedback.mutateAsync(id);
      toast({ title: 'Feedback supprimé' });
      setSelectedFeedback(null);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de supprimer le feedback', variant: 'destructive' });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveFeedback.mutateAsync(id);
      toast({ title: 'Feedback archivé', description: 'Ce feedback ne sera plus visible par défaut.' });
      setSelectedFeedback(null);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible d\'archiver le feedback', variant: 'destructive' });
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await updateFeedback.mutateAsync({ id, updates: { archived_at: null } });
      toast({ title: 'Feedback restauré' });
      setSelectedFeedback(null);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de restaurer le feedback', variant: 'destructive' });
    }
  };

  const openDetail = (feedback: UserFeedback) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.admin_notes || '');
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parametres')} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Retours Utilisateurs</h1>
            <p className="text-muted-foreground">Gérez les bugs, suggestions et questions de l'équipe</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold">{stats.byType.bug}</span>
                </div>
                <p className="text-sm text-muted-foreground">Bugs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold">{stats.byType.amelioration}</span>
                </div>
                <p className="text-sm text-muted-foreground">Améliorations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{stats.byStatus.new}</span>
                </div>
                <p className="text-sm text-muted-foreground">Nouveaux</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{stats.byStatus.resolved}</span>
                </div>
                <p className="text-sm text-muted-foreground">Résolus</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {/* Label filtres - visible sur desktop inline */}
              <div className="flex items-center gap-2 sm:hidden">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtres</span>
              </div>

              {/* Grille de filtres - 2 colonnes sur mobile, flex sur desktop */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtres :</span>
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="amelioration">Amélioration</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="new">Nouveau</SelectItem>
                    <SelectItem value="reviewed">Examiné</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                    <SelectItem value="wont_fix">Won't fix</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes priorités</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto col-span-2 sm:col-span-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>

                <div className="flex items-center gap-2 col-span-2 sm:col-span-1 sm:ml-4">
                  <Switch 
                    id="show-archived" 
                    checked={showArchived} 
                    onCheckedChange={setShowArchived}
                  />
                  <label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
                    Voir archivés
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des retours ({feedbacks?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || isError ? (
              <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
                <></>
              </PageDataState>
            ) : feedbacks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun retour pour le moment
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks?.map((feedback) => {
                  const typeInfo = typeConfig[feedback.type];
                  const priorityInfo = priorityConfig[feedback.priority];
                  const statusInfo = statusConfig[feedback.status];
                  const TypeIcon = typeInfo.icon;
                  const PriorityIcon = priorityInfo.icon;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={feedback.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openDetail(feedback)}
                    >
                      {/* Type Icon + Content row */}
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        {/* Type Icon */}
                        <div className={cn("p-2 rounded-lg shrink-0", typeInfo.bgColor)}>
                          <TypeIcon className={cn("h-5 w-5", typeInfo.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={cn("font-medium truncate max-w-[180px] sm:max-w-none", feedback.archived_at && "text-muted-foreground")}>{feedback.title}</span>
                            {feedback.archived_at && (
                              <Badge variant="outline" className="shrink-0 text-xs gap-1 text-muted-foreground">
                                <Archive className="h-3 w-3" />
                                Archivé
                              </Badge>
                            )}
                            <Badge variant={priorityInfo.variant} className="shrink-0 text-xs">
                              <PriorityIcon className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">{priorityInfo.label}</span>
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
                            <span className="truncate max-w-[120px] sm:max-w-none">{feedback.user_name || feedback.user_email || 'Anonyme'}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true, locale: fr })}</span>
                            {feedback.screenshot_url && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <Image className="h-3 w-3" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status - aligné à droite */}
                      <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium self-end sm:self-auto shrink-0", statusInfo.bgColor, "text-white")}>
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
          <DialogContent className="w-[95vw] sm:w-auto sm:max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {selectedFeedback && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const TypeIcon = typeConfig[selectedFeedback.type].icon;
                      return (
                        <div className={cn("p-2 rounded-lg", typeConfig[selectedFeedback.type].bgColor)}>
                          <TypeIcon className={cn("h-5 w-5", typeConfig[selectedFeedback.type].color)} />
                        </div>
                      );
                    })()}
                    <div>
                      <DialogTitle>{selectedFeedback.title}</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Par {selectedFeedback.user_name || selectedFeedback.user_email || 'Anonyme'} • {format(new Date(selectedFeedback.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                  <Tabs defaultValue="content" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="content">Contenu</TabsTrigger>
                      <TabsTrigger value="technical">Technique</TabsTrigger>
                      <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="space-y-4 pt-4">
                      {/* Status & Priority */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Label>Statut</Label>
                          <Select
                            value={selectedFeedback.status}
                            onValueChange={(value) => handleStatusChange(selectedFeedback.id, value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Nouveau</SelectItem>
                              <SelectItem value="reviewed">Examiné</SelectItem>
                              <SelectItem value="in_progress">En cours</SelectItem>
                              <SelectItem value="resolved">Résolu</SelectItem>
                              <SelectItem value="wont_fix">Won't fix</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label>Priorité</Label>
                          <div className="mt-1">
                            <Badge variant={priorityConfig[selectedFeedback.priority].variant}>
                              {priorityConfig[selectedFeedback.priority].label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <Label>Description</Label>
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {selectedFeedback.description || <span className="text-muted-foreground italic">Aucune description</span>}
                        </p>
                      </div>

                      {/* Screenshot */}
                      {selectedFeedback.screenshot_url && (
                        <div>
                          <Label className="flex items-center gap-2 mb-2">
                            <Image className="h-4 w-4" />
                            Capture d'écran
                          </Label>
                          <a href={selectedFeedback.screenshot_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={selectedFeedback.screenshot_url}
                              alt="Capture d'écran"
                              className="rounded-lg border max-h-64 object-contain hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <Button variant="outline" size="sm" className="mt-2" asChild>
                            <a href={selectedFeedback.screenshot_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ouvrir en grand
                            </a>
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="technical" className="space-y-4 pt-4">
                      {/* Route */}
                      <div>
                        <Label>Page concernée</Label>
                        <code className="block mt-1 text-sm bg-muted p-2 rounded">{selectedFeedback.current_route || 'N/A'}</code>
                      </div>

                      {/* Browser Info */}
                      <div>
                        <Label>Navigateur</Label>
                        <div className="mt-1 text-sm bg-muted p-3 rounded space-y-1">
                          {selectedFeedback.browser_info ? (
                            <>
                              <p><strong>User Agent:</strong> {selectedFeedback.browser_info.userAgent}</p>
                              <p><strong>Écran:</strong> {selectedFeedback.browser_info.screenWidth}x{selectedFeedback.browser_info.screenHeight}</p>
                              <p><strong>Fenêtre:</strong> {selectedFeedback.browser_info.windowWidth}x{selectedFeedback.browser_info.windowHeight}</p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Non disponible</span>
                          )}
                        </div>
                      </div>

                      {/* Console Logs */}
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Terminal className="h-4 w-4" />
                          Logs Console ({selectedFeedback.console_logs?.length || 0})
                        </Label>
                        <div className="bg-muted p-3 rounded max-h-48 overflow-auto font-mono text-xs">
                          {selectedFeedback.console_logs?.length ? (
                            selectedFeedback.console_logs.map((log: any, i: number) => {
                              const levelColors: Record<string, string> = {
                                log: 'text-foreground',
                                info: 'text-blue-500',
                                warn: 'text-amber-500',
                                error: 'text-destructive',
                              };
                              const time = new Date(log.timestamp).toLocaleTimeString('fr-FR');
                              return (
                                <div key={i} className={cn("mb-1", levelColors[log.level] || 'text-foreground')}>
                                  <span className="text-muted-foreground">[{time}]</span>{' '}
                                  <span className="font-semibold">{log.level?.toUpperCase()}:</span>{' '}
                                  {log.args?.join(' ')}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground">Aucun log capturé</span>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="admin" className="space-y-4 pt-4">
                      {/* Admin Notes */}
                      <div>
                        <Label htmlFor="admin-notes">Notes internes</Label>
                        <Textarea
                          id="admin-notes"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Notes de suivi, décisions, etc."
                          rows={4}
                          className="mt-1"
                        />
                        <Button size="sm" className="mt-2" onClick={handleSaveNotes}>
                          Enregistrer les notes
                        </Button>
                      </div>

                      {/* Resolution Info */}
                      {selectedFeedback.resolved_at && (
                        <div>
                          <Label>Résolution</Label>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Résolu le {format(new Date(selectedFeedback.resolved_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                      )}

                      {/* Archive / Restore */}
                      <div className="pt-4 border-t flex flex-wrap gap-2">
                        {selectedFeedback.archived_at ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleUnarchive(selectedFeedback.id)}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restaurer
                          </Button>
                        ) : (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleArchive(selectedFeedback.id)}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archiver
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce feedback ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Le feedback et sa capture d'écran seront définitivement supprimés.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(selectedFeedback.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TabsContent>
                  </Tabs>
                </ScrollArea>

                <DialogFooter className="border-t pt-4">
                  <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                    Fermer
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
