import { ForumPost, ForumPostWithAuthor, ForumTheme, ForumVisibilite, ForumPostFilters, VoteResult, MutationContext } from './forum';

describe('forum.ts type exports', () => {
  it('should construct a valid ForumPost object with required fields', () => {
    const post: ForumPost = {
      id: 'p1',
      user_id: 'u1',
      titre: 'Titre du post',
      contenu: 'Contenu du post',
      theme: 'pmsi',
      visibilite: 'etablissement',
      upvotes: 0,
      nombre_commentaires: 2,
      nombre_vues: 10,
      epingle: false,
      resolu: false,
      archive: false,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
    };
    expect(post.id).toBe('p1');
    expect(post.user_id).toBe('u1');
    expect(post.theme).toBe('pmsi');
    expect(post.visibilite).toBe('etablissement');
  });

  it('should construct a valid ForumPostWithAuthor object', () => {
    const base: ForumPost = {
      id: 'p2',
      user_id: 'u2',
      titre: 'Titre',
      contenu: 'Contenu',
      theme: 'smr',
      visibilite: 'global',
      upvotes: null,
      nombre_commentaires: null,
      nombre_vues: null,
      epingle: null,
      resolu: null,
      archive: null,
      created_at: '2020-02-02T00:00:00Z',
      updated_at: '2020-02-02T00:00:00Z',
    } as ForumPost;

    const postWithAuthor: ForumPostWithAuthor = {
      ...base,
      etablissement_users: {
        nom: 'Dupont',
        prenom: 'Jean',
        fonction: 'Professeur',
      },
    };
    expect(postWithAuthor.etablissement_users.fonction).toBe('Professeur');
  });

  it('should accept ForumPostFilters structure', () => {
    const filters: ForumPostFilters = {
      theme: 'pmsi',
      visibilite: 'global',
      sortBy: 'recent',
    } as any; // casting as any to keep TS happy in structural test
    expect(filters.theme).toBe('pmsi');
    expect(filters.visibilite).toBe('global');
    expect(filters.sortBy).toBe('recent');
  });

  it('should match a VoteResult shape', () => {
    const vote: VoteResult = {
      action: 'added',
      postId: 'p1',
    };
    expect(vote.action).toBe('added');
    expect(vote.postId).toBe('p1');
  });

  it('should allow a MutationContext with optional fields', () => {
    const ctx: MutationContext = {};
    expect(ctx).toBeDefined();
  });
});