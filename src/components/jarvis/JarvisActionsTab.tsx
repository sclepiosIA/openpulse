import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JarvisProactiveSuggestions } from './JarvisProactiveSuggestions';
import { JarvisActionCard } from './JarvisActionCard';
import type { JarvisPendingAction } from '@/types/jarvis';

/**
 * Onglet « Actions » du panneau unifié Jarvis.
 * Extrait de `JarvisUnifiedPanel.tsx` (S89) pour réduire le god-component.
 */
interface JarvisActionsTabProps {
  pendingActions: JarvisPendingAction[];
  onAskJarvis: (prompt: string) => Promise<void>;
  onApprove: (actionId: string) => Promise<void>;
  onReject: (actionId: string, reason?: string) => Promise<void>;
  onModify: (id: string) => void;
}

export function JarvisActionsTab({
  pendingActions,
  onAskJarvis,
  onApprove,
  onReject,
  onModify,
}: JarvisActionsTabProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-4">
        <JarvisProactiveSuggestions onAskJarvis={onAskJarvis} maxSuggestions={3} />

        {pendingActions.length === 0 && (
          <div className="text-center py-12">
            <motion.div
              className="inline-flex items-center justify-center p-5 rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </motion.div>
            <p className="text-muted-foreground font-medium">Aucune action en attente</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Tout est sous contrôle ✨</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {pendingActions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Actions en attente
              </h4>

              {pendingActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <JarvisActionCard
                    action={action}
                    onApprove={onApprove}
                    onReject={onReject}
                    onModify={onModify}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
