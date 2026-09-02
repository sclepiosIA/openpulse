import React from 'react';
import { useUnifiedTodos, TodoFilter, UnifiedTodo } from '@/hooks/tasks/useUnifiedTodos';
import { TodoItem } from './TodoItem';
import { Loader2, CheckCircle2, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodoListProps {
  filter: TodoFilter;
  projectId?: string;
  etablissementId?: string;
  showDone: boolean;
  search: string;
  onSelectTodo: (todo: UnifiedTodo) => void;
  selectedTodoId?: string;
}

export function TodoList({
  filter,
  projectId,
  etablissementId,
  showDone,
  search,
  onSelectTodo,
  selectedTodoId,
}: TodoListProps) {
  const { data: todos = [], isLoading, error } = useUnifiedTodos({
    filter,
    projectId,
    etablissementId,
    showDone,
    search: search || undefined,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <p>Erreur lors du chargement</p>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        {showDone ? (
          <>
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune tâche</p>
            <p className="text-sm">Ajoutez une nouvelle tâche pour commencer</p>
          </>
        ) : (
          <>
            <Inbox className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Tout est fait !</p>
            <p className="text-sm">Bravo, vous êtes à jour</p>
          </>
        )}
      </div>
    );
  }

  // Group todos by section
  const groupedTodos = groupTodos(todos, filter);

  return (
    <div className="p-3 md:p-4 space-y-4 md:space-y-6">
      {Object.entries(groupedTodos).map(([section, sectionTodos]) => (
        <div key={section}>
          {section !== 'default' && (
            <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              {section}
              <span className="text-[10px] md:text-xs text-muted-foreground/60">
                ({sectionTodos.length})
              </span>
            </h3>
          )}
          <div className="space-y-1.5 md:space-y-1">
            {sectionTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                isSelected={selectedTodoId === todo.id}
                onClick={() => onSelectTodo(todo)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupTodos(todos: UnifiedTodo[], filter: TodoFilter): Record<string, UnifiedTodo[]> {
  // For 'all' filter or when filtering by project/etablissement, group by source
  if (filter === 'all') {
    const groups: Record<string, UnifiedTodo[]> = {
      'En retard': [],
      "Aujourd'hui": [],
      'À venir': [],
      'Sans date': [],
      'Terminées': [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const todo of todos) {
      if (todo.is_done) {
        groups['Terminées'].push(todo);
      } else if (!todo.due_date) {
        groups['Sans date'].push(todo);
      } else {
        const dueDate = new Date(todo.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          groups['En retard'].push(todo);
        } else if (dueDate.getTime() === today.getTime()) {
          groups["Aujourd'hui"].push(todo);
        } else {
          groups['À venir'].push(todo);
        }
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, items]) => items.length > 0)
    );
  }

  // For source filters, group by source type
  if (filter === 'etablissement' || filter === 'personal' || filter === 'shared') {
    const groups: Record<string, UnifiedTodo[]> = {};
    
    for (const todo of todos) {
      let groupName = 'Autres';
      
      if (todo.source === 'etablissement' && todo.etablissement_name) {
        groupName = todo.etablissement_name;
      } else if (todo.source === 'personal' && todo.project_name) {
        groupName = todo.project_name;
      } else if (todo.source === 'pulse' && todo.conversation_name) {
        groupName = `Pulse: ${todo.conversation_name}`;
      } else if (todo.source === 'personal') {
        groupName = 'Personnel';
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(todo);
    }

    return groups;
  }

  // For date filters, no grouping
  return { default: todos };
}
