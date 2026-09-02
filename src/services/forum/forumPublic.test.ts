import { act } from '@testing-library/react';
import {
  fetchAnonymousForumComments,
  fetchAnonymousForumPosts,
  fetchForumEtablissementsForPost,
  fetchForumPostAuthorIsTeamMember,
  invokeForumAction,
} from './forumPublic';

const {
  FORUM_POSTS,
  FORUM_COMMENTS,
  ETABLISSEMENTS,
  mockFrom,
  mockInvoke,
  mockQueryBuilder,
  resetSupabaseMocks,
  setTableResponse,
  setInvokeResponse,
  POSTS_ERROR_RESULT,
  COMMENTS_ERROR_RESULT,
  ETABLISSEMENTS_ERROR_RESULT,
  ROLE_ERROR_RESULT,
  INVOKE_ERROR_RESULT,
  NO_ROLE_RESULT,
} = vi.hoisted(() => {
  type SupabaseError = { message: string };
  type QueryResult = { data: unknown; error: SupabaseError | null };
  type MockBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  };

  const FORUM_POSTS = [
    {
      id: 'p1',
      titre: 'Question sur le déploiement',
      contenu: 'Comment préparer une mise en production propre ?',
      theme: 'entraide',
      author_nom: 'Martin',
      author_prenom: 'Lina',
      author_role: 'csm',
      author_service: 'Accompagnement',
      author_etablissement_nom: 'Clinique Nord',
      created_at: '2024-05-03T10:00:00.000Z',
      upvotes: 7,
      nombre_commentaires: 2,
      nombre_vues: 41,
      epingle: true,
      resolu: false,
      archive: false,
      updated_at: '2024-05-04T08:00:00.000Z',
      visibilite: 'global',
      modere: false,
    },
    {
      id: 'p2',
      titre: 'Retour terrain',
      contenu: 'Partage de bonnes pratiques entre équipes.',
      theme: 'partage',
      author_nom: null,
      author_prenom: null,
      author_role: null,
      author_service: null,
      author_etablissement_nom: 'Hôpital Sud',
      created_at: '2024-05-01T09:30:00.000Z',
      upvotes: 3,
      nombre_commentaires: 1,
      nombre_vues: 18,
      epingle: false,
      resolu: true,
      archive: false,
      updated_at: null,
      visibilite: 'global',
      modere: false,
    },
  ];

  const FORUM_COMMENTS = [
    {
      id: 'c1',
      contenu: 'Merci pour cette question.',
      author_nom: 'Durand',
      author_prenom: 'Noé',
      author_etablissement_nom: 'Clinique Nord',
      created_at: '2024-05-03T11:00:00.000Z',
      upvotes: 4,
    },
    {
      id: 'c2',
      contenu: 'Nous utilisons une liste de contrôle.',
      author_nom: null,
      author_prenom: null,
      author_etablissement_nom: 'Hôpital Sud',
      created_at: '2024-05-03T12:00:00.000Z',
      upvotes: 1,
    },
  ];

  const ETABLISSEMENTS = [
    {
      id: 'e1',
      nom: 'Clinique Nord',
      ville: 'Lille',
      statut: 'Production',
    },
    {
      id: 'e2',
      nom: 'Hôpital Sud',
      ville: null,
      statut: 'Déploiement',
    },
  ];

  const ROLE_ROW = { role: 'csm' };

  const POSTS_SUCCESS_RESULT: QueryResult = { data: FORUM_POSTS, error: null };
  const COMMENTS_SUCCESS_RESULT: QueryResult = { data: FORUM_COMMENTS, error: null };
  const ETABLISSEMENTS_SUCCESS_RESULT: QueryResult = { data: ETABLISSEMENTS, error: null };
  const ROLE_SUCCESS_RESULT: QueryResult = { data: ROLE_ROW, error: null };
  const INVOKE_SUCCESS_RESULT: QueryResult = { data: null, error: null };

  const POSTS_ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  const COMMENTS_ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  const ETABLISSEMENTS_ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  const ROLE_ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  const INVOKE_ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };
  const NO_ROLE_RESULT: QueryResult = { data: null, error: null };

  const tableResults: Record<string, QueryResult> = {
    forum_posts: POSTS_SUCCESS_RESULT,
    forum_comments: COMMENTS_SUCCESS_RESULT,
    etablissements: ETABLISSEMENTS_SUCCESS_RESULT,
    user_roles: ROLE_SUCCESS_RESULT,
  };

  let activeTable = '';
  let invokeResult: QueryResult = INVOKE_SUCCESS_RESULT;
  let builder: MockBuilder;

  const getCurrentResult = (): QueryResult => tableResults[activeTable] ?? { data: null, error: null };
  const returnBuilder = (): MockBuilder => builder;

  builder = {
    select: vi.fn(returnBuilder),
    eq: vi.fn(returnBuilder),
    neq: vi.fn(returnBuilder),
    gte: vi.fn(returnBuilder),
    lte: vi.fn(returnBuilder),
    gt: vi.fn(returnBuilder),
    lt: vi.fn(returnBuilder),
    in: vi.fn(returnBuilder),
    order: vi.fn(returnBuilder),
    limit: vi.fn(returnBuilder),
    insert: vi.fn(returnBuilder),
    update: vi.fn(returnBuilder),
    delete: vi.fn(returnBuilder),
    upsert: vi.fn(returnBuilder),
    match: vi.fn(returnBuilder),
    is: vi.fn(returnBuilder),
    not: vi.fn(returnBuilder),
    contains: vi.fn(returnBuilder),
    range: vi.fn(returnBuilder),
    single: vi.fn(() => Promise.resolve(getCurrentResult())),
    maybeSingle: vi.fn(() => Promise.resolve(getCurrentResult())),
    then: vi.fn(
      (
        onFulfilled: ((value: QueryResult) => unknown) | null = null,
        onRejected: ((reason: unknown) => unknown) | null = null,
      ) => Promise.resolve(getCurrentResult()).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected: ((reason: unknown) => unknown) | null = null) =>
      Promise.resolve(getCurrentResult()).catch(onRejected),
    ),
  };

  const mockFrom = vi.fn((table: string) => {
    activeTable = table;
    return builder;
  });

  const mockInvoke = vi.fn((_functionName: string, _options: { body: Record<string, unknown> }) =>
    Promise.resolve(invokeResult),
  );

  const resetSupabaseMocks = (): void => {
    activeTable = '';
    tableResults.forum_posts = POSTS_SUCCESS_RESULT;
    tableResults.forum_comments = COMMENTS_SUCCESS_RESULT;
    tableResults.etablissements = ETABLISSEMENTS_SUCCESS_RESULT;
    tableResults.user_roles = ROLE_SUCCESS_RESULT;
    invokeResult = INVOKE_SUCCESS_RESULT;
  };

  const setTableResponse = (table: string, response: QueryResult): void => {
    tableResults[table] = response;
  };

  const setInvokeResponse = (response: QueryResult): void => {
    invokeResult = response;
  };

  return {
    FORUM_POSTS,
    FORUM_COMMENTS,
    ETABLISSEMENTS,
    mockFrom,
    mockInvoke,
    mockQueryBuilder: builder,
    resetSupabaseMocks,
    setTableResponse,
    setInvokeResponse,
    POSTS_ERROR_RESULT,
    COMMENTS_ERROR_RESULT,
    ETABLISSEMENTS_ERROR_RESULT,
    ROLE_ERROR_RESULT,
    INVOKE_ERROR_RESULT,
    NO_ROLE_RESULT,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

describe('forumPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMocks();
  });

  it('fetchAnonymousForumPosts retourne les posts publics modérés et applique les filtres attendus', async () => {
    const posts = await fetchAnonymousForumPosts();

    expect(posts).toEqual(FORUM_POSTS);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({
      id: 'p1',
      titre: 'Question sur le déploiement',
      theme: 'entraide',
      author_nom: 'Martin',
      upvotes: 7,
      nombre_commentaires: 2,
      epingle: true,
      resolu: false,
      visibilite: 'global',
      modere: false,
    });

    expect(mockFrom).toHaveBeenCalledWith('forum_posts');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      'id, titre, contenu, theme, author_nom, author_prenom, author_role, author_service, author_etablissement_nom, created_at, upvotes, nombre_commentaires, nombre_vues, epingle, resolu, archive, updated_at, visibilite, modere',
    );
    expect(mockQueryBuilder.eq).toHaveBeenNthCalledWith(1, 'visibilite', 'global');
    expect(mockQueryBuilder.eq).toHaveBeenNthCalledWith(2, 'modere', false);
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('fetchAnonymousForumPosts rejette avec l erreur Supabase', async () => {
    setTableResponse('forum_posts', POSTS_ERROR_RESULT);

    await expect(fetchAnonymousForumPosts()).rejects.toMatchObject({ message: 'x' });

    expect(mockFrom).toHaveBeenCalledWith('forum_posts');
    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('fetchAnonymousForumComments retourne les commentaires anonymisés du post demandé', async () => {
    const comments = await fetchAnonymousForumComments('p1');

    expect(comments).toEqual(FORUM_COMMENTS);
    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({
      id: 'c1',
      contenu: 'Merci pour cette question.',
      author_nom: 'Durand',
      author_prenom: 'Noé',
      author_etablissement_nom: 'Clinique Nord',
      upvotes: 4,
    });

    expect(mockFrom).toHaveBeenCalledWith('forum_comments');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      'id, contenu, author_nom, author_prenom, author_etablissement_nom, created_at, upvotes',
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('post_id', 'p1');
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('fetchAnonymousForumComments rejette avec l erreur Supabase', async () => {
    setTableResponse('forum_comments', COMMENTS_ERROR_RESULT);

    await expect(fetchAnonymousForumComments('p1')).rejects.toMatchObject({ message: 'x' });

    expect(mockFrom).toHaveBeenCalledWith('forum_comments');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('post_id', 'p1');
  });

  it('invokeForumAction appelle la fonction edge forum-actions avec le body fourni', async () => {
    const body = { action: 'upvote', postId: 'p1' };

    await act(async () => {
      await invokeForumAction(body);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('forum-actions', { body });
  });

  it('invokeForumAction rejette quand la fonction edge retourne une erreur', async () => {
    const body = { action: 'comment', postId: 'p1' };
    setInvokeResponse(INVOKE_ERROR_RESULT);

    await expect(invokeForumAction(body)).rejects.toMatchObject({ message: 'x' });

    expect(mockInvoke).toHaveBeenCalledWith('forum-actions', { body });
  });

  it('fetchForumEtablissementsForPost retourne les établissements en production ou déploiement triés par nom', async () => {
    const etablissements = await fetchForumEtablissementsForPost();

    expect(etablissements).toEqual(ETABLISSEMENTS);
    expect(etablissements).toHaveLength(2);
    expect(etablissements[0]).toMatchObject({
      id: 'e1',
      nom: 'Clinique Nord',
      ville: 'Lille',
      statut: 'Production',
    });
    expect(etablissements[1]).toMatchObject({
      id: 'e2',
      nom: 'Hôpital Sud',
      ville: null,
      statut: 'Déploiement',
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('id, nom, ville, statut');
    expect(mockQueryBuilder.in).toHaveBeenCalledWith('statut', ['Production', 'Déploiement']);
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('nom');
  });

  it('fetchForumEtablissementsForPost rejette avec l erreur Supabase', async () => {
    setTableResponse('etablissements', ETABLISSEMENTS_ERROR_RESULT);

    await expect(fetchForumEtablissementsForPost()).rejects.toMatchObject({ message: 'x' });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockQueryBuilder.in).toHaveBeenCalledWith('statut', ['Production', 'Déploiement']);
  });

  it('fetchForumPostAuthorIsTeamMember retourne true quand le rôle utilisateur fait partie de l équipe', async () => {
    const isTeamMember = await fetchForumPostAuthorIsTeamMember('u1');

    expect(isTeamMember).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('role');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(mockQueryBuilder.in).toHaveBeenCalledWith('role', ['admin', 'csm', 'chef_projet', 'commercial']);
    expect(mockQueryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('fetchForumPostAuthorIsTeamMember retourne false sans rôle correspondant', async () => {
    setTableResponse('user_roles', NO_ROLE_RESULT);

    await expect(fetchForumPostAuthorIsTeamMember('u2')).resolves.toBe(false);

    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'u2');
    expect(mockQueryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('fetchForumPostAuthorIsTeamMember retourne false quand Supabase renvoie une erreur', async () => {
    setTableResponse('user_roles', ROLE_ERROR_RESULT);

    await expect(fetchForumPostAuthorIsTeamMember('u3')).resolves.toBe(false);

    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'u3');
    expect(mockQueryBuilder.in).toHaveBeenCalledWith('role', ['admin', 'csm', 'chef_projet', 'commercial']);
  });
});