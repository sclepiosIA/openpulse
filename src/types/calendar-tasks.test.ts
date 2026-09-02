import type { CalendarTask, CalendarTaskEnriched, CalendarViewProps } from './calendar-tasks';

describe('calendar-tasks.ts type surface', () => {
  it('should allow creating a CalendarTask object', () => {
    const t: CalendarTask = {
      id: 't1',
      titre: 'Test Task',
      echeance: null,
      statut: 'open'
    };
    expect(t.id).toBe('t1');
    expect(t.titre).toBe('Test Task');
    expect(t.echeance).toBeNull();
    expect(t.statut).toBe('open');
  });

  it('should allow enriched calendar task', () => {
    const base: CalendarTask = { id: 't2', titre: 'Task 2', echeance: null, statut: 'in_progress' };
    const enriched: CalendarTaskEnriched = {
      ...base,
      date_debut: '2024-01-01',
      duree_estimee_jours: 2,
      progression: 60
    };
    expect(enriched.id).toBe(base.id);
    expect(enriched.date_debut).toBe('2024-01-01');
  });

  it('should type-check CalendarViewProps', () => {
    const t: CalendarTask = { id: 'tv', titre: 'View Task', echeance: null, statut: 'todo' };
    const view: CalendarViewProps = {
      tasks: [t],
      currentMonth: new Date('2024-01-01'),
      onMonthChange: (d: Date) => { /* runtime no-op */ },
      onTaskClick: (task: CalendarTask) => { expect(task.id).toBe('tv'); }
    };
    expect(Array.isArray(view.tasks)).toBe(true);
    expect(view.tasks[0].id).toBe('tv');
  });
});