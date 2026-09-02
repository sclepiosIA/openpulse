/**
 * JarvisAutopilotPanel - UI for managing Jarvis automation rules
 * 
 * V11.0: Added pre-configured templates for easy adoption
 */

import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Clock, Trash2, Plus, Zap, RefreshCw, CheckCircle, XCircle, Sparkles, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useJarvisAutopilot, type AutopilotRule, type TriggerType } from '@/hooks/jarvis/useJarvisAutopilot';
import { JarvisAutopilotTemplates } from './JarvisAutopilotTemplates';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRESET_COMMANDS = [
  { label: 'Briefing commercial du matin', command: 'Génère mon briefing commercial du matin' },
  { label: 'Rapport hebdomadaire', command: 'Génère le rapport hebdomadaire de l\'équipe' },
  { label: 'Relance prospects inactifs', command: 'Lance la séquence de relance prospects' },
  { label: 'Prépare le standup', command: 'Prépare le standup hebdomadaire' },
];

interface FormState {
  name: string;
  description: string;
  trigger_type: TriggerType;
  trigger_config: { cron?: string; time?: string; event_type?: string; days?: string[] };
  action_type: string;
  action_config: { command?: string; notify?: boolean };
}

export function JarvisAutopilotPanel() {
  const {
    rules,
    executions,
    isLoadingRules,
    isCreating,
    createRule,
    toggleRule,
    deleteRule,
    getExecutionsForRule,
    activeRulesCount,
  } = useJarvisAutopilot();

  const [activeTab, setActiveTab] = useState<'templates' | 'rules'>('templates');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState<FormState>({
    name: '',
    description: '',
    trigger_type: 'schedule',
    trigger_config: { time: '09:00' },
    action_type: 'jarvis_command',
    action_config: { command: '', notify: true },
  });

  const handleCreateRule = async () => {
    if (!newRule.name || !newRule.action_config.command) return;
    
    try {
      await createRule({
        name: newRule.name,
        description: newRule.description,
        trigger_type: newRule.trigger_type,
        trigger_config: newRule.trigger_config,
        action_type: newRule.action_type,
        action_config: newRule.action_config,
      });
      setIsCreateDialogOpen(false);
      setNewRule({
        name: '',
        description: '',
        trigger_type: 'schedule',
        trigger_config: { time: '09:00' },
        action_type: 'jarvis_command',
        action_config: { command: '', notify: true },
      });
      setActiveTab('rules');
    } catch (e) {
      debug.error('Error creating rule:', e);
    }
  };

  const handleTemplateSelect = async (template: {
    name: string;
    description: string;
    trigger_type: TriggerType;
    trigger_config: FormState['trigger_config'];
    action_type: string;
    action_config: FormState['action_config'];
  }) => {
    await createRule({
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      action_type: template.action_type,
      action_config: template.action_config,
    });
    setActiveTab('rules');
  };

  const getTriggerDescription = (rule: AutopilotRule): string => {
    const days = (rule.trigger_config as FormState['trigger_config']).days;
    if (rule.trigger_config.time && days?.length) {
      const daysStr = days.map(d => d.slice(0, 3)).join(', ');
      return `${daysStr} à ${rule.trigger_config.time}`;
    }
    if (rule.trigger_config.time) return `Tous les jours à ${rule.trigger_config.time}`;
    if (rule.trigger_config.cron) return `CRON: ${rule.trigger_config.cron}`;
    if (rule.trigger_config.event_type) return `Événement: ${rule.trigger_config.event_type}`;
    return 'Configuration personnalisée';
  };

  const totalExecutions = executions?.length || 0;
  const successfulExecutions = executions?.filter(e => e.status === 'success').length || 0;
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0;

  const existingRuleNames = rules?.map(r => r.name) || [];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Règles actives</p>
                <p className="text-lg font-semibold">{activeRulesCount}/{rules?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Exécutions</p>
                <p className="text-lg font-semibold">{totalExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Réussites</p>
                <p className="text-lg font-semibold">{successfulExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Taux succès</p>
                <p className="text-lg font-semibold">{successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Templates / My Rules */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'rules')}>
        <div className="flex items-center justify-between mb-2">
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="templates" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <List className="h-3.5 w-3.5" />
              Mes règles ({rules?.length || 0})
            </TabsTrigger>
          </TabsList>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Personnalisée
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Créer une règle personnalisée</DialogTitle>
                <DialogDescription>Configurez une action que Jarvis exécutera automatiquement.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la règle</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Briefing matinal"
                    value={newRule.name}
                    onChange={e => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optionnel)</Label>
                  <Textarea
                    id="description"
                    placeholder="Décrivez ce que fait cette règle..."
                    value={newRule.description}
                    onChange={e => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure d'exécution</Label>
                  <Input
                    type="time"
                    value={newRule.trigger_config.time || '09:00'}
                    onChange={e => setNewRule(prev => ({ ...prev, trigger_config: { ...prev.trigger_config, time: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commande Jarvis</Label>
                  <Select
                    value={newRule.action_config.command}
                    onValueChange={v => setNewRule(prev => ({ ...prev, action_config: { ...prev.action_config, command: v } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une commande..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_COMMANDS.map(cmd => (
                        <SelectItem key={cmd.command} value={cmd.command}>{cmd.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Ou entrez une commande personnalisée..."
                    value={newRule.action_config.command}
                    onChange={e => setNewRule(prev => ({ ...prev, action_config: { ...prev.action_config, command: e.target.value } }))}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleCreateRule} disabled={isCreating || !newRule.name || !newRule.action_config.command}>
                  {isCreating ? 'Création...' : 'Créer la règle'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-0">
          <ScrollArea className="h-[340px] pr-2">
            <JarvisAutopilotTemplates 
              onSelectTemplate={handleTemplateSelect}
              existingRuleNames={existingRuleNames}
            />
          </ScrollArea>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-0">
          <ScrollArea className="h-[340px]">
            {isLoadingRules ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !rules?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Zap className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune règle d'automatisation</p>
                <p className="text-xs mt-1">Utilisez les templates pour commencer</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setActiveTab('templates')}
                >
                  Voir les templates
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => {
                  const ruleExecutions = getExecutionsForRule(rule.id);
                  const lastExecution = ruleExecutions[0];
                  
                  return (
                    <Card key={rule.id} className={cn("transition-all", !rule.is_active && "opacity-60")}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium truncate">{rule.name}</h4>
                              <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                {rule.is_active ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTriggerDescription(rule)}
                              </span>
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {rule.execution_count} exécutions
                              </span>
                            </div>
                            {lastExecution && (
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                {lastExecution.status === 'success' ? (
                                  <CheckCircle className="h-3 w-3 text-primary" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className="text-muted-foreground">
                                  Dernière: {formatDistanceToNow(new Date(lastExecution.executed_at), { addSuffix: true, locale: fr })}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={checked => toggleRule({ ruleId: rule.id, isActive: checked })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteRule(rule.id)} aria-label="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default JarvisAutopilotPanel;
