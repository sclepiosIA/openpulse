import {
  ACTIVITY_COLOR_CLASSES,
  ACTIVITY_TYPE_LABELS,
  REACTION_EMOJIS,
  type ActivityFeedFilters,
  type ActivityFeedItem,
  type ActivityFeedPage,
  type ActivityFeedStats,
  type ActivityPin,
  type ActivityReaction,
  type ActivityType,
} from './activity';

describe('activity.ts', () => {
  it('expose les labels attendus pour chaque type', () => {
    const expected: Record<ActivityType, string> = {
      interaction: 'Interactions',
      tache: 'Tâches',
      calendar: 'Événements',
      email: 'Emails',
      devis: 'Devis',
      facture: 'Factures',
      signature: 'Signatures',
      workflow: 'Workflows',
      audit: 'Audit & sécurité',
    };

    expect(ACTIVITY_TYPE_LABELS).toEqual(expected);
    expect(ACTIVITY_TYPE_LABELS.interaction).toBe('Interactions');
    expect(ACTIVITY_TYPE_LABELS.audit).toBe('Audit & sécurité');
  });

  it('expose les classes de couleur métier attendues', () => {
    expect(ACTIVITY_COLOR_CLASSES.blue).toBe('bg-blue-500/10 text-blue-600 dark:text-blue-400');
    expect(ACTIVITY_COLOR_CLASSES.green).toBe('bg-green-500/10 text-green-600 dark:text-green-400');
    expect(ACTIVITY_COLOR_CLASSES.amber).toBe('bg-amber-500/10 text-amber-600 dark:text-amber-400');
    expect(ACTIVITY_COLOR_CLASSES.gray).toBe('bg-muted text-muted-foreground');
    expect(Object.keys(ACTIVITY_COLOR_CLASSES)).toEqual(
      expect.arrayContaining(['blue', 'green', 'amber', 'purple', 'red', 'sky', 'slate', 'gray']),
    );
  });

  it('expose la liste stable des emojis de réaction dans le bon ordre', () => {
    expect(REACTION_EMOJIS).toEqual(['👍', '❤️', '🎉', '👀', '🚀']);
    expect(REACTION_EMOJIS[0]).toBe('👍');
    expect(REACTION_EMOJIS[4]).toBe('🚀');
    expect(new Set(REACTION_EMOJIS).size).toBe(REACTION_EMOJIS.length);
  });

  it('permet de manipuler un item de feed cohérent', () => {
    const item: ActivityFeedItem = {
      id: 'act-1',
      type: 'email',
      occurred_at: '2024-03-01T10:00:00.000Z',
      actor_user_id: 'user-1',
      actor_name: 'Alice Martin',
      etablissement_id: 'eta-1',
      etablissement_nom: 'Clinique du Parc',
      title: 'Email envoyé',
      description: 'Relance du dossier envoyée au client',
      icon: 'mail',
      color: 'blue',
      link: '/emails/act-1',
      metadata: { threadId: 'thr-1', unread: false },
    };

    expect(item.type).toBe('email');
    expect(item.actor_name).toBe('Alice Martin');
    expect(item.etablissement_nom).toBe('Clinique du Parc');
    expect(item.metadata).toEqual({ threadId: 'thr-1', unread: false });
  });

  it('permet de représenter des filtres combinés de feed', () => {
    const filters: ActivityFeedFilters = {
      types: ['interaction', 'workflow'],
      user_ids: ['user-1', 'user-2'],
      etablissement_ids: ['eta-1'],
      date_from: '2024-03-01',
      date_to: '2024-03-31',
      search: 'relance',
    };

    expect(filters.types).toEqual(['interaction', 'workflow']);
    expect(filters.user_ids).toContain('user-2');
    expect(filters.date_from).toBe('2024-03-01');
    expect(filters.search).toBe('relance');
  });

  it('permet de représenter une page paginée avec curseur', () => {
    const page: ActivityFeedPage = {
      items: [
        {
          id: 'act-1',
          type: 'tache',
          occurred_at: '2024-03-10T09:15:00.000Z',
          actor_user_id: 'user-1',
          actor_name: 'Bob',
          etablissement_id: null,
          etablissement_nom: null,
          title: 'Tâche créée',
          description: null,
          icon: 'check-square',
          color: 'green',
          link: '/tasks/1',
          metadata: { priority: 'high' },
        },
      ],
      nextCursor: 'cursor-2',
    };

    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe('Tâche créée');
    expect(page.nextCursor).toBe('cursor-2');
  });

  it('permet de représenter des statistiques agrégées du feed', () => {
    const stats: ActivityFeedStats = {
      today: 3,
      week: 12,
      month: 48,
      by_type: {
        interaction: 8,
        email: 5,
        facture: 2,
      },
      by_user: [
        { user_id: 'user-1', name: 'Alice', count: 7 },
        { user_id: 'user-2', name: 'Bob', count: 4 },
      ],
    };

    expect(stats.today).toBe(3);
    expect(stats.week).toBeGreaterThan(stats.today);
    expect(stats.by_type.email).toBe(5);
    expect(stats.by_user[0]).toEqual({ user_id: 'user-1', name: 'Alice', count: 7 });
  });

  it('permet de représenter une réaction et un pin d’activité', () => {
    const reaction: ActivityReaction = {
      id: 'react-1',
      activity_key: 'activity:act-1',
      user_id: 'user-1',
      emoji: '🎉',
      created_at: '2024-03-10T12:00:00.000Z',
    };

    const pin: ActivityPin = {
      user_id: 'user-1',
      activity_key: 'activity:act-1',
      pinned_at: '2024-03-10T12:05:00.000Z',
      note: 'À suivre cette semaine',
    };

    expect(reaction.emoji).toBe('🎉');
    expect(REACTION_EMOJIS).toContain(reaction.emoji);
    expect(pin.note).toBe('À suivre cette semaine');
    expect(pin.activity_key).toBe(reaction.activity_key);
  });
});