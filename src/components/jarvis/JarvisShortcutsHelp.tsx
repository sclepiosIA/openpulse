/**
 * JarvisShortcutsHelp - Aide sur les raccourcis clavier
 */

import { useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Shortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'actions' | 'input';
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ['⌘', 'J'], description: 'Ouvrir/fermer Jarvis', category: 'navigation' },
  { keys: ['Escape'], description: 'Fermer le panel', category: 'navigation' },
  { keys: ['⌘', 'K'], description: 'Focus sur la recherche', category: 'navigation' },
  
  // Actions
  { keys: ['⌘', '↵'], description: 'Envoyer le message', category: 'actions' },
  { keys: ['⌘', 'Shift', 'N'], description: 'Nouvelle conversation', category: 'actions' },
  { keys: ['⌘', 'Shift', 'V'], description: 'Activer/désactiver la voix', category: 'actions' },
  
  // Input
  { keys: ['/'], description: 'Ouvrir la palette de commandes', category: 'input' },
  { keys: ['Shift', '↵'], description: 'Nouvelle ligne', category: 'input' },
  { keys: ['↑'], description: 'Message précédent (input vide)', category: 'input' },
];

const CATEGORY_LABELS = {
  navigation: 'Navigation',
  actions: 'Actions',
  input: 'Saisie',
};

interface JarvisShortcutsHelpProps {
  className?: string;
}

export function JarvisShortcutsHelp({ className }: JarvisShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2 text-xs text-muted-foreground hover:text-foreground', className)}
        >
          <Keyboard className="h-3.5 w-3.5 mr-1.5" />
          Raccourcis
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Raccourcis Jarvis
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, shortcuts], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </h4>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={`${category}-shortcut-${shortcut.description}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: categoryIndex * 0.1 + index * 0.05 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={`${shortcut.description}-key-${key}-${keyIndex}`}>
                          <kbd className="px-2 py-1 rounded-md bg-background border border-border text-xs font-mono shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Tapez <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">/</kbd> dans le chat pour voir toutes les commandes
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
