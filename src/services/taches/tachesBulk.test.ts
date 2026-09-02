const { mockFrom, mockUpdate, mockIn, state } = vi.hoisted(() => {
  const state: { error: { message: string } | null } = { error: null };
  const mockIn = vi.fn(() => Promise.resolve({ data: null, error: state.error }));
  const mockUpdate = vi.fn(() => ({ in: mockIn }));
  const mockFrom = vi.fn(() => ({ update: mockUpdate }));
  return { mockFrom, mockUpdate, mockIn, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

import { bulkAssignTaches, bulkUpdateTacheStatus, bulkArchiveTaches } from './tachesBulk';

describe('tachesBulk', () => {
  beforeEach(() => {
    state.error = null;
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockIn.mockClear();
  });

  describe('bulkAssignTaches', () => {
    it('met à jour responsable_id pour les ids donnés', async () => {
      await bulkAssignTaches(['t1', 't2'], 'resp-42');

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(mockUpdate).toHaveBeenCalledWith({ responsable_id: 'resp-42' });
      expect(mockIn).toHaveBeenCalledWith('id', ['t1', 't2']);
    });

    it('propage une erreur supabase', async () => {
      state.error = { message: 'x' };
      await expect(bulkAssignTaches(['t1'], 'resp-1')).rejects.toEqual({ message: 'x' });
    });
  });

  describe('bulkUpdateTacheStatus', () => {
    it('met à jour le statut sans extra', async () => {
      await bulkUpdateTacheStatus(['a', 'b', 'c'], 'termine');

      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(mockUpdate).toHaveBeenCalledWith({ statut: 'termine' });
      expect(mockIn).toHaveBeenCalledWith('id', ['a', 'b', 'c']);
    });

    it('fusionne les champs extra dans le patch', async () => {
      await bulkUpdateTacheStatus(['a'], 'en_cours', { priorite: 'haute', note: 3 });

      expect(mockUpdate).toHaveBeenCalledWith({
        statut: 'en_cours',
        priorite: 'haute',
        note: 3,
      });
      expect(mockIn).toHaveBeenCalledWith('id', ['a']);
    });

    it('extra peut écraser statut (spread après)', async () => {
      await bulkUpdateTacheStatus(['a'], 'termine', { statut: 'annule' });

      expect(mockUpdate).toHaveBeenCalledWith({ statut: 'annule' });
    });

    it('propage une erreur supabase', async () => {
      state.error = { message: 'x' };
      await expect(bulkUpdateTacheStatus(['a'], 'termine')).rejects.toEqual({ message: 'x' });
    });
  });

  describe('bulkArchiveTaches', () => {
    it('archive les taches ciblées', async () => {
      await bulkArchiveTaches(['z1', 'z2']);

      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(mockUpdate).toHaveBeenCalledWith({ archive: true });
      expect(mockIn).toHaveBeenCalledWith('id', ['z1', 'z2']);
    });

    it('fonctionne avec un tableau vide (appel quand même transmis)', async () => {
      await bulkArchiveTaches([]);

      expect(mockIn).toHaveBeenCalledWith('id', []);
    });

    it('propage une erreur supabase', async () => {
      state.error = { message: 'x' };
      await expect(bulkArchiveTaches(['z1'])).rejects.toEqual({ message: 'x' });
    });
  });
});