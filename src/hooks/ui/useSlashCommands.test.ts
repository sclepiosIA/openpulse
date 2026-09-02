import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { IconComponent } = vi.hoisted(() => ({
  IconComponent: (_props: Record<string, unknown>) => null,
}));

vi.mock('lucide-react', () => ({
  CheckSquare: IconComponent,
  Building2: IconComponent,
  User: IconComponent,
  Calendar: IconComponent,
  Video: IconComponent,
  ListTodo: IconComponent,
  FileText: IconComponent,
  Hash: IconComponent,
  Users: IconComponent,
  BarChart3: IconComponent,
}));

import { useSlashCommands } from './useSlashCommands';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useSlashCommands', () => {
  it('renvoie toutes les commandes par défaut (ordre et valeurs clés)', () => {
    const { result } = renderHook(() => useSlashCommands(), { wrapper: createWrapper() });

    expect(result.current.commands.length).toBe(11);
    expect(result.current.allCommands.length).toBe(11);

    // Ordre initial
    expect(result.current.commands[0]?.id).toBe('tache');
    expect(result.current.commands[1]?.id).toBe('todo');
    expect(result.current.commands[10]?.id).toBe('tag');

    // Assertions sur des valeurs métier réelles
    const note = result.current.commands.find(c => c.id === 'note');
    expect(note?.actionType).toBe('insert');
    expect(note?.insertText).toBe('📝 **Note:** ');

    const etab = result.current.commands.find(c => c.id === 'etablissement');
    expect(etab?.actionType).toBe('trigger-entity');
    expect(etab?.entityFilter).toBe('etablissement');

    const meeting = result.current.commands.find(c => c.id === 'meeting');
    expect(meeting?.actionType).toBe('open-modal');
    expect(meeting?.modalType).toBe('event-create');

    // commands et allCommands doivent référencer les mêmes objets quand pas de query
    expect(result.current.commands).toBe(result.current.allCommands);
  });

  it('filtre les commandes par nom/description (ex: "visio")', () => {
    const { result } = renderHook(() => useSlashCommands('visio'), { wrapper: createWrapper() });
    expect(result.current.commands.length).toBe(1);
    expect(result.current.commands[0]?.id).toBe('visio');
    expect(result.current.commands[0]?.insertText).toBe('🎥 **Visio:** ');
  });

  it('filtre les commandes par description contenant "créer" (3 résultats)', () => {
    const { result } = renderHook(() => useSlashCommands('créer'), { wrapper: createWrapper() });
    const ids = result.current.commands.map(c => c.id).sort();
    expect(result.current.commands.length).toBe(3);
    expect(ids).toEqual(['poll', 'tache', 'todo'].sort());
  });

  it('getCommandById retourne la commande attendue', () => {
    const { result } = renderHook(() => useSlashCommands(), { wrapper: createWrapper() });
    const cmd = result.current.getCommandById('meeting');
    expect(cmd?.id).toBe('meeting');
    expect(cmd?.actionType).toBe('open-modal');
    expect(cmd?.modalType).toBe('event-create');
  });

  it('getCommandById retourne undefined pour un id inconnu', () => {
    const { result } = renderHook(() => useSlashCommands(), { wrapper: createWrapper() });
    const cmd = result.current.getCommandById('inconnu');
    expect(cmd).toBeUndefined();
  });

  it('mémorise le résultat pour une même query (référence stable)', () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSlashCommands(q),
      { initialProps: { q: 'visio' }, wrapper: createWrapper() }
    );
    const firstRef = result.current.commands;
    rerender({ q: 'visio' });
    expect(result.current.commands).toBe(firstRef);
  });
})