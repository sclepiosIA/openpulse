import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  Archive,
  Calendar,
  User,
  Building2,
  Loader2,
  MessageSquare,
  ListChecks,
  ArrowLeft,
} from "lucide-react";
import { useEtablissementTimeline } from "@/hooks/crm/useEtablissementTimeline";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fixMalformedEncoding } from "@/lib/emailUtils";
import { EmailThread } from "./EmailThread";

interface EtablissementTimelineViewProps {
  etablissementId: string;
  etablissementNom: string;
  etablissementVille: string;
  onBack: () => void;
}

export function EtablissementTimelineView({
  etablissementId,
  etablissementNom,
  etablissementVille,
  onBack,
}: EtablissementTimelineViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'email' | 'task'>('all');
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);
  const { data: timelineItems, isLoading, error } = useEtablissementTimeline(etablissementId);

  // Si un thread email est sélectionné, afficher sa vue détaillée
  if (selectedEmailThreadId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedEmailThreadId(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la timeline
        </Button>
        <EmailThread 
          threadId={selectedEmailThreadId} 
          onBack={() => setSelectedEmailThreadId(null)} 
        />
      </div>
    );
  }

  // Filtrer les items selon le type sélectionné
  const filteredItems = timelineItems?.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const emailCount = timelineItems?.filter((item) => item.type === 'email').length || 0;
  const taskCount = timelineItems?.filter((item) => item.type === 'task').length || 0;

  const getStatusIcon = (item: any) => {
    if (item.type === 'email') {
      if (item.status === 'archived') return <Archive className="h-4 w-4 text-muted-foreground" />;
      if (item.status === 'unread') return <Mail className="h-4 w-4 text-primary" />;
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    } else {
      switch (item.status) {
        case 'Terminée':
          return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'En cours':
          return <Clock className="h-4 w-4 text-blue-500" />;
        case 'A faire':
          return <ListChecks className="h-4 w-4 text-yellow-500" />;
        case 'Bloquée':
          return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
          return <ListChecks className="h-4 w-4 text-muted-foreground" />;
      }
    }
  };

  const getStatusBadge = (item: any) => {
    if (item.type === 'email') {
      if (item.status === 'archived')
        return <Badge variant="outline">Archivé</Badge>;
      if (item.status === 'unread')
        return <Badge variant="default">Non lu</Badge>;
      return <Badge variant="secondary">Lu</Badge>;
    } else {
      const statusColors: Record<string, string> = {
        'Terminée': 'bg-green-500/10 text-green-700 dark:text-green-400',
        'En cours': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
        'A faire': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
        'Bloquée': 'bg-red-500/10 text-red-700 dark:text-red-400',
      };
      
      return (
        <Badge 
          variant="outline" 
          className={cn("border-0", statusColors[item.status] || '')}
        >
          {item.status}
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" onClick={onBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 className="text-2xl font-bold">{fixMalformedEncoding(etablissementNom)}</h2>
              <p className="text-muted-foreground">{fixMalformedEncoding(etablissementVille)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{emailCount}</p>
              <p className="text-sm text-muted-foreground">Conversations email</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ListChecks className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{taskCount}</p>
              <p className="text-sm text-muted-foreground">Tâches actives</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{timelineItems?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Événements total</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              Tout ({timelineItems?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Emails ({emailCount})
            </TabsTrigger>
            <TabsTrigger value="task">
              <ListChecks className="h-4 w-4 mr-2" />
              Tâches ({taskCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-center text-destructive">
            Erreur lors du chargement de la timeline
          </p>
        </Card>
      ) : !filteredItems || filteredItems.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Aucun événement</h3>
            <p className="text-muted-foreground">
              Aucune activité pour cet établissement
            </p>
          </div>
        </Card>
      ) : (
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border hidden md:block" />

          {filteredItems.map((item, index) => (
            <Card
              key={item.id}
              className={cn(
                "relative p-4 transition-all hover:shadow-md",
                item.type === 'email' ? 'cursor-pointer hover:bg-accent/50' : ''
              )}
              onClick={() => {
                if (item.type === 'email') {
                  setSelectedEmailThreadId(item.data.id);
                }
              }}
            >
              {/* Timeline dot */}
              <div className="absolute left-[-36px] top-6 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border">
                {getStatusIcon(item)}
              </div>

              <div className="space-y-3 md:ml-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={item.type === 'email' ? 'default' : 'secondary'}>
                        {item.type === 'email' ? (
                          <>
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </>
                        ) : (
                          <>
                            <ListChecks className="h-3 w-3 mr-1" />
                            Tâche
                          </>
                        )}
                      </Badge>
                      {getStatusBadge(item)}
                      {item.type === 'email' && item.data.priority === 'high' && (
                        <Badge variant="destructive">Priorité haute</Badge>
                      )}
                      {item.type === 'task' && item.data.priorite === 'high' && (
                        <Badge variant="destructive">Priorité haute</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg truncate">
                      {fixMalformedEncoding(item.title)}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(item.date), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.date), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {fixMalformedEncoding(item.description)}
                  </p>
                )}

                {/* Footer info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {item.type === 'email' && (
                    <>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {item.data.message_count} message{item.data.message_count > 1 ? 's' : ''}
                      </span>
                      {item.data.category && (
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {item.data.category}
                          </Badge>
                        </span>
                      )}
                    </>
                  )}
                  {item.type === 'task' && (
                    <>
                      {item.data.categorie && (
                        <span 
                          className="flex items-center gap-1 px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: `${item.data.categorie.couleur}20`,
                            color: item.data.categorie.couleur 
                          }}
                        >
                          {item.data.categorie.nom}
                        </span>
                      )}
                      {item.data.responsable && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.data.responsable.prenom} {item.data.responsable.nom}
                        </span>
                      )}
                      {item.data.echeance && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Échéance: {format(new Date(item.data.echeance), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
