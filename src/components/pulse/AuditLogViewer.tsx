import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Shield,
  RefreshCw,
  Download,
  Filter,
  RotateCcw,
  MessageSquare,
  Trash2,
  Edit,
  UserPlus,
  UserMinus,
  Archive,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  usePulseAuditLog,
  usePulseMessageArchives,
  restoreArchivedMessage,
  type AuditLogFilters,
} from '@/hooks/pulse/usePulseAuditLog';
import { useQueryClient } from '@tanstack/react-query';

interface AuditLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'message_created': <MessageSquare className="h-4 w-4 text-green-500" />,
  'message_edited': <Edit className="h-4 w-4 text-blue-500" />,
  'message_deleted': <Trash2 className="h-4 w-4 text-red-500" />,
  'message_restored': <RotateCcw className="h-4 w-4 text-purple-500" />,
  'member_added': <UserPlus className="h-4 w-4 text-green-500" />,
  'member_removed': <UserMinus className="h-4 w-4 text-orange-500" />,
  'conversation_created': <MessageSquare className="h-4 w-4 text-primary" />,
  'conversation_archived': <Archive className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  'success': <CheckCircle className="h-3 w-3 text-green-500" />,
  'failure': <XCircle className="h-3 w-3 text-red-500" />,
  'pending': <Clock className="h-3 w-3 text-yellow-500" />,
};

export function AuditLogViewer({ open, onOpenChange, conversationId }: AuditLogViewerProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AuditLogFilters>({
    conversationId,
    limit: 100,
  });
  const [activeTab, setActiveTab] = useState('logs');

  const { data: auditLogs, isLoading: logsLoading, refetch: refetchLogs } = usePulseAuditLog(filters);
  const { data: archives, isLoading: archivesLoading, refetch: refetchArchives } = usePulseMessageArchives(conversationId);

  const handleRestore = async (archiveId: string) => {
    const success = await restoreArchivedMessage(archiveId);
    if (success) {
      toast.success('Message restauré avec succès');
      refetchArchives();
      queryClient.invalidateQueries({ queryKey: ['pulse-messages'] });
    } else {
      toast.error('Erreur lors de la restauration');
    }
  };

  const handleExportCSV = () => {
    if (!auditLogs?.length) return;

    const headers = ['Date', 'Action', 'Acteur', 'Statut', 'Détails'];
    const rows = auditLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.action,
      log.actor_id || 'Système',
      log.status,
      JSON.stringify(log.details),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pulse-audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Journal d'audit Pulse
          </SheetTitle>
          <SheetDescription>
            Historique des actions et messages archivés
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="archives" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Archives
              {archives?.length ? (
                <Badge variant="secondary" className="ml-1">
                  {archives.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={filters.action || 'all'}
                onValueChange={(v) => setFilters(prev => ({ ...prev, action: v === 'all' ? undefined : v }))}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrer par action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  <SelectItem value="message_created">Messages créés</SelectItem>
                  <SelectItem value="message_edited">Messages modifiés</SelectItem>
                  <SelectItem value="message_deleted">Messages supprimés</SelectItem>
                  <SelectItem value="member_added">Membres ajoutés</SelectItem>
                  <SelectItem value="member_removed">Membres retirés</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.status || 'all'}
                onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === 'all' ? undefined : v as 'success' | 'failure' | 'pending' }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="failure">Échec</SelectItem>
                  <SelectItem value="pending">En cours</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>

            {/* Logs List */}
            <ScrollArea className="h-[calc(100vh-280px)]">
              {logsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`audit-log-list-skeleton-${i}`} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : auditLogs?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mb-4 opacity-20" />
                  <p>Aucune entrée dans le journal</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {ACTION_ICONS[log.action] || <Eye className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          {STATUS_ICONS[log.status]}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-destructive mt-1">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archives" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Messages supprimés pouvant être restaurés
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchArchives()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-280px)]">
              {archivesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`audit-archive-skeleton-${i}`} className="p-4 border rounded-lg space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : archives?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Archive className="h-12 w-12 mb-4 opacity-20" />
                  <p>Aucun message archivé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archives?.map((archive) => {
                    const snapshot = archive.content_snapshot as {
                      content: string;
                      content_html: string | null;
                      mentions: string[];
                      created_at: string;
                    };
                    return (
                      <div
                        key={archive.id}
                        className="p-4 border rounded-lg space-y-3 bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm line-clamp-3">
                              {snapshot?.content || 'Contenu non disponible'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(archive.id)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restaurer
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Supprimé le {format(new Date(archive.deleted_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          </span>
                          {archive.deletion_reason && (
                            <span className="text-destructive">
                              Raison : {archive.deletion_reason}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
