/**
 * JarvisAutopilotTemplates - Predefined automation rule templates
 * 
 * Templates pour faciliter l'adoption de l'Autopilot avec des règles prêtes à l'emploi
 */

import { useState } from 'react';
import { debug } from '@/lib/debug';
import {
  Sun,
  UserSearch,
  Wallet,
  FileWarning,
  Calendar,
  TrendingUp,
  Mail,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { TriggerType } from '@/hooks/jarvis/useJarvisAutopilot';

export interface AutopilotTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'daily' | 'sales' | 'treasury' | 'operations';
  categoryLabel: string;
  trigger_type: TriggerType;
  trigger_config: {
    time?: string;
    cron?: string;
    event_type?: string;
    days?: string[];
    conditions?: Record<string, unknown>;
  };
  action_type: string;
  action_config: {
    command: string;
    notify?: boolean;
  };
  customizable?: {
    time?: boolean;
    threshold?: boolean;
    days?: boolean;
  };
  popular?: boolean;
}

const AUTOPILOT_TEMPLATES: AutopilotTemplate[] = [
  // === DAILY / ROUTINE ===
  {
    id: 'daily-briefing',
    name: 'Briefing quotidien',
    description: 'Reçois chaque matin un résumé de tes priorités, tâches et alertes importantes',
    icon: <Sun className="h-5 w-5" />,
    category: 'daily',
    categoryLabel: 'Routine',
    trigger_type: 'schedule',
    trigger_config: { time: '08:30', days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Génère mon briefing quotidien avec les priorités, tâches en retard, emails importants et alertes',
      notify: true 
    },
    customizable: { time: true, days: true },
    popular: true,
  },
  {
    id: 'weekly-recap',
    name: 'Récap hebdomadaire',
    description: 'Rapport de fin de semaine avec les performances et objectifs atteints',
    icon: <Calendar className="h-5 w-5" />,
    category: 'daily',
    categoryLabel: 'Routine',
    trigger_type: 'schedule',
    trigger_config: { time: '17:00', days: ['vendredi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Génère le récapitulatif hebdomadaire: tâches complétées, CA généré, prospects avancés, points d\'attention pour la semaine prochaine',
      notify: true 
    },
    customizable: { time: true },
  },

  // === SALES / PROSPECTS ===
  {
    id: 'prospect-followup',
    name: 'Relance prospects froids',
    description: 'Identifie automatiquement les prospects sans contact depuis 7+ jours et prépare des relances',
    icon: <UserSearch className="h-5 w-5" />,
    category: 'sales',
    categoryLabel: 'Commercial',
    trigger_type: 'schedule',
    trigger_config: { time: '09:00', days: ['lundi', 'mercredi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Analyse les prospects sans contact depuis plus de 7 jours, génère des suggestions de relance personnalisées et crée les tâches de suivi',
      notify: true 
    },
    customizable: { time: true, days: true },
    popular: true,
  },
  {
    id: 'deal-stagnation-alert',
    name: 'Alerte deals bloqués',
    description: 'Détecte les opportunités stagnantes et suggère des actions de déblocage',
    icon: <AlertTriangle className="h-5 w-5" />,
    category: 'sales',
    categoryLabel: 'Commercial',
    trigger_type: 'schedule',
    trigger_config: { time: '10:00', days: ['mardi', 'jeudi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Identifie les deals en phase avancée sans progression depuis 14 jours, analyse les blocages potentiels et suggère des actions de déblocage',
      notify: true 
    },
    customizable: { time: true },
  },
  {
    id: 'hot-leads-morning',
    name: 'Leads chauds du jour',
    description: 'Liste des prospects à haute probabilité de conversion à contacter en priorité',
    icon: <TrendingUp className="h-5 w-5" />,
    category: 'sales',
    categoryLabel: 'Commercial',
    trigger_type: 'schedule',
    trigger_config: { time: '08:00' },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Identifie les 5 prospects les plus chauds à contacter aujourd\'hui basé sur leur scoring, dernières interactions et probabilité de closing',
      notify: true 
    },
    customizable: { time: true },
  },

  // === TREASURY / FINANCE ===
  {
    id: 'treasury-daily-check',
    name: 'Check trésorerie quotidien',
    description: 'Vérifie le solde bancaire et alerte si le seuil critique est atteint',
    icon: <Wallet className="h-5 w-5" />,
    category: 'treasury',
    categoryLabel: 'Trésorerie',
    trigger_type: 'schedule',
    trigger_config: { time: '07:30' },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Vérifie le solde bancaire actuel, compare avec les échéances à venir dans les 7 prochains jours et alerte si le solde passe sous 50000€',
      notify: true 
    },
    customizable: { time: true, threshold: true },
    popular: true,
  },
  {
    id: 'unpaid-invoices-alert',
    name: 'Alerte factures impayées',
    description: 'Détecte les factures échues non payées et prépare les relances clients',
    icon: <FileWarning className="h-5 w-5" />,
    category: 'treasury',
    categoryLabel: 'Trésorerie',
    trigger_type: 'schedule',
    trigger_config: { time: '09:30', days: ['lundi', 'jeudi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Liste les factures impayées échues depuis plus de 15 jours, calcule le montant total à recouvrer et génère des emails de relance personnalisés',
      notify: true 
    },
    customizable: { time: true, days: true },
  },
  {
    id: 'cashflow-forecast',
    name: 'Prévision trésorerie',
    description: 'Génère une prévision de trésorerie sur 4 semaines avec alertes de tension',
    icon: <TrendingUp className="h-5 w-5" />,
    category: 'treasury',
    categoryLabel: 'Trésorerie',
    trigger_type: 'schedule',
    trigger_config: { time: '08:00', days: ['lundi'] },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Génère la prévision de trésorerie sur 4 semaines en intégrant les revenus attendus, dépenses planifiées et salaires. Identifie les périodes de tension potentielle',
      notify: true 
    },
    customizable: { time: true },
  },

  // === OPERATIONS ===
  {
    id: 'email-triage',
    name: 'Tri emails urgents',
    description: 'Analyse les nouveaux emails et identifie ceux nécessitant une action immédiate',
    icon: <Mail className="h-5 w-5" />,
    category: 'operations',
    categoryLabel: 'Opérations',
    trigger_type: 'schedule',
    trigger_config: { time: '08:00' },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Analyse les emails non traités des dernières 24h, identifie les urgences et les opportunités commerciales, crée les tâches de suivi appropriées',
      notify: true 
    },
    customizable: { time: true },
  },
  {
    id: 'overdue-tasks-reminder',
    name: 'Rappel tâches en retard',
    description: 'Liste quotidienne des tâches en retard avec priorisation',
    icon: <Clock className="h-5 w-5" />,
    category: 'operations',
    categoryLabel: 'Opérations',
    trigger_type: 'schedule',
    trigger_config: { time: '09:00' },
    action_type: 'jarvis_command',
    action_config: { 
      command: 'Liste toutes mes tâches en retard, priorise-les par urgence et impact, et suggère un plan d\'action pour les traiter aujourd\'hui',
      notify: true 
    },
    customizable: { time: true },
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  daily: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sales: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  treasury: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  operations: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

interface JarvisAutopilotTemplatesProps {
  onSelectTemplate: (template: {
    name: string;
    description: string;
    trigger_type: TriggerType;
    trigger_config: AutopilotTemplate['trigger_config'];
    action_type: string;
    action_config: AutopilotTemplate['action_config'];
  }) => Promise<void>;
  existingRuleNames?: string[];
}

export function JarvisAutopilotTemplates({ 
  onSelectTemplate, 
  existingRuleNames = [] 
}: JarvisAutopilotTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<AutopilotTemplate | null>(null);
  const [customTime, setCustomTime] = useState('09:00');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const handleOpenCustomize = (template: AutopilotTemplate) => {
    setSelectedTemplate(template);
    setCustomTime(template.trigger_config.time || '09:00');
    setSelectedDays(template.trigger_config.days || []);
  };

  const handleConfirmTemplate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    try {
      const triggerConfig = {
        ...selectedTemplate.trigger_config,
        time: customTime,
        ...(selectedDays.length > 0 && { days: selectedDays }),
      };

      await onSelectTemplate({
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        trigger_type: selectedTemplate.trigger_type,
        trigger_config: triggerConfig,
        action_type: selectedTemplate.action_type,
        action_config: selectedTemplate.action_config,
      });

      setSelectedTemplate(null);
    } catch (error) {
      debug.error('Error creating rule from template:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const isRuleAlreadyCreated = (templateName: string) => {
    return existingRuleNames.some(name => 
      name.toLowerCase().includes(templateName.toLowerCase()) ||
      templateName.toLowerCase().includes(name.toLowerCase())
    );
  };

  const popularTemplates = AUTOPILOT_TEMPLATES.filter(t => t.popular);
  const otherTemplates = AUTOPILOT_TEMPLATES.filter(t => !t.popular);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  return (
    <div className="space-y-4">
      {/* Popular Templates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Templates populaires</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {popularTemplates.map(template => {
            const alreadyCreated = isRuleAlreadyCreated(template.name);
            return (
              <Card 
                key={template.id} 
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50 hover:shadow-md",
                  alreadyCreated && "opacity-60"
                )}
                onClick={() => !alreadyCreated && handleOpenCustomize(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      CATEGORY_COLORS[template.category]
                    )}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-medium truncate">{template.name}</h5>
                        {alreadyCreated && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <Badge variant="outline" className={cn("mt-2 text-[10px]", CATEGORY_COLORS[template.category])}>
                        {template.categoryLabel}
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Other Templates by Category */}
      <div>
        <h4 className="text-sm font-medium mb-3">Autres automatisations</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {otherTemplates.map(template => {
            const alreadyCreated = isRuleAlreadyCreated(template.name);
            return (
              <Card 
                key={template.id} 
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/30",
                  alreadyCreated && "opacity-60"
                )}
                onClick={() => !alreadyCreated && handleOpenCustomize(template)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-1.5 rounded-md",
                      CATEGORY_COLORS[template.category]
                    )}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-medium truncate">{template.name}</h5>
                        {alreadyCreated && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", CATEGORY_COLORS[template.category])}>
                      {template.categoryLabel}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Customization Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.icon}
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Time Customization */}
            {selectedTemplate?.customizable?.time && (
              <div className="space-y-2">
                <Label htmlFor="custom-time">Heure d'exécution</Label>
                <Input
                  id="custom-time"
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                />
              </div>
            )}

            {/* Days Customization */}
            {selectedTemplate?.customizable?.days && (
              <div className="space-y-2">
                <Label>Jours d'exécution</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <Button
                      key={day}
                      variant={selectedDays.includes(day) ? "default" : "outline"}
                      size="sm"
                      className="text-xs capitalize"
                      onClick={() => toggleDay(day)}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Command Preview */}
            <div className="space-y-2">
              <Label>Commande Jarvis</Label>
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                "{selectedTemplate?.action_config.command}"
              </div>
            </div>

            {/* Notification Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Notification push</Label>
                <p className="text-xs text-muted-foreground">Recevoir une alerte à chaque exécution</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmTemplate} disabled={isCreating}>
              {isCreating ? 'Création...' : 'Activer cette règle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JarvisAutopilotTemplates;
