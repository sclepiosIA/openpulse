import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { format } from 'date-fns';
import { debug } from '@/lib/debug';
import {
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

export function useCalendarDragDrop() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de mouvement avant activation
      },
    })
  );

  const updateTaskDate = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: Date }) => {
      const { data, error } = await supabase
        .from('taches')
        .update({ echeance: format(newDate, 'yyyy-MM-dd') })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] });
      toast({
        title: 'Tâche déplacée',
        description: 'L\'échéance a été mise à jour avec succès',
      });
    },
    onError: (error) => {
      debug.error('Error updating task date:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de déplacer la tâche',
        variant: 'destructive',
      });
    },
  });

  const handleDragEnd = async (event: DragEndEvent, onDateChange: (taskId: string, newDate: Date) => void) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newDateStr = over.id as string;

    try {
      const newDate = new Date(newDateStr);
      await updateTaskDate.mutateAsync({ taskId, newDate });
      onDateChange(taskId, newDate);
    } catch (error) {
      debug.error('Drag drop error:', error);
    }
  };

  return {
    sensors,
    handleDragEnd,
    isUpdating: updateTaskDate.isPending,
  };
}