import { FileAudio, Clock, CheckCircle, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TranscriptionSessionWithDetails } from '@/types/transcription';

interface MeetingNotesListProps {
  sessions: TranscriptionSessionWithDetails[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (session: TranscriptionSessionWithDetails) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  processing: { label: 'En traitement', icon: Loader2, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  archived: { label: 'Terminé', icon: CheckCircle, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  ended: { label: 'Erreur', icon: Clock, className: 'bg-destructive/10 text-destructive' },
  active: { label: 'En cours', icon: Clock, className: 'bg-primary/10 text-primary' },
};

export function MeetingNotesList({
  sessions,
  isLoading,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: MeetingNotesListProps) {
  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="archived">Terminés</SelectItem>
            <SelectItem value="processing">En cours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileAudio className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune note de réunion</p>
          <p className="text-xs mt-1">Importez un fichier audio pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const config = statusConfig[session.status] || statusConfig.ended;
            const StatusIcon = config.icon;
            const isSelected = session.id === selectedId;

            return (
              <Card
                key={session.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                onClick={() => onSelect(session)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(session.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {session.decisions?.length > 0 || session.next_steps?.length > 0 ? (
                        <div className="flex gap-2 mt-1.5">
                          {session.decisions?.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {session.decisions.length} décision{session.decisions.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {session.next_steps?.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {session.next_steps.length} action{session.next_steps.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${config.className}`}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${session.status === 'processing' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
