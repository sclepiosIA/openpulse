import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSlashCommands } from '../ui/useSlashCommands';

describe('useSlashCommands', () => {
  it('returns all commands with no query', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.commands.length).toBeGreaterThanOrEqual(10);
    expect(result.current.allCommands.length).toBeGreaterThanOrEqual(10);
  });

  it('filters by name', () => {
    const { result } = renderHook(() => useSlashCommands('tâche'));
    expect(result.current.commands.length).toBeGreaterThanOrEqual(1);
    expect(result.current.commands.some(c => c.id === 'tache')).toBe(true);
  });

  it('filters by description', () => {
    const { result } = renderHook(() => useSlashCommands('sondage'));
    expect(result.current.commands.some(c => c.id === 'poll')).toBe(true);
  });

  it('returns empty for non-matching query', () => {
    const { result } = renderHook(() => useSlashCommands('xxxxxxx'));
    expect(result.current.commands).toHaveLength(0);
  });

  it('getCommandById returns command', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.getCommandById('note')?.name).toBe('Note');
    expect(result.current.getCommandById('visio')?.name).toBe('Visioconférence');
  });

  it('getCommandById returns undefined for unknown', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.getCommandById('unknown')).toBeUndefined();
  });

  it('all commands have required fields', () => {
    const { result } = renderHook(() => useSlashCommands());
    result.current.allCommands.forEach(cmd => {
      expect(cmd.id).toBeTruthy();
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.icon).toBeDefined();
      expect(cmd.actionType).toBeTruthy();
    });
  });
});
