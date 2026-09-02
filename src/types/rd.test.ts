import { DPI_CONFIG, KANBAN_COLUMNS, STORY_POINTS, PRIORITE_CONFIG } from './rd';

describe('rd module configuration', () => {
  it('DPI_CONFIG should have correct labels and colors for each DPI', () => {
    expect(DPI_CONFIG.hm).toEqual({
      label: 'HM',
      color: 'hsl(var(--primary))',
    });

    expect(DPI_CONFIG.resurgences).toEqual({
      label: 'Résurgences',
      color: 'hsl(var(--secondary))',
    });

    expect(DPI_CONFIG.transverse).toEqual({
      label: 'Transverse',
      color: 'hsl(var(--accent))',
    });
  });

  it('KANBAN_COLUMNS should define the expected columns in order with labels and colors', () => {
    expect(KANBAN_COLUMNS).toHaveLength(5);

    expect(KANBAN_COLUMNS[0]).toEqual({
      id: 'backlog',
      label: 'Backlog',
      color: 'hsl(var(--muted))',
    });

    expect(KANBAN_COLUMNS[1]).toEqual({
      id: 'todo',
      label: 'À faire',
      color: 'hsl(var(--primary))',
    });

    expect(KANBAN_COLUMNS[2]).toEqual({
      id: 'in_progress',
      label: 'En cours',
      color: 'hsl(var(--warning))',
    });

    expect(KANBAN_COLUMNS[3]).toEqual({
      id: 'review',
      label: 'Review',
      color: 'hsl(var(--secondary))',
    });

    expect(KANBAN_COLUMNS[4]).toEqual({
      id: 'done',
      label: 'Terminé',
      color: 'hsl(var(--success))',
    });
  });

  it('STORY_POINTS should contain the standard Fibonacci-like sequence used in agile', () => {
    expect(STORY_POINTS).toEqual([1, 2, 3, 5, 8, 13, 21]);
  });

  it('PRIORITE_CONFIG should have correct labels and colors for each priority', () => {
    expect(PRIORITE_CONFIG.low).toEqual({
      label: 'Basse',
      color: 'hsl(var(--muted-foreground))',
    });

    expect(PRIORITE_CONFIG.medium).toEqual({
      label: 'Moyenne',
      color: 'hsl(var(--primary))',
    });

    expect(PRIORITE_CONFIG.high).toEqual({
      label: 'Haute',
      color: 'hsl(var(--warning))',
    });

    expect(PRIORITE_CONFIG.critical).toEqual({
      label: 'Critique',
      color: 'hsl(var(--destructive))',
    });
  });
});