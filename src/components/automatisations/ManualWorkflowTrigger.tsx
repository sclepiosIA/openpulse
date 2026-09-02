import { useMemo, useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkflows, useTriggerWorkflowManual } from '@/hooks/workflows/useWorkflows';

interface ManualWorkflowTriggerProps {
  /** Payload contextuel injecté dans `trigger.*` (ex: { etablissement_id, statut_new }) */
  payload?: Record<string, unknown>;
  /** Texte du bouton (par défaut: "Workflows") */
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Bouton réutilisable affichant la liste des workflows à déclencheur "manual"
 * actifs. Permet de lancer un workflow depuis n'importe quelle fiche.
 */
export function ManualWorkflowTrigger({
  payload = {},
  label = 'Workflows',
  variant = 'outline',
  size = 'sm',
}: ManualWorkflowTriggerProps) {
  const { data: all, isLoading } = useWorkflows();
  const triggerMut = useTriggerWorkflowManual();
  const [open, setOpen] = useState(false);

  const manualWorkflows = useMemo(
    () => (all || []).filter((w) => w.trigger_type === 'manual' && w.is_active && !w.is_template),
    [all]
  );

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {label}
      </Button>
    );
  }

  if (manualWorkflows.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={triggerMut.isPending}>
          {triggerMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2 text-amber-500" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 z-50 bg-popover">
        <DropdownMenuLabel>Lancer un workflow</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {manualWorkflows.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => {
              triggerMut.mutate({
                workflow_id: w.id,
                payload: { ...payload, manual: true, started_at: new Date().toISOString() },
              });
              setOpen(false);
            }}
          >
            <Zap className="h-3.5 w-3.5 mr-2 text-amber-500" />
            <span className="truncate">{w.nom}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
