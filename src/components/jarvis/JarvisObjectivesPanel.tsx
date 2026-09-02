/**
 * JARVIS V11.0 - Objectives Panel
 * 
 * Visualisation et gestion des objectifs pilotés par Jarvis
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Target,
  Plus,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface JarvisObjective {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: 'revenue' | 'productivity' | 'quality' | 'growth' | 'custom';
  target_metric: string;
  target_value: number;
  current_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  milestones: Array<{ value: number; label: string; achieved: boolean; achieved_at: string | null }>;
  progress_history: Array<{ date: string; value: number; delta: number }>;
  created_at: string;
}

const CATEGORY_CONFIG = {
  revenue: { label: 'Revenus', icon: '💰', color: 'bg-emerald-500/10 text-emerald-600' },
  productivity: { label: 'Productivité', icon: '⚡', color: 'bg-blue-500/10 text-blue-600' },
  quality: { label: 'Qualité', icon: '⭐', color: 'bg-amber-500/10 text-amber-600' },
  growth: { label: 'Croissance', icon: '📈', color: 'bg-purple-500/10 text-purple-600' },
  custom: { label: 'Personnalisé', icon: '🎯', color: 'bg-slate-500/10 text-foreground' },
};

const METRIC_OPTIONS = [
  { value: 'ca_mensuel', label: 'CA mensuel', unit: '€', category: 'revenue' },
  { value: 'factures_emises', label: 'Factures émises', unit: '€', category: 'revenue' },
  { value: 'taches_completees', label: 'Tâches complétées', unit: '', category: 'productivity' },
  { value: 'emails_traites', label: 'Emails traités', unit: '', category: 'productivity' },
  { value: 'satisfaction_moyenne', label: 'Satisfaction moyenne', unit: '/5', category: 'quality' },
  { value: 'tickets_resolus', label: 'Tickets résolus', unit: '', category: 'quality' },
  { value: 'nouveaux_etablissements', label: 'Nouveaux établissements', unit: '', category: 'growth' },
  { value: 'prospects_convertis', label: 'Prospects convertis', unit: '', category: 'growth' },
];

const STATUS_CONFIG = {
  active: { label: 'Actif', icon: Play, color: 'text-green-600 bg-green-50' },
  paused: { label: 'En pause', icon: Pause, color: 'text-amber-600 bg-amber-50' },
  completed: { label: 'Atteint', icon: CheckCircle2, color: 'text-blue-600 bg-blue-50' },
  failed: { label: 'Échoué', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  cancelled: { label: 'Annulé', icon: Trash2, color: 'text-foreground bg-slate-50' },
};

export function JarvisObjectivesPanel() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<JarvisObjective | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: objectives, isLoading } = useQuery({
    queryKey: ['jarvis-objectives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_objectives')
        .select('id, user_id, title, description, category, target_metric, target_value, current_value, unit, start_date, end_date, status, priority, milestones, progress_history, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      // Map database types to component types
      return (data || []).map(item => ({
        ...item,
        user_id: item.user_id || '',
        category: item.category as JarvisObjective['category'],
        status: item.status as JarvisObjective['status'],
        priority: (item.priority || 'medium') as JarvisObjective['priority'],
        current_value: item.current_value || 0,
        milestones: (item.milestones as unknown as JarvisObjective['milestones']) || [],
        progress_history: (item.progress_history as unknown as JarvisObjective['progress_history']) || [],
      })) as JarvisObjective[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newObjective: Partial<JarvisObjective>) => {
      if (!user) throw new Error('Non authentifié');

      const milestones = [
        { value: newObjective.target_value! * 0.25, label: '25%', achieved: false, achieved_at: null },
        { value: newObjective.target_value! * 0.5, label: '50%', achieved: false, achieved_at: null },
        { value: newObjective.target_value! * 0.75, label: '75%', achieved: false, achieved_at: null },
        { value: newObjective.target_value!, label: '100%', achieved: false, achieved_at: null },
      ];

      const { data, error } = await supabase
        .from('jarvis_objectives')
        .insert({
          title: newObjective.title!,
          description: newObjective.description || null,
          category: newObjective.category!,
          target_metric: newObjective.target_metric!,
          target_value: newObjective.target_value!,
          unit: newObjective.unit || '',
          start_date: newObjective.start_date!,
          end_date: newObjective.end_date!,
          priority: newObjective.priority || 'medium',
          user_id: user.id,
          milestones: milestones as unknown as never,
        })
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-objectives'] });
      toast.success('Objectif créé avec succès');
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('jarvis_objectives')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-objectives'] });
      toast.success('Statut mis à jour');
    },
  });

  const activeObjectives = objectives?.filter(o => o.status === 'active') || [];
  const completedObjectives = objectives?.filter(o => o.status === 'completed') || [];
  const otherObjectives = objectives?.filter(o => !['active', 'completed'].includes(o.status)) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Objectifs Jarvis</h3>
          <Badge variant="secondary">{activeObjectives.length} actifs</Badge>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nouvel objectif
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Créer un objectif
              </DialogTitle>
            </DialogHeader>
            <CreateObjectiveForm 
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Objectives */}
      {activeObjectives.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">En cours</h4>
          {activeObjectives.map((objective) => (
            <ObjectiveCard 
              key={objective.id} 
              objective={objective}
              onStatusChange={(status) => updateStatusMutation.mutate({ id: objective.id, status })}
              onClick={() => setSelectedObjective(objective)}
            />
          ))}
        </div>
      )}

      {/* Completed Objectives */}
      {completedObjectives.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Atteints 🎉</h4>
          {completedObjectives.slice(0, 3).map((objective) => (
            <ObjectiveCard 
              key={objective.id} 
              objective={objective}
              compact
              onClick={() => setSelectedObjective(objective)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {objectives?.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun objectif défini. Créez votre premier objectif pour que Jarvis vous aide à l'atteindre.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      {selectedObjective && (
        <Dialog open={!!selectedObjective} onOpenChange={() => setSelectedObjective(null)}>
          <DialogContent className="max-w-lg">
            <ObjectiveDetail 
              objective={selectedObjective} 
              onClose={() => setSelectedObjective(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ObjectiveCard({ 
  objective, 
  compact = false,
  onStatusChange,
  onClick 
}: { 
  objective: JarvisObjective; 
  compact?: boolean;
  onStatusChange?: (status: string) => void;
  onClick?: () => void;
}) {
  const progress = objective.target_value > 0 
    ? Math.min(100, (objective.current_value / objective.target_value) * 100)
    : 0;
  
  const daysRemaining = differenceInDays(parseISO(objective.end_date), new Date());
  const categoryConfig = CATEGORY_CONFIG[objective.category];
  const statusConfig = STATUS_CONFIG[objective.status];
  
  // Calculer si on est en avance ou en retard
  const totalDays = differenceInDays(parseISO(objective.end_date), parseISO(objective.start_date));
  const daysElapsed = totalDays - daysRemaining;
  const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const isAhead = progress >= expectedProgress;

  if (compact) {
    return (
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{categoryConfig.icon}</span>
              <span className="font-medium text-sm">{objective.title}</span>
            </div>
            <Badge variant="outline" className={statusConfig.color}>
              <statusConfig.icon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="py-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", categoryConfig.color)}>
                {categoryConfig.icon} {categoryConfig.label}
              </Badge>
              {objective.priority === 'critical' && (
                <Badge variant="destructive" className="text-xs">Critique</Badge>
              )}
            </div>
            {onStatusChange && objective.status === 'active' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange('paused');
                }}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Title & Description */}
          <div>
            <h4 className="font-semibold">{objective.title}</h4>
            {objective.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{objective.description}</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {objective.current_value.toLocaleString('fr-FR')} / {objective.target_value.toLocaleString('fr-FR')} {objective.unit}
              </span>
              <span className={cn(
                "font-medium flex items-center gap-1",
                isAhead ? "text-green-600" : "text-amber-600"
              )}>
                {isAhead ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {progress.toFixed(0)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysRemaining > 0 ? `${daysRemaining}j restants` : 'Expiré'}
            </span>
            <span>
              Fin: {format(parseISO(objective.end_date), 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>

          {/* Milestones */}
          <div className="flex gap-1">
            {objective.milestones?.map((milestone) => (
              <div
                key={`bar-${objective.id}-${milestone.label}`}
                className={cn(
                  "flex-1 h-1 rounded-full",
                  milestone.achieved ? "bg-primary" : "bg-muted"
                )}
                title={`${milestone.label}${milestone.achieved ? ' ✓' : ''}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ObjectiveDetail({ objective, onClose }: { objective: JarvisObjective; onClose: () => void }) {
  const progress = objective.target_value > 0 
    ? (objective.current_value / objective.target_value) * 100
    : 0;

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {CATEGORY_CONFIG[objective.category].icon}
          {objective.title}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <div className="text-2xl font-bold text-primary">{progress.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Progression</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <div className="text-2xl font-bold">
                {differenceInDays(parseISO(objective.end_date), new Date())}j
              </div>
              <div className="text-xs text-muted-foreground">Restants</div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones */}
        <div>
          <h4 className="text-sm font-medium mb-2">Jalons</h4>
          <div className="space-y-2">
            {objective.milestones?.map((milestone) => (
              <div
                key={`milestone-${objective.id}-${milestone.label}`}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg",
                  milestone.achieved ? "bg-primary/10" : "bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  {milestone.achieved ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className="text-sm">{milestone.label}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {milestone.value.toLocaleString('fr-FR')} {objective.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* History Chart placeholder */}
        {objective.progress_history?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Historique</h4>
            <div className="h-20 bg-muted rounded-lg flex items-end gap-1 p-2">
              {objective.progress_history.slice(-20).map((point) => (
                <div
                  key={`history-${objective.id}-${point.date}`}
                  className="flex-1 bg-primary/60 rounded-t"
                  style={{
                    height: `${Math.min(100, (point.value / objective.target_value) * 100)}%`
                  }}
                  title={`${format(parseISO(point.date), 'dd/MM')}: ${point.value}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateObjectiveForm({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (data: Partial<JarvisObjective>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'productivity' as const,
    target_metric: 'taches_completees',
    target_value: 0,
    unit: '',
    end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    priority: 'medium' as const,
  });

  const handleMetricChange = (metric: string) => {
    const metricConfig = METRIC_OPTIONS.find(m => m.value === metric);
    setFormData(prev => ({
      ...prev,
      target_metric: metric,
      unit: metricConfig?.unit || '',
      category: (metricConfig?.category as any) || 'custom',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      start_date: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Titre de l'objectif</Label>
        <Input 
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Ex: Augmenter le CA de 20%"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Description (optionnelle)</Label>
        <Textarea 
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Détails supplémentaires..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Métrique</Label>
          <Select value={formData.target_metric} onValueChange={handleMetricChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Objectif cible</Label>
          <div className="flex gap-2">
            <Input 
              type="number"
              value={formData.target_value || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, target_value: Number(e.target.value) }))}
              placeholder="100"
              required
              className="flex-1"
            />
            <span className="flex items-center text-sm text-muted-foreground w-12">
              {formData.unit}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date limite</Label>
          <Input 
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Priorité</Label>
          <Select 
            value={formData.priority} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="medium">Moyenne</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Création...' : 'Créer l\'objectif'}
      </Button>
    </form>
  );
}

export default JarvisObjectivesPanel;
