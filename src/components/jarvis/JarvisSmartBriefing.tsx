/**
 * JARVIS 12.0 - Smart Briefing Component
 * 
 * Briefing intelligent personnalisé avec urgences, opportunités et métriques.
 * S'adapte au profil et aux habitudes de l'utilisateur.
 */

import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { motion } from 'framer-motion';
import {
  Flame,
  Lightbulb,
  BarChart3,
  Calendar,
  Mail,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  ArrowUpRight,
  Users,
  Euro,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/shared/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

interface UrgencyItem {
  id: string;
  type: 'invoice' | 'ticket' | 'task' | 'email';
  title: string;
  description: string;
  amount?: number;
  deadline?: string;
  link: string;
  priority: 'high' | 'critical';
}

interface OpportunityItem {
  id: string;
  type: 'lead' | 'upsell' | 'renewal';
  title: string;
  description: string;
  potentialValue?: number;
  confidence: number;
  link: string;
}

interface WeekMetrics {
  caTarget: number;
  caCurrent: number;
  tasksTotal: number;
  tasksDone: number;
  eventsCount: number;
  formationsCount: number;
}

interface BriefingData {
  urgencies: UrgencyItem[];
  opportunities: OpportunityItem[];
  weekMetrics: WeekMetrics;
  lastRefresh: string;
}

interface JarvisSmartBriefingProps {
  className?: string;
  compact?: boolean;
  onItemClick?: (type: string, id: string) => void;
}

export function JarvisSmartBriefing({ 
  className, 
  compact = false,
  onItemClick 
}: JarvisSmartBriefingProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBriefing = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      // Fetch urgencies
      const urgencies = await fetchUrgencies(user.id);
      
      // Fetch opportunities
      const opportunities = await fetchOpportunities(user.id);
      
      // Fetch week metrics
      const weekMetrics = await fetchWeekMetrics(user.id);
      
      setBriefing({
        urgencies,
        opportunities,
        weekMetrics,
        lastRefresh: new Date().toISOString(),
      });
    } catch (error) {
      debug.error('Error fetching briefing:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [user?.id]);

  const handleItemClick = (item: UrgencyItem | OpportunityItem) => {
    if (onItemClick) {
      onItemClick(item.type, item.id);
    } else {
      navigate(item.link);
    }
  };

  if (isLoading) {
    return <BriefingSkeleton compact={compact} className={className} />;
  }

  if (!briefing) {
    return null;
  }

  const today = format(new Date(), "EEEE d MMMM, HH:mm", { locale: fr });
  const caProgress = briefing.weekMetrics.caTarget > 0 
    ? (briefing.weekMetrics.caCurrent / briefing.weekMetrics.caTarget) * 100 
    : 0;
  const taskProgress = briefing.weekMetrics.tasksTotal > 0
    ? (briefing.weekMetrics.tasksDone / briefing.weekMetrics.tasksTotal) * 100
    : 0;

  if (compact) {
    return (
      <CompactBriefing 
        briefing={briefing} 
        onItemClick={handleItemClick}
        onRefresh={fetchBriefing}
        isRefreshing={isRefreshing}
        className={className}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Briefing Jarvis</h2>
            <p className="text-sm text-muted-foreground capitalize">{today}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={fetchBriefing}
          disabled={isRefreshing} aria-label="Actualiser">
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Urgencies Section */}
      {briefing.urgencies.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-destructive" />
              <span>Urgences</span>
              <Badge variant="destructive" className="ml-auto">
                {briefing.urgencies.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              {briefing.urgencies.slice(0, 3).map((item) => (
                <UrgencyCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunities Section */}
      {briefing.opportunities.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span>Opportunités détectées</span>
              <Badge className="ml-auto bg-primary/20 text-primary border-primary/30">
                {briefing.opportunities.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              {briefing.opportunities.slice(0, 3).map((item) => (
                <OpportunityCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Overview */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Votre semaine en un coup d'œil</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {/* CA Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                CA à atteindre
              </span>
              <span className="font-medium">
                {formatCurrency(briefing.weekMetrics.caCurrent)} / {formatCurrency(briefing.weekMetrics.caTarget)}
              </span>
            </div>
            <Progress value={caProgress} className="h-2" />
          </div>

          {/* Tasks Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Tâches critiques
              </span>
              <span className="font-medium">
                {briefing.weekMetrics.tasksDone} / {briefing.weekMetrics.tasksTotal}
              </span>
            </div>
            <Progress value={taskProgress} className="h-2" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Calendar className="h-3.5 w-3.5" />
                Événements
              </div>
              <p className="text-lg font-semibold">{briefing.weekMetrics.eventsCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" />
                Formations
              </div>
              <p className="text-lg font-semibold">{briefing.weekMetrics.formationsCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Sub-components
function UrgencyCard({ item, onClick }: { item: UrgencyItem; onClick: () => void }) {
  const icon = {
    invoice: Euro,
    ticket: AlertTriangle,
    task: Clock,
    email: Mail,
  }[item.type];
  const Icon = icon || AlertTriangle; // Fallback to prevent undefined SVG path

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 text-left transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded bg-destructive/10">
          <Icon className="h-4 w-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
        </div>
        {item.amount && (
          <Badge variant="outline" className="text-destructive border-destructive/30 shrink-0">
            {formatCurrency(item.amount)}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </motion.button>
  );
}

function OpportunityCard({ item, onClick }: { item: OpportunityItem; onClick: () => void }) {
  const icon = {
    lead: TrendingUp,
    upsell: ArrowUpRight,
    renewal: RefreshCw,
  }[item.type];
  const Icon = icon || TrendingUp; // Fallback to prevent undefined SVG path

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 text-left transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.potentialValue && (
            <Badge variant="outline" className="text-primary border-primary/30">
              +{formatCurrency(item.potentialValue)}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {Math.round(item.confidence * 100)}%
          </Badge>
        </div>
      </div>
    </motion.button>
  );
}

function CompactBriefing({ 
  briefing, 
  onItemClick, 
  onRefresh, 
  isRefreshing,
  className 
}: { 
  briefing: BriefingData; 
  onItemClick: (item: UrgencyItem | OpportunityItem) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  className?: string;
}) {
  const urgencyCount = briefing.urgencies.length;
  const opportunityCount = briefing.opportunities.length;

  return (
    <div className={cn('p-3 rounded-lg bg-muted/30 border border-border/50', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Briefing</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} disabled={isRefreshing} aria-label="Actualiser">
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        {urgencyCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {urgencyCount} urgence{urgencyCount > 1 ? 's' : ''}
          </Badge>
        )}
        {opportunityCount > 0 && (
          <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
            {opportunityCount} opportunité{opportunityCount > 1 ? 's' : ''}
          </Badge>
        )}
        {urgencyCount === 0 && opportunityCount === 0 && (
          <span className="text-xs text-muted-foreground">Tout est en ordre 👍</span>
        )}
      </div>
    </div>
  );
}

function BriefingSkeleton({ compact, className }: { compact: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={cn('p-3 rounded-lg bg-muted/30 border border-border/50', className)}>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// Data fetching helpers
async function fetchUrgencies(userId: string): Promise<UrgencyItem[]> {
  const urgencies: UrgencyItem[] = [];
  
  // Fetch overdue invoices
  const { data: invoices } = await supabase
    .from('factures')
    .select('id, numero, montant_ttc, client_nom, date_echeance')
    .eq('statut', 'en_attente')
    .lt('date_echeance', new Date().toISOString())
    .order('date_echeance', { ascending: true })
    .limit(5);
  
  if (invoices) {
    invoices.forEach(inv => {
      const daysOverdue = Math.floor((Date.now() - new Date(inv.date_echeance).getTime()) / (1000 * 60 * 60 * 24));
      urgencies.push({
        id: inv.id,
        type: 'invoice',
        title: `Facture ${inv.numero} - ${inv.client_nom}`,
        description: `En retard de ${daysOverdue} jours`,
        amount: inv.montant_ttc,
        deadline: inv.date_echeance,
        link: `/tresorerie`,
        priority: daysOverdue > 30 ? 'critical' : 'high',
      });
    });
  }
  
  // Fetch critical support tickets
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, titre, priorite, created_at')
    .in('statut', ['ouvert', 'en_cours'])
    .eq('priorite', 'critique')
    .limit(3);
  
  if (tickets) {
    tickets.forEach(ticket => {
      urgencies.push({
        id: ticket.id,
        type: 'ticket',
        title: ticket.titre,
        description: `Ticket critique en attente`,
        link: `/support`,
        priority: 'critical',
      });
    });
  }

  // Fetch overdue tasks
  const { data: tasks } = await supabase
    .from('taches')
    .select('id, titre, echeance, priorite')
    .in('statut', ['A faire', 'En cours'])
    .lt('echeance', new Date().toISOString())
    .order('echeance', { ascending: true })
    .limit(3);

  if (tasks) {
    tasks.forEach(task => {
      urgencies.push({
        id: task.id,
        type: 'task',
        title: task.titre || 'Tâche sans titre',
        description: `Tâche en retard - ${task.priorite || 'Normale'}`,
        deadline: task.echeance || undefined,
        link: `/etablissements`,
        priority: task.priorite === 'high' ? 'critical' : 'high',
      });
    });
  }

  return urgencies.slice(0, 5);
}

async function fetchOpportunities(userId: string): Promise<OpportunityItem[]> {
  const opportunities: OpportunityItem[] = [];
  
  // Fetch hot prospects (recent interactions)
  const { data: prospects } = await supabase
    .from('etablissements')
    .select('id, nom, progression, statut')
    .in('statut', ['Contacté', 'Dans les RDV', 'Attente RDV'])
    .gt('progression', 30)
    .order('updated_at', { ascending: false })
    .limit(3);
  
  if (prospects) {
    prospects.forEach(prospect => {
      opportunities.push({
        id: prospect.id,
        type: 'lead',
        title: prospect.nom,
        description: `Prospect chaud - ${prospect.progression}% de progression`,
        confidence: (prospect.progression || 50) / 100,
        link: `/etablissements/${prospect.id}`,
      });
    });
  }

  // Fetch renewal opportunities
  const { data: renewals } = await supabase
    .from('etablissements')
    .select('id, nom, date_fin_contrat')
    .in('statut', ['Production', 'Contractuel'])
    .not('date_fin_contrat', 'is', null)
    .lt('date_fin_contrat', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
    .gt('date_fin_contrat', new Date().toISOString())
    .limit(3);

  if (renewals) {
    renewals.forEach(renewal => {
      opportunities.push({
        id: renewal.id,
        type: 'renewal',
        title: `Renouvellement ${renewal.nom}`,
        description: `Contrat expire bientôt`,
        confidence: 0.85,
        link: `/etablissements/${renewal.id}`,
      });
    });
  }

  return opportunities.slice(0, 5);
}

async function fetchWeekMetrics(userId: string): Promise<WeekMetrics> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Get tasks count
  const { count: tasksTotal } = await supabase
    .from('taches')
    .select('id', { count: 'exact', head: true })
    .gte('date_echeance', startOfWeek.toISOString())
    .lte('date_echeance', endOfWeek.toISOString());

  const { count: tasksDone } = await supabase
    .from('taches')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'Terminé')
    .gte('date_echeance', startOfWeek.toISOString())
    .lte('date_echeance', endOfWeek.toISOString());

  // Get events count
  const { count: eventsCount } = await supabase
    .from('calendar_events')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', startOfWeek.toISOString())
    .lte('start_time', endOfWeek.toISOString());

  // Get formations count
  const { count: formationsCount } = await supabase
    .from('formation_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('date', startOfWeek.toISOString().split('T')[0])
    .lte('date', endOfWeek.toISOString().split('T')[0]);

  // Récupérer l'objectif CA depuis objectifs_commerciaux (mois courant)
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const { data: objectifData } = await supabase
    .from('objectifs_commerciaux')
    .select('cible_ca')
    .eq('annee', currentYear)
    .eq('mois', currentMonth)
    .maybeSingle();

  const caTarget = objectifData?.cible_ca || 0;

  // Calculer le CA réel du mois courant depuis tresorerie_revenus
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const { data: revenusData } = await supabase
    .from('tresorerie_revenus')
    .select('montant_paye')
    .eq('mois', currentMonthStr);

  const caCurrent = revenusData?.reduce((sum, r) => sum + (r.montant_paye || 0), 0) || 0;

  return {
    caTarget,
    caCurrent,
    tasksTotal: tasksTotal || 0,
    tasksDone: tasksDone || 0,
    eventsCount: eventsCount || 0,
    formationsCount: formationsCount || 0,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
