import { useMemo, useCallback } from 'react';
import {
  CheckSquare,
  Building2,
  User,
  Calendar,
  Video,
  ListTodo,
  FileText,
  Hash,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

export type SlashActionType = 'insert' | 'trigger-entity' | 'open-modal';
export type EntityFilterType = 'etablissement' | 'tache' | 'contact' | 'groupe' | 'all';

export interface SlashCommand {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  shortcut?: string;
  actionType: SlashActionType;
  insertText?: string;
  entityFilter?: EntityFilterType;
  modalType?: 'task-create' | 'event-create' | 'todo-create' | 'poll-create';
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'tache',
    name: 'Tâche',
    icon: CheckSquare,
    description: 'Créer une nouvelle tâche',
    actionType: 'open-modal',
    modalType: 'task-create',
  },
  {
    id: 'todo',
    name: 'Todo',
    icon: ListTodo,
    description: 'Créer une checklist interactive',
    actionType: 'open-modal',
    modalType: 'todo-create',
  },
  {
    id: 'poll',
    name: 'Sondage',
    icon: BarChart3,
    description: 'Créer un sondage',
    actionType: 'open-modal',
    modalType: 'poll-create',
  },
  {
    id: 'etablissement',
    name: 'Établissement',
    icon: Building2,
    description: 'Lier un établissement',
    shortcut: '#',
    actionType: 'trigger-entity',
    entityFilter: 'etablissement',
  },
  {
    id: 'contact',
    name: 'Contact',
    icon: User,
    description: 'Mentionner un contact',
    actionType: 'trigger-entity',
    entityFilter: 'contact',
  },
  {
    id: 'groupe',
    name: 'Groupe',
    icon: Users,
    description: 'Lier un groupe',
    actionType: 'trigger-entity',
    entityFilter: 'groupe',
  },
  {
    id: 'lier-tache',
    name: 'Lier tâche existante',
    icon: CheckSquare,
    description: 'Lier à une tâche existante',
    actionType: 'trigger-entity',
    entityFilter: 'tache',
  },
  {
    id: 'meeting',
    name: 'Réunion',
    icon: Calendar,
    description: 'Planifier une réunion',
    actionType: 'open-modal',
    modalType: 'event-create',
  },
  {
    id: 'note',
    name: 'Note',
    icon: FileText,
    description: 'Insérer une note',
    actionType: 'insert',
    insertText: '📝 **Note:** ',
  },
  {
    id: 'visio',
    name: 'Visioconférence',
    icon: Video,
    description: 'Démarrer une visio',
    actionType: 'insert',
    insertText: '🎥 **Visio:** ',
  },
  {
    id: 'tag',
    name: 'Tag',
    icon: Hash,
    description: 'Ajouter un tag',
    actionType: 'insert',
    insertText: '#',
  },
];

export function useSlashCommands(query: string = '') {
  const filteredCommands = useMemo(() => {
    if (!query) return SLASH_COMMANDS;
    
    const lowerQuery = query.toLowerCase();
    return SLASH_COMMANDS.filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  const getCommandById = useCallback((id: string) => {
    return SLASH_COMMANDS.find(cmd => cmd.id === id);
  }, []);

  return {
    commands: filteredCommands,
    allCommands: SLASH_COMMANDS,
    getCommandById,
  };
}
