import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useJarvisFavoritesMutations } from '@/hooks/jarvis/useJarvisFavoritesMutations';

const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {};
  chain.update = (...args: any[]) => { mockUpdate(...args); return chain; };
  chain.insert = (...args: any[]) => { mockInsert(...args); return chain; };
  chain.delete = (...args: any[]) => { mockDelete(); return chain; };
  chain.eq = (...args: any[]) => { mockEq(...args); return chain; };
  chain.select = (...args: any[]) => { mockSelect(...args); return chain; };
  chain.single = (...args: any[]) => {
    mockSingle(...args);
    return Promise.resolve({
      data: { id: 'fav-1', command: '/test', label: 'Test', description: null, icon: null, shortcut_key: '1', usage_count: 0, order_index: 0 },
      error: null,
    });
  };
  return { supabase: { from: vi.fn().mockReturnValue(chain) } };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisFavoritesMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all mutation functions', () => {
    const mutations = useJarvisFavoritesMutations();
    expect(typeof mutations.incrementUsage).toBe('function');
    expect(typeof mutations.addFavorite).toBe('function');
    expect(typeof mutations.removeFavorite).toBe('function');
    expect(typeof mutations.reorderFavorites).toBe('function');
  });

  it('addFavorite inserts with correct data and shows success toast', async () => {
    const mutations = useJarvisFavoritesMutations();
    const result = await mutations.addFavorite('user-1', { command: '/test', label: 'Test' }, 0);
    
    expect(result).toBeDefined();
    expect(result?.id).toBe('fav-1');
    expect(result?.command).toBe('/test');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      command: '/test',
      label: 'Test',
      order_index: 0,
      shortcut_key: '1',
    }));
    expect(toast.success).toHaveBeenCalledWith('Commande ajoutée aux favoris');
  });

  it('addFavorite trims whitespace from command and label', async () => {
    const mutations = useJarvisFavoritesMutations();
    await mutations.addFavorite('user-1', { command: '  /test  ', label: '  Test  ' }, 0);
    
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      command: '/test',
      label: 'Test',
    }));
  });

  it('incrementUsage updates usage_count and last_used_at', async () => {
    const mutations = useJarvisFavoritesMutations();
    await mutations.incrementUsage({
      id: 'fav-1', command: '/test', label: 'Test',
      description: null, icon: null, shortcut_key: '1', usage_count: 5, order_index: 0,
    });
    
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      usage_count: 6,
    }));
    expect(mockEq).toHaveBeenCalledWith('id', 'fav-1');
  });

  it('incrementUsage handles null usage_count', async () => {
    const mutations = useJarvisFavoritesMutations();
    await mutations.incrementUsage({
      id: 'fav-1', command: '/test', label: 'Test',
      description: null, icon: null, shortcut_key: '1', usage_count: null, order_index: 0,
    });
    
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      usage_count: 1,
    }));
  });

  it('removeFavorite deletes by id and shows success toast', async () => {
    const mutations = useJarvisFavoritesMutations();
    await mutations.removeFavorite('fav-1');
    
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'fav-1');
    expect(toast.success).toHaveBeenCalledWith('Favori supprimé');
  });

  it('reorderFavorites updates order_index and shortcut_key for each item', async () => {
    const mutations = useJarvisFavoritesMutations();
    const items = [
      { id: 'a', command: '/a', label: 'A', description: null, icon: null, shortcut_key: null, usage_count: 0, order_index: 2 },
      { id: 'b', command: '/b', label: 'B', description: null, icon: null, shortcut_key: null, usage_count: 0, order_index: 0 },
    ];
    await mutations.reorderFavorites(items);
    
    // First item gets order_index 0, shortcut_key '1'
    expect(mockUpdate).toHaveBeenCalledWith({ order_index: 0, shortcut_key: '1' });
    // Second item gets order_index 1, shortcut_key '2'
    expect(mockUpdate).toHaveBeenCalledWith({ order_index: 1, shortcut_key: '2' });
  });
});
