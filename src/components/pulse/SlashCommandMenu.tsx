import { useRef, useEffect, useState, useCallback } from 'react';
import { useSlashCommands, type SlashCommand } from '@/hooks/ui/useSlashCommands';
import { cn } from '@/lib/utils';

interface SlashCommandMenuProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  visible: boolean;
}

export function SlashCommandMenu({
  query,
  position,
  onSelect,
  onClose,
  visible,
}: SlashCommandMenuProps) {
  const { commands } = useSlashCommands(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [commands.length, query]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || commands.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % commands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        onSelect(commands[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [visible, commands, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible || commands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-popover border rounded-lg shadow-lg overflow-hidden animate-scale-in"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      <div className="px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          Commandes
        </span>
      </div>
      
      <div className="max-h-[280px] overflow-y-auto py-1">
        {commands.map((command, index) => {
          const Icon = command.icon;
          return (
            <button
              key={command.id}
              onClick={() => onSelect(command)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                index === selectedIndex
                  ? "bg-accent/20 text-foreground"
                  : "hover:bg-accent/10 text-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md",
                index === selectedIndex ? "bg-primary/10" : "bg-muted"
              )}>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{command.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {command.description}
                </div>
              </div>
              {command.shortcut && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  {command.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
          naviguer
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
          sélectionner
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
          fermer
        </span>
      </div>
    </div>
  );
}
