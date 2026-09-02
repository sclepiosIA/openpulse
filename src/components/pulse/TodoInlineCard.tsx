import { useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { usePulseTodoList, useToggleTodoItem, useAddTodoItem, useDeleteTodoItem } from '@/hooks/pulse/usePulseTodos';
import { cn } from '@/lib/utils';

interface TodoInlineCardProps {
  todoId: string;
}

export function TodoInlineCard({ todoId }: TodoInlineCardProps) {
  const { data: todoList, isLoading, error } = usePulseTodoList(todoId);
  const toggleItem = useToggleTodoItem();
  const addItem = useAddTodoItem();
  const deleteItem = useDeleteTodoItem();

  const [newItemContent, setNewItemContent] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  const handleToggle = useCallback((itemId: string, currentState: boolean) => {
    toggleItem.mutate({ itemId, isDone: !currentState });
  }, [toggleItem]);

  const handleAddItem = useCallback(() => {
    if (!newItemContent.trim() || !todoList) return;
    
    addItem.mutate({ 
      todoListId: todoList.id, 
      content: newItemContent.trim() 
    }, {
      onSuccess: () => {
        setNewItemContent('');
        setIsAddingItem(false);
      }
    });
  }, [newItemContent, todoList, addItem]);

  const handleDeleteItem = useCallback((itemId: string) => {
    if (!todoList) return;
    deleteItem.mutate({ itemId, todoListId: todoList.id });
  }, [todoList, deleteItem]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
    if (e.key === 'Escape') {
      setIsAddingItem(false);
      setNewItemContent('');
    }
  }, [handleAddItem]);

  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-muted/30 rounded-lg border space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    );
  }

  if (error || !todoList) {
    return (
      <div className="mt-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-sm text-destructive">
        Impossible de charger la todo
      </div>
    );
  }

  const items = todoList.items || [];
  const doneCount = items.filter(i => i.is_done).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="mt-3 p-4 bg-card rounded-xl border shadow-sm space-y-3 transition-shadow hover:shadow-md">
      {/* Header with title and progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-1.5 rounded-lg",
            progressPercent === 100 ? "bg-emerald-500/10" : "bg-primary/10"
          )}>
            <CheckCircle2 className={cn(
              "h-4 w-4",
              progressPercent === 100 ? "text-emerald-500" : "text-primary"
            )} />
          </div>
          <span className="font-semibold text-sm">{todoList.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">{doneCount}/{totalCount}</span>
          {progressPercent === 100 && (
            <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Terminé</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={cn(
              "group flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-all",
              item.is_done && "opacity-60"
            )}
          >
            <Checkbox
              checked={item.is_done}
              onCheckedChange={() => handleToggle(item.id, item.is_done)}
              className={cn(
                "h-4 w-4 rounded-full transition-colors",
                item.is_done && "border-emerald-500 bg-emerald-500 text-white"
              )}
            />
            <span className={cn(
              "flex-1 text-sm transition-all",
              item.is_done && "line-through text-muted-foreground"
            )}>
              {item.content}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => handleDeleteItem(item.id)} aria-label="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add item */}
      {isAddingItem ? (
        <div className="flex items-center gap-2 pt-1">
          <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            autoFocus
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nouvel élément..."
            className="h-8 text-sm border-dashed"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddItem}
            disabled={!newItemContent.trim() || addItem.isPending}
            className="h-8 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingItem(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-full py-1.5 px-2 rounded-lg hover:bg-accent/50"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter un élément</span>
        </button>
      )}
    </div>
  );
}
