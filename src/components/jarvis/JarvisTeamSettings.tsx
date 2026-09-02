/**
 * JarvisTeamSettings - Configuration des agents
 * 
 * Permet à l'utilisateur de personnaliser l'équipe d'agents :
 * - Activer/désactiver des agents
 * - Choisir un agent par défaut
 * - Ajuster les niveaux de proactivité
 */

import { useState, useCallback } from 'react';
import { debug } from '@/lib/debug';
import {
  Settings,
  Power,
  Star,
  Bell,
  BellOff,
  Save,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/shared/use-toast';
import { useAuth } from '@/hooks/shared/useAuth';
import { JarvisAgentAvatar } from './JarvisAgentAvatar';
import { AGENT_METADATA } from '@/hooks/jarvis/useJarvisTeam';
import type { AgentId, UserAgentPreferences } from '@/types/jarvis-agents';

interface JarvisTeamSettingsProps {
  initialPreferences?: UserAgentPreferences;
  onSave?: (preferences: UserAgentPreferences) => void;
  className?: string;
}

const ALL_AGENTS: AgentId[] = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

const PROACTIVITY_LEVELS = ['off', 'low', 'medium', 'high'] as const;
const PROACTIVITY_LABELS: Record<string, string> = {
  off: 'Désactivé',
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

export function JarvisTeamSettings({ 
  initialPreferences,
  onSave,
  className 
}: JarvisTeamSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<UserAgentPreferences>(() => ({
    enabledAgents: initialPreferences?.enabledAgents || ALL_AGENTS,
    defaultAgent: initialPreferences?.defaultAgent,
    proactivityLevel: initialPreferences?.proactivityLevel || {
      sophia: 'medium',
      marcus: 'low',
      olivia: 'medium',
      noah: 'low',
      emma: 'medium',
      alex: 'low',
    },
    customNames: initialPreferences?.customNames || {},
  }));

  const [isSaving, setIsSaving] = useState(false);

  const toggleAgent = useCallback((agentId: AgentId) => {
    setPreferences(prev => {
      const isCurrentlyEnabled = prev.enabledAgents.includes(agentId);
      
      // Ne pas permettre de désactiver le dernier agent
      if (isCurrentlyEnabled && prev.enabledAgents.length <= 1) {
        return prev;
      }

      const newEnabled = isCurrentlyEnabled
        ? prev.enabledAgents.filter(id => id !== agentId)
        : [...prev.enabledAgents, agentId];

      // Si l'agent par défaut est désactivé, le retirer
      const newDefault = prev.defaultAgent === agentId && isCurrentlyEnabled
        ? undefined
        : prev.defaultAgent;

      return {
        ...prev,
        enabledAgents: newEnabled,
        defaultAgent: newDefault,
      };
    });
  }, []);

  const setDefaultAgent = useCallback((agentId: AgentId) => {
    setPreferences(prev => ({
      ...prev,
      defaultAgent: prev.defaultAgent === agentId ? undefined : agentId,
    }));
  }, []);

  const setProactivity = useCallback((agentId: AgentId, level: typeof PROACTIVITY_LEVELS[number]) => {
    setPreferences(prev => ({
      ...prev,
      proactivityLevel: {
        ...prev.proactivityLevel,
        [agentId]: level,
      },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      // Sauvegarder en localStorage (plus simple et fiable)
      localStorage.setItem('jarvis-agent-preferences', JSON.stringify(preferences));

      toast({
        title: "Préférences sauvegardées",
        description: "Vos réglages d'équipe ont été enregistrés",
      });

      onSave?.(preferences);
    } catch (error) {
      debug.error('Error saving preferences:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les préférences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, preferences, toast, onSave]);

  const handleReset = useCallback(() => {
    setPreferences({
      enabledAgents: ALL_AGENTS,
      defaultAgent: undefined,
      proactivityLevel: {
        sophia: 'medium',
        marcus: 'low',
        olivia: 'medium',
        noah: 'low',
        emma: 'medium',
        alex: 'low',
      },
      customNames: {},
    });
  }, []);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Configuration de l'équipe</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-1"
          >
            <Save className="h-3.5 w-3.5" />
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Agents list */}
      <div className="space-y-4">
        {ALL_AGENTS.map((agentId) => {
          const agent = AGENT_METADATA[agentId];
          const isEnabled = preferences.enabledAgents.includes(agentId);
          const isDefault = preferences.defaultAgent === agentId;
          const proactivity = preferences.proactivityLevel[agentId] || 'medium';
          const proactivityIndex = PROACTIVITY_LEVELS.indexOf(proactivity);

          return (
            <motion.div
              key={agentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl border transition-colors",
                isEnabled ? "bg-card" : "bg-muted/30 opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <JarvisAgentAvatar
                  agentId={agentId}
                  size="lg"
                  status={isEnabled ? 'idle' : 'error'}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {agent.domain}
                    </Badge>
                    {isDefault && (
                      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                        <Star className="h-2.5 w-2.5" />
                        Par défaut
                      </Badge>
                    )}
                  </div>

                  {/* Proactivity slider */}
                  {isEnabled && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {proactivity === 'off' ? (
                            <BellOff className="h-3 w-3" />
                          ) : (
                            <Bell className="h-3 w-3" />
                          )}
                          Proactivité: {PROACTIVITY_LABELS[proactivity]}
                        </span>
                      </div>
                      <Slider
                        value={[proactivityIndex]}
                        min={0}
                        max={3}
                        step={1}
                        onValueChange={([value]) => {
                          setProactivity(agentId, PROACTIVITY_LEVELS[value]);
                        }}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {/* Enable/Disable */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleAgent(agentId)}
                      disabled={isEnabled && preferences.enabledAgents.length <= 1}
                    />
                    <Power className={cn(
                      "h-4 w-4",
                      isEnabled ? "text-emerald-500" : "text-muted-foreground"
                    )} />
                  </div>

                  {/* Set as default */}
                  {isEnabled && (
                    <Button
                      variant={isDefault ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setDefaultAgent(agentId)}
                    >
                      <Star className={cn("h-3 w-3", isDefault && "fill-current")} />
                      {isDefault ? 'Défaut' : 'Définir'}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Separator />

      {/* Summary */}
      <div className="p-4 rounded-xl bg-muted/50 text-sm">
        <p className="text-muted-foreground">
          <strong>{preferences.enabledAgents.length}</strong> agent(s) actif(s)
          {preferences.defaultAgent && (
            <>
              {' • Agent par défaut: '}
              <strong style={{ color: AGENT_METADATA[preferences.defaultAgent].color }}>
                {AGENT_METADATA[preferences.defaultAgent].name}
              </strong>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
