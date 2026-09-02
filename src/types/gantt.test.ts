import * as gantt from './gantt';

describe('gantt.ts', () => {
  it('exporte les unions métier attendues pour les statuts et priorités via des objets compatibles', () => {
    const statusSamples: gantt.TaskStatus[] = ['A faire', 'En cours', 'Bloqué', 'Terminé', 'Annulé'];
    const prioritySamples: gantt.TaskPriority[] = ['low', 'medium', 'high'];

    expect(statusSamples).toEqual(['A faire', 'En cours', 'Bloqué', 'Terminé', 'Annulé']);
    expect(new Set(statusSamples).size).toBe(5);
    expect(prioritySamples).toEqual(['low', 'medium', 'high']);
    expect(new Set(prioritySamples).size).toBe(3);
  });

  it('permet de construire une Task avec les champs principaux et les alias de relations', () => {
    const task: gantt.Task = {
      id: 't1',
      titre: 'Préparer le chantier',
      description: 'Coordonner les intervenants',
      statut: 'En cours',
      priorite: 'high',
      date_debut: '2024-01-10',
      date_echeance: '2024-01-20',
      echeance: '2024-01-20',
      date_fin_reelle: '2024-01-19',
      duree_estimee_jours: 10,
      progression: 60,
      etablissement_id: 'e1',
      responsable_id: 'r1',
      categorie_id: 'c1',
      projet_id: 'p1',
      ordre: 2,
      tags: ['urgent', 'terrain'],
      archive: false,
      created_at: '2024-01-01T08:00:00Z',
      updated_at: '2024-01-15T09:00:00Z',
      comments_count: 4,
      etablissements: {
        nom: 'Clinique du Lac',
        ville: 'Lyon',
      },
      categories_taches: {
        id: 'c1',
        nom: 'Travaux',
        couleur: '#ff9900',
      },
      responsable_profile: {
        nom: 'Martin',
        prenom: 'Alice',
        email: 'alice@example.test',
      },
      profiles: {
        nom: 'Martin',
        prenom: 'Alice',
        email: 'alice@example.test',
      },
    };

    expect(task.titre).toBe('Préparer le chantier');
    expect(task.statut).toBe('En cours');
    expect(task.priorite).toBe('high');
    expect(task.echeance).toBe(task.date_echeance);
    expect(task.tags).toEqual(['urgent', 'terrain']);
    expect(task.archive).toBe(false);
    expect(task.etablissements).toEqual({ nom: 'Clinique du Lac', ville: 'Lyon' });
    expect(task.categories_taches).toEqual({ id: 'c1', nom: 'Travaux', couleur: '#ff9900' });
    expect(task.responsable_profile).toEqual({
      nom: 'Martin',
      prenom: 'Alice',
      email: 'alice@example.test',
    });
    expect(task.comments_count).toBe(4);
  });

  it('permet de construire une TaskWithRelations avec les relations normalisées', () => {
    const taskWithRelations: gantt.TaskWithRelations = {
      id: 't2',
      titre: 'Installer les équipements',
      statut: 'A faire',
      created_at: '2024-02-01T08:00:00Z',
      updated_at: '2024-02-01T08:30:00Z',
      etablissement: {
        nom: 'Hôpital Central',
        slug: 'hopital-central',
      },
      responsable: {
        id: 'u1',
        nom: 'Durand',
        prenom: 'Nina',
        email: 'nina@example.test',
      },
      categorie: {
        nom: 'Installation',
        couleur: '#3366ff',
      },
    };

    expect(taskWithRelations.etablissement?.nom).toBe('Hôpital Central');
    expect(taskWithRelations.etablissement?.slug).toBe('hopital-central');
    expect(taskWithRelations.responsable?.id).toBe('u1');
    expect(taskWithRelations.responsable?.prenom).toBe('Nina');
    expect(taskWithRelations.categorie?.couleur).toBe('#3366ff');
  });

  it('permet de construire une GanttTask avec coordonnées temporelles cohérentes', () => {
    const start = new Date('2024-03-01T00:00:00.000Z');
    const end = new Date('2024-03-11T00:00:00.000Z');

    const ganttTask: gantt.GanttTask = {
      id: 't3',
      titre: 'Suivi de recette',
      statut: 'Terminé',
      progression: 100,
      created_at: '2024-03-01T07:00:00Z',
      updated_at: '2024-03-11T18:00:00Z',
      start,
      end,
      x: 120,
      width: 240,
      progress: 100,
      responsable: {
        id: 'u2',
        nom: 'Petit',
        prenom: 'Leo',
        email: 'leo@example.test',
      },
    };

    expect(ganttTask.start).toBeInstanceOf(Date);
    expect(ganttTask.end).toBeInstanceOf(Date);
    expect(ganttTask.end.getTime()).toBeGreaterThan(ganttTask.start.getTime());
    expect(ganttTask.x).toBe(120);
    expect(ganttTask.width).toBe(240);
    expect(ganttTask.progress).toBe(100);
    expect(ganttTask.statut).toBe('Terminé');
  });

  it('décrit correctement un regroupement gantt', () => {
    const grouping: gantt.GanttGrouping = {
      type: 'category',
      label: 'Par catégorie',
    };

    expect(grouping.type).toBe('category');
    expect(grouping.label).toBe('Par catégorie');
  });

  it('décrit correctement les statistiques gantt', () => {
    const stats: gantt.GanttStats = {
      total: 12,
      completionRate: 75,
      overdue: 2,
      inProgress: 3,
      daysToNextDeadline: 5,
      peopleCount: 4,
    };

    expect(stats.total).toBe(12);
    expect(stats.completionRate).toBe(75);
    expect(stats.overdue).toBe(2);
    expect(stats.inProgress).toBe(3);
    expect(stats.daysToNextDeadline).toBe(5);
    expect(stats.peopleCount).toBe(4);
    expect(stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(stats.completionRate).toBeLessThanOrEqual(100);
  });

  it('décrit correctement les filtres gantt avec tous les champs optionnels', () => {
    const filters: gantt.GanttFilters = {
      etablissements: ['e1', 'e2'],
      responsables: ['u1'],
      categories: ['c1', 'c2'],
      statuts: ['A faire', 'Bloqué'],
      priorites: ['medium', 'high'],
      searchQuery: 'chantier',
      dateDebut: '2024-04-01',
      dateEcheance: '2024-04-30',
    };

    expect(filters.etablissements).toEqual(['e1', 'e2']);
    expect(filters.responsables).toEqual(['u1']);
    expect(filters.categories).toEqual(['c1', 'c2']);
    expect(filters.statuts).toEqual(['A faire', 'Bloqué']);
    expect(filters.priorites).toEqual(['medium', 'high']);
    expect(filters.searchQuery).toBe('chantier');
    expect(filters.dateDebut).toBe('2024-04-01');
    expect(filters.dateEcheance).toBe('2024-04-30');
  });

  it('décrit correctement les options de vue gantt avec un Set de groupes repliés', () => {
    const collapsedGroups = new Set<string>(['Clinique du Lac', 'Travaux']);
    const options: gantt.GanttViewOptions = {
      zoom: 'month',
      groupBy: 'establishment',
      showMilestones: true,
      showHeatmap: false,
      showWeekends: true,
      collapsedGroups,
    };

    expect(options.zoom).toBe('month');
    expect(options.groupBy).toBe('establishment');
    expect(options.showMilestones).toBe(true);
    expect(options.showHeatmap).toBe(false);
    expect(options.showWeekends).toBe(true);
    expect(options.collapsedGroups.size).toBe(2);
    expect(options.collapsedGroups.has('Clinique du Lac')).toBe(true);
    expect(options.collapsedGroups.has('Travaux')).toBe(true);
  });

  it('expose les types TaskRow, TaskInsert et TaskUpdate de manière compatible à la compilation', () => {
    type HasRow = gantt.TaskRow;
    type HasInsert = gantt.TaskInsert;
    type HasUpdate = gantt.TaskUpdate;

    expectTypeOf<HasRow>().toBeObject();
    expectTypeOf<HasInsert>().toBeObject();
    expectTypeOf<HasUpdate>().toBeObject();
  });
});