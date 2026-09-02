import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSlashCommands } from '../ui/useSlashCommands';

describe('useSlashCommands extended', () => {
  it('returns all commands with empty query', () => {
    const { result } = renderHook(() => useSlashCommands(''));
    expect(result.current.commands.length).toBeGreaterThanOrEqual(9);
  });

  it('returns all commands with no query arg', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.commands.length).toBeGreaterThanOrEqual(9);
  });

  it('allCommands is always full list', () => {
    const { result } = renderHook(() => useSlashCommands('nonexistent'));
    expect(result.current.allCommands.length).toBeGreaterThanOrEqual(9);
    expect(result.current.commands.length).toBe(0);
  });

  it('filters by name', () => {
    const { result } = renderHook(() => useSlashCommands('tâche'));
    expect(result.current.commands.some(c => c.id === 'tache')).toBe(true);
  });

  it('filters by description', () => {
    const { result } = renderHook(() => useSlashCommands('checklist'));
    expect(result.current.commands.some(c => c.id === 'todo')).toBe(true);
  });

  it('case insensitive filtering', () => {
    const { result } = renderHook(() => useSlashCommands('SONDAGE'));
    expect(result.current.commands.some(c => c.id === 'poll')).toBe(true);
  });

  it('getCommandById finds existing command', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.getCommandById('tache')).toBeDefined();
    expect(result.current.getCommandById('tache')!.name).toBe('Tâche');
  });

  it('getCommandById returns undefined for unknown', () => {
    const { result } = renderHook(() => useSlashCommands());
    expect(result.current.getCommandById('nonexistent')).toBeUndefined();
  });

  it('all commands have required fields', () => {
    const { result } = renderHook(() => useSlashCommands());
    result.current.allCommands.forEach(cmd => {
      expect(cmd.id).toBeTruthy();
      expect(cmd.name).toBeTruthy();
      expect(cmd.icon).toBeDefined();
      expect(cmd.description).toBeTruthy();
      expect(cmd.actionType).toBeTruthy();
    });
  });

  it('modal commands have modalType', () => {
    const { result } = renderHook(() => useSlashCommands());
    const modalCmds = result.current.allCommands.filter(c => c.actionType === 'open-modal');
    modalCmds.forEach(cmd => {
      expect(cmd.modalType).toBeTruthy();
    });
  });

  it('insert commands have insertText', () => {
    const { result } = renderHook(() => useSlashCommands());
    const insertCmds = result.current.allCommands.filter(c => c.actionType === 'insert');
    insertCmds.forEach(cmd => {
      expect(cmd.insertText).toBeTruthy();
    });
  });

  it('entity commands have entityFilter', () => {
    const { result } = renderHook(() => useSlashCommands());
    const entityCmds = result.current.allCommands.filter(c => c.actionType === 'trigger-entity');
    entityCmds.forEach(cmd => {
      expect(cmd.entityFilter).toBeTruthy();
    });
  });

  it('no duplicate ids', () => {
    const { result } = renderHook(() => useSlashCommands());
    const ids = result.current.allCommands.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
