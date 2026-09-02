import { describe, it, expect } from 'vitest';
import type {
  TaskForExport,
  GanttTaskForFilter,
  MonitoringContext,
  BreadcrumbData,
} from './taches-export';

describe('taches-export', () => {
  it('définit correctement une tâche export minimale et optionnelle', () => {
    const task: TaskForExport = {
      id: 'task-1',
      titre: 'Préparer le rapport',
      statut: 'en_cours',
      description: 'Compiler les données',
      priorite: 'haute',
      date_debut: '2024-01-10',
      echeance: '2024-01-20',
      categories_taches: {
        id: 'cat-1',
        nom: 'Reporting',
      },
      etablissements: {
        id: 'etab-1',
        nom: 'Clinique du Centre',
      },
      responsable_profile: {
        id: 'user-1',
        nom: 'Dupont',
        prenom: 'Alice',
        email: 'alice@example.test',
      },
    };

    expect(task.id).toBe('task-1');
    expect(task.titre).toBe('Préparer le rapport');
    expect(task.statut).toBe('en_cours');
    expect(task.description).toBe('Compiler les données');
    expect(task.priorite).toBe('haute');
    expect(task.date_debut).toBe('2024-01-10');
    expect(task.echeance).toBe('2024-01-20');
    expect(task.categories_taches?.nom).toBe('Reporting');
    expect(task.etablissements?.nom).toBe('Clinique du Centre');
    expect(task.responsable_profile?.email).toBe('alice@example.test');
  });

  it('accepte une tâche export avec relations nulles et champs optionnels absents', () => {
    const task: TaskForExport = {
      id: 'task-2',
      titre: 'Tâche simple',
      statut: 'a_faire',
      description: null,
      priorite: null,
      date_debut: null,
      echeance: null,
      categories_taches: null,
      etablissements: null,
      responsable_profile: null,
    };

    expect(task.id).toBe('task-2');
    expect(task.titre).toBe('Tâche simple');
    expect(task.statut).toBe('a_faire');
    expect(task.description).toBeNull();
    expect(task.priorite).toBeNull();
    expect(task.date_debut).toBeNull();
    expect(task.echeance).toBeNull();
    expect(task.categories_taches).toBeNull();
    expect(task.etablissements).toBeNull();
    expect(task.responsable_profile).toBeNull();
  });

  it('définit correctement une tâche Gantt avec champs de filtre et de rendu', () => {
    const ganttTask: GanttTaskForFilter = {
      id: 'gantt-1',
      titre: 'Déployer la version',
      description: 'Mise en production',
      statut: 'terminee',
      priorite: 'moyenne',
      echeance: '2024-03-01',
      date_debut: '2024-02-20',
      etablissement_id: 'etab-9',
      responsable_id: 'user-9',
      categorie_id: 'cat-9',
      categories_taches: {
        id: 'cat-9',
        nom: 'Déploiement',
      },
      ordre: 3,
      created_at: '2024-02-01T10:00:00Z',
      updated_at: '2024-02-15T12:00:00Z',
      tags: ['prod', 'urgent'],
      archive: false,
      progression: 100,
      duree_estimee_jours: 10,
      projet_id: 'proj-2',
      date_fin_reelle: '2024-02-28',
      comments_count: 4,
      etablissements: {
        nom: 'Hôpital Nord',
        ville: 'Lyon',
      },
      responsable_profile: {
        nom: 'Martin',
        prenom: 'Jean',
        email: 'jean@example.test',
      },
      profiles: {
        nom: 'Martin',
        prenom: 'Jean',
        email: 'jean@example.test',
      },
    };

    expect(ganttTask.id).toBe('gantt-1');
    expect(ganttTask.titre).toBe('Déployer la version');
    expect(ganttTask.statut).toBe('terminee');
    expect(ganttTask.categorie_id).toBe('cat-9');
    expect(ganttTask.categories_taches?.nom).toBe('Déploiement');
    expect(ganttTask.ordre).toBe(3);
    expect(ganttTask.tags).toEqual(['prod', 'urgent']);
    expect(ganttTask.archive).toBe(false);
    expect(ganttTask.progression).toBe(100);
    expect(ganttTask.duree_estimee_jours).toBe(10);
    expect(ganttTask.comments_count).toBe(4);
    expect(ganttTask.etablissements?.ville).toBe('Lyon');
    expect(ganttTask.responsable_profile?.prenom).toBe('Jean');
    expect(ganttTask.profiles?.email).toBe('jean@example.test');
  });

  it('permet un contexte de monitoring avec propriétés standard et index signature', () => {
    const monitoring: MonitoringContext = {
      component: 'TaskExportDialog',
      action: 'export_csv',
      userId: 'user-1',
      entityId: 'task-44',
      entityType: 'task',
      errorCode: 'none',
      duration: 245,
      success: true,
      retryCount: 0,
      source: 'dashboard',
    };

    expect(monitoring.component).toBe('TaskExportDialog');
    expect(monitoring.action).toBe('export_csv');
    expect(monitoring.userId).toBe('user-1');
    expect(monitoring.entityId).toBe('task-44');
    expect(monitoring.entityType).toBe('task');
    expect(monitoring.errorCode).toBe('none');
    expect(monitoring.duration).toBe(245);
    expect(monitoring.success).toBe(true);
    expect(monitoring.retryCount).toBe(0);
    expect(monitoring.source).toBe('dashboard');
  });

  it('permet des breadcrumbs typés avec champs dynamiques', () => {
    const breadcrumb: BreadcrumbData = {
      route: '/taches/export',
      action: 'open_preview',
      entityId: 'task-77',
      page: 2,
      filtered: true,
      origin: 'gantt',
    };

    expect(breadcrumb.route).toBe('/taches/export');
    expect(breadcrumb.action).toBe('open_preview');
    expect(breadcrumb.entityId).toBe('task-77');
    expect(breadcrumb.page).toBe(2);
    expect(breadcrumb.filtered).toBe(true);
    expect(breadcrumb.origin).toBe('gantt');
  });

  it('importe le module relatif avec les exports runtime attendus inexistants pour des types only', async () => {
    const mod = await import('./taches-export');

    expect(mod).toBeTypeOf('object');
    expect(Object.keys(mod)).toEqual([]);
    expect('TaskForExport' in mod).toBe(false);
    expect('GanttTaskForFilter' in mod).toBe(false);
    expect('MonitoringContext' in mod).toBe(false);
    expect('BreadcrumbData' in mod).toBe(false);
  });
});