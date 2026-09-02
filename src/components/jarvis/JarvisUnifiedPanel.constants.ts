import {
  MessageSquare,
  Users,
  Lightbulb,
  Workflow,
  Brain,
  ListTodo,
  FileText,
  BarChart3,
  Settings,
  Database,
  Mail,
  Calendar,
  Search,
  Zap,
} from 'lucide-react';

/** Mapping nom d'outil Jarvis → icône lucide */
export const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'query_database': return Database;
    case 'send_email': return Mail;
    case 'schedule_meeting':
    case 'create_task': return Calendar;
    case 'search_knowledge_base': return Search;
    default: return Zap;
  }
};

/** Tab configuration with Team mode + new tabs for v9.0 */
export const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'team', label: 'Équipe', icon: Users },
  { id: 'intelligence', label: 'Intelligence', icon: Lightbulb },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'predictions', label: 'Prédictions', icon: Brain },
  { id: 'actions', label: 'Actions', icon: ListTodo },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Paramètres', icon: Settings },
] as const;
