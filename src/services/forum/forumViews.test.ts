/* @vitest-environment jsdom */

import { incrementForumPostView } from './forumViews';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

describe('forumViews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('appelle la RPC increment_view_count avec le post_id fourni', async () => {
    await incrementForumPostView('post-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('increment_view_count', { post_id: 'post-1' });
  });

  it('ne fait rien si postId est une chaîne vide', async () => {
    await incrementForumPostView('');

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propage une erreur si la RPC échoue', async () => {
    const error = new Error('x');
    mockRpc.mockRejectedValueOnce(error);

    await expect(incrementForumPostView('post-err')).rejects.toThrow('x');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('increment_view_count', { post_id: 'post-err' });
  });
});