import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { useCreatePulseTodoList, useUpdateTodoListMessage } from '@/hooks/pulse/usePulseTodos';
import { useSendPulseMessage } from '@/hooks/pulse/usePulseMessages';

interface TodoCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function TodoCreatorModal({
  open,
  onOpenChange,
  conversationId,
}: TodoCreatorModalProps) {
  const [title, setTitle] = useState('Todo');
  const [items, setItems] = useState<string[]>(['']);
  const [newItem, setNewItem] = useState('');

  const createTodo = useCreatePulseTodoList();
  const sendMessage = useSendPulseMessage();
  const updateTodoMessage = useUpdateTodoListMessage();

  const handleAddItem = useCallback(() => {
    if (newItem.trim()) {
      setItems(prev => [...prev, newItem.trim()]);
      setNewItem('');
    }
  }, [newItem]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateItem = useCallback((index: number, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? value : item));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  }, [handleAddItem]);

  const handleClose = useCallback(() => {
    setTitle('Todo');
    setItems(['']);
    setNewItem('');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCreate = useCallback(() => {
    // Filter out empty items
    const validItems = items.filter(item => item.trim());
    if (validItems.length === 0 && !newItem.trim()) {
      return;
    }

    const finalItems = newItem.trim() 
      ? [...validItems, newItem.trim()] 
      : validItems;

    createTodo.mutate({
      conversationId,
      title: title.trim() || 'Todo',
      items: finalItems,
    }, {
      onSuccess: (todoList) => {
        // Envoyer directement le message avec la référence todo
        const content = `#[${todoList.title}](todo:${todoList.id})`;
        
        sendMessage.mutate({
          conversation_id: conversationId,
          content,
          mentions: [],
        }, {
          onSuccess: (message) => {
            // Lier la todo au message
            if (message?.id) {
              updateTodoMessage.mutate({
                todoListId: todoList.id,
                messageId: message.id,
              });
            }
          },
        });
        
        handleClose();
      },
    });
  }, [conversationId, title, items, newItem, createTodo, sendMessage, updateTodoMessage, handleClose]);

  const hasItems = items.some(i => i.trim()) || newItem.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une Todo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="todo-title">Titre</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la liste"
            />
          </div>

          {/* Existing items */}
          <div className="space-y-2">
            <Label>Éléments</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item, index) => (
                // stable: items are positional editable inputs without ids
                <div key={`todo-item-${index}`} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={item}
                    onChange={(e) => handleUpdateItem(index, e.target.value)}
                    placeholder={`Élément ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="h-8 w-8 flex-shrink-0" aria-label="Supprimer">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new item */}
            <div className="flex items-center gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ajouter un élément..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddItem}
                disabled={!newItem.trim()}
                className="h-9 w-9 flex-shrink-0" aria-label="Ajouter">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!hasItems || createTodo.isPending}
          >
            {createTodo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
