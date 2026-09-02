const mocks = vi.hoisted(() => {
  type SupabaseError = { message: string };
  type SupabaseResponse = { data: unknown; error: SupabaseError | null };
  type ChainMethod = (...args: unknown[]) => Builder;
  type SingleMethod = (...args: unknown[]) => Promise<SupabaseResponse>;
  type Builder = {
    select: ChainMethod;
    eq: ChainMethod;
    neq: ChainMethod;
    gte: ChainMethod;
    lte: ChainMethod;
    gt: ChainMethod;
    lt: ChainMethod;
    in: ChainMethod;
    is: ChainMethod;
    not: ChainMethod;
    or: ChainMethod;
    filter: ChainMethod;
    match: ChainMethod;
    contains: ChainMethod;
    overlaps: ChainMethod;
    textSearch: ChainMethod;
    order: ChainMethod;
    range: ChainMethod;
    limit: ChainMethod;
    insert: ChainMethod;
    update: ChainMethod;
    upsert: ChainMethod;
    delete: ChainMethod;
    single: SingleMethod;
    maybeSingle: SingleMethod;
    then: Promise<SupabaseResponse>['then'];
    catch: Promise<SupabaseResponse>['catch'];
  };

  const SYNC_DATA = { connections: 3, synced: true };
  const PUBLISH_DATA = {
    published: { facebook: { id: 'post_fb_1' }, linkedin: { id: 'post_li_1' } },
    errors: {},
  };
  const OAUTH_DATA = { auth_url: 'https://app.test/auth' };
  const EMPTY_DATA = {};
  const MISSING_URL_DATA = {};
  const COMMENT_OK_DATA = { ok: true };
  const COMMENT_DATA_ERROR = { error: 'business fail' };
  const EDGE_ERROR = { message: 'edge fail' };
  const INSERT_ERROR = { message: 'insert fail' };

  const EMPTY_RESPONSE: SupabaseResponse = { data: EMPTY_DATA, error: null };
  const SYNC_RESPONSE: SupabaseResponse = { data: SYNC_DATA, error: null };
  const PUBLISH_RESPONSE: SupabaseResponse = { data: PUBLISH_DATA, error: null };
  const OAUTH_RESPONSE: SupabaseResponse = { data: OAUTH_DATA, error: null };
  const MISSING_URL_RESPONSE: SupabaseResponse = { data: MISSING_URL_DATA, error: null };
  const COMMENT_OK_RESPONSE: SupabaseResponse = { data: COMMENT_OK_DATA, error: null };
  const COMMENT_DATA_ERROR_RESPONSE: SupabaseResponse = { data: COMMENT_DATA_ERROR, error: null };
  const EDGE_ERROR_RESPONSE: SupabaseResponse = { data: null, error: EDGE_ERROR };
  const FROM_OK_RESPONSE: SupabaseResponse = { data: null, error: null };
  const FROM_ERROR_RESPONSE: SupabaseResponse = { data: null, error: INSERT_ERROR };

  const invokeResponse: SupabaseResponse = { data: EMPTY_DATA, error: null };
  const fromResponse: SupabaseResponse = { data: null, error: null };

  const setInvokeResponse = (response: SupabaseResponse) => {
    invokeResponse.data = response.data;
    invokeResponse.error = response.error;
  };

  const setFromResponse = (response: SupabaseResponse) => {
    fromResponse.data = response.data;
    fromResponse.error = response.error;
  };

  const builder = {} as Builder;
  const makeChain = () => vi.fn((..._args: unknown[]) => builder);

  const mockInsert = vi.fn((..._args: unknown[]) => builder);
  const mockUpdate = vi.fn((..._args: unknown[]) => builder);
  const mockDelete = vi.fn((..._args: unknown[]) => builder);
  const mockUpsert = vi.fn((..._args: unknown[]) => builder);
  const mockSingle = vi.fn(() => Promise.resolve(fromResponse));
  const mockMaybeSingle = vi.fn(() => Promise.resolve(fromResponse));

  builder.select = makeChain();
  builder.eq = makeChain();
  builder.neq = makeChain();
  builder.gte = makeChain();
  builder.lte = makeChain();
  builder.gt = makeChain();
  builder.lt = makeChain();
  builder.in = makeChain();
  builder.is = makeChain();
  builder.not = makeChain();
  builder.or = makeChain();
  builder.filter = makeChain();
  builder.match = makeChain();
  builder.contains = makeChain();
  builder.overlaps = makeChain();
  builder.textSearch = makeChain();
  builder.order = makeChain();
  builder.range = makeChain();
  builder.limit = makeChain();
  builder.insert = mockInsert;
  builder.update = mockUpdate;
  builder.upsert = mockUpsert;
  builder.delete = mockDelete;
  builder.single = mockSingle;
  builder.maybeSingle = mockMaybeSingle;
  builder.then = ((onfulfilled, onrejected) =>
    Promise.resolve(fromResponse).then(onfulfilled, onrejected)) as Promise<SupabaseResponse>['then'];
  builder.catch = ((onrejected) =>
    Promise.resolve(fromResponse).catch(onrejected)) as Promise<SupabaseResponse>['catch'];

  const mockInvoke = vi.fn(
    (_name: string, _options?: { body?: Record<string, unknown> }) => Promise.resolve(invokeResponse),
  );
  const mockFrom = vi.fn((_table: string) => builder);
  const mockRpc = vi.fn((_name: string, _args?: Record<string, unknown>) => Promise.resolve(EMPTY_RESPONSE));

  return {
    SYNC_DATA,
    PUBLISH_DATA,
    OAUTH_DATA,
    EMPTY_RESPONSE,
    SYNC_RESPONSE,
    PUBLISH_RESPONSE,
    OAUTH_RESPONSE,
    MISSING_URL_RESPONSE,
    COMMENT_OK_RESPONSE,
    COMMENT_DATA_ERROR_RESPONSE,
    EDGE_ERROR,
    INSERT_ERROR,
    EDGE_ERROR_RESPONSE,
    FROM_OK_RESPONSE,
    FROM_ERROR_RESPONSE,
    setInvokeResponse,
    setFromResponse,
    mockInvoke,
    mockFrom,
    mockRpc,
    mockInsert,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.mockInvoke,
    },
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
  },
}));

import { act } from '@testing-library/react';
import {
  performCommentAction,
  publishSocialNow,
  scheduleSocialPost,
  startSocialOAuth,
  syncSocialBrand,
} from './socialEdge';

describe('socialEdge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setInvokeResponse(mocks.EMPTY_RESPONSE);
    mocks.setFromResponse(mocks.FROM_OK_RESPONSE);
  });

  describe('syncSocialBrand', () => {
    it('invoque social-sync avec un brand_id et retourne le résultat métier', async () => {
      mocks.setInvokeResponse(mocks.SYNC_RESPONSE);

      const result = await syncSocialBrand('brand_1');

      expect(result).toEqual(mocks.SYNC_DATA);
      expect(result.connections).toBe(3);
      expect(mocks.mockInvoke).toHaveBeenCalledTimes(1);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-sync', {
        body: { brand_id: 'brand_1' },
      });
    });

    it('invoque social-sync avec un body vide quand aucun brand_id n’est fourni', async () => {
      mocks.setInvokeResponse(mocks.SYNC_RESPONSE);

      const result = await syncSocialBrand();

      expect(result).toEqual(mocks.SYNC_DATA);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-sync', {
        body: {},
      });
    });

    it('rejette quand social-sync retourne une erreur Supabase', async () => {
      mocks.setInvokeResponse(mocks.EDGE_ERROR_RESPONSE);

      await expect(syncSocialBrand('brand_1')).rejects.toEqual(mocks.EDGE_ERROR);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-sync', {
        body: { brand_id: 'brand_1' },
      });
    });
  });

  describe('performCommentAction', () => {
    it('invoque social-comment-reply avec comment_id, action et message', async () => {
      mocks.setInvokeResponse(mocks.COMMENT_OK_RESPONSE);

      let result: void | undefined;
      await act(async () => {
        result = await performCommentAction('comment_1', 'reply', 'Merci pour votre message');
      });

      expect(result).toBeUndefined();
      expect(mocks.mockInvoke).toHaveBeenCalledTimes(1);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-comment-reply', {
        body: {
          comment_id: 'comment_1',
          action: 'reply',
          message: 'Merci pour votre message',
        },
      });
    });

    it('rejette quand la fonction edge retourne une erreur Supabase', async () => {
      mocks.setInvokeResponse(mocks.EDGE_ERROR_RESPONSE);

      await expect(performCommentAction('comment_2', 'hide')).rejects.toEqual(mocks.EDGE_ERROR);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-comment-reply', {
        body: {
          comment_id: 'comment_2',
          action: 'hide',
          message: undefined,
        },
      });
    });

    it('rejette quand la payload contient une erreur métier', async () => {
      mocks.setInvokeResponse(mocks.COMMENT_DATA_ERROR_RESPONSE);

      await expect(performCommentAction('comment_3', 'handle')).rejects.toThrow('business fail');
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-comment-reply', {
        body: {
          comment_id: 'comment_3',
          action: 'handle',
          message: undefined,
        },
      });
    });
  });

  describe('publishSocialNow', () => {
    it('invoque social-publish avec le message, les comptes et le média', async () => {
      mocks.setInvokeResponse(mocks.PUBLISH_RESPONSE);

      const result = await publishSocialNow('Nouveau post', ['acct_fb', 'acct_li'], 'https://cdn.test/img.png');

      expect(result).toEqual(mocks.PUBLISH_DATA);
      expect(result.published).toEqual({
        facebook: { id: 'post_fb_1' },
        linkedin: { id: 'post_li_1' },
      });
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-publish', {
        body: {
          message: 'Nouveau post',
          media_url: 'https://cdn.test/img.png',
          account_ids: ['acct_fb', 'acct_li'],
        },
      });
    });

    it('envoie media_url à undefined quand aucun média n’est fourni', async () => {
      mocks.setInvokeResponse(mocks.PUBLISH_RESPONSE);

      const result = await publishSocialNow('Post sans média', ['acct_fb']);

      expect(result.errors).toEqual({});
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-publish', {
        body: {
          message: 'Post sans média',
          media_url: undefined,
          account_ids: ['acct_fb'],
        },
      });
    });

    it('rejette quand social-publish retourne une erreur Supabase', async () => {
      mocks.setInvokeResponse(mocks.EDGE_ERROR_RESPONSE);

      await expect(publishSocialNow('Post', ['acct_fb'])).rejects.toEqual(mocks.EDGE_ERROR);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-publish', {
        body: {
          message: 'Post',
          media_url: undefined,
          account_ids: ['acct_fb'],
        },
      });
    });
  });

  describe('scheduleSocialPost', () => {
    it('insère une publication planifiée avec les champs Supabase attendus', async () => {
      mocks.setFromResponse(mocks.FROM_OK_RESPONSE);

      await act(async () => {
        await scheduleSocialPost({
          brandId: 'brand_1',
          message: 'Publication planifiée',
          accountIds: ['acct_fb', 'acct_ig'],
          scheduledAt: '2025-01-02T03:04:05.000Z',
          mediaUrl: 'https://cdn.test/social.png',
          createdBy: 'user_1',
        });
      });

      expect(mocks.mockFrom).toHaveBeenCalledTimes(1);
      expect(mocks.mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
      expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
      expect(mocks.mockInsert).toHaveBeenCalledWith({
        brand_id: 'brand_1',
        message: 'Publication planifiée',
        media_paths: ['https://cdn.test/social.png'],
        target_account_ids: ['acct_fb', 'acct_ig'],
        scheduled_at: '2025-01-02T03:04:05.000Z',
        status: 'scheduled',
        created_by: 'user_1',
      });
    });

    it('insère media_paths vide et created_by undefined quand les options sont absentes', async () => {
      mocks.setFromResponse(mocks.FROM_OK_RESPONSE);

      await scheduleSocialPost({
        brandId: 'brand_2',
        message: 'Sans média',
        accountIds: ['acct_tt'],
        scheduledAt: '2025-02-03T04:05:06.000Z',
      });

      expect(mocks.mockInsert).toHaveBeenCalledWith({
        brand_id: 'brand_2',
        message: 'Sans média',
        media_paths: [],
        target_account_ids: ['acct_tt'],
        scheduled_at: '2025-02-03T04:05:06.000Z',
        status: 'scheduled',
        created_by: undefined,
      });
    });

    it('rejette quand l’insertion retourne une erreur Supabase', async () => {
      mocks.setFromResponse(mocks.FROM_ERROR_RESPONSE);

      await expect(
        scheduleSocialPost({
          brandId: 'brand_3',
          message: 'Erreur attendue',
          accountIds: ['acct_fb'],
          scheduledAt: '2025-03-04T05:06:07.000Z',
        }),
      ).rejects.toEqual(mocks.INSERT_ERROR);

      expect(mocks.mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
      expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('startSocialOAuth', () => {
    it('invoque social-oauth-start et retourne auth_url', async () => {
      mocks.setInvokeResponse(mocks.OAUTH_RESPONSE);

      const result = await startSocialOAuth('brand_1', 'instagram', 'https://app.test/ret');

      expect(result).toBe(mocks.OAUTH_DATA.auth_url);
      expect(mocks.mockInvoke).toHaveBeenCalledTimes(1);
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-oauth-start', {
        body: {
          brand_id: 'brand_1',
          platform: 'instagram',
          return_to: 'https://app.test/ret',
        },
      });
    });

    it('rejette quand social-oauth-start retourne une erreur Supabase', async () => {
      mocks.setInvokeResponse(mocks.EDGE_ERROR_RESPONSE);

      await expect(startSocialOAuth('brand_1', 'facebook', 'https://app.test/ret')).rejects.toEqual(
        mocks.EDGE_ERROR,
      );
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-oauth-start', {
        body: {
          brand_id: 'brand_1',
          platform: 'facebook',
          return_to: 'https://app.test/ret',
        },
      });
    });

    it('rejette avec un message explicite quand auth_url est absent', async () => {
      mocks.setInvokeResponse(mocks.MISSING_URL_RESPONSE);

      await expect(startSocialOAuth('brand_2', 'linkedin', 'https://app.test/ret')).rejects.toThrow(
        "URL d'autorisation manquante",
      );
      expect(mocks.mockInvoke).toHaveBeenCalledWith('social-oauth-start', {
        body: {
          brand_id: 'brand_2',
          platform: 'linkedin',
          return_to: 'https://app.test/ret',
        },
      });
    });
  });
});