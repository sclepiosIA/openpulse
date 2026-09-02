import { describe, it, expect } from 'vitest';
import {
  SUPABASE_VIEWS,
  type PrevisionWithEtablissement,
  type UserEmailAccountSafe,
  type ParsedBulletinData,
} from '../supabase-helpers';

describe('supabase-helpers', () => {
  describe('SUPABASE_VIEWS', () => {
    it('has all expected views', () => {
      expect(SUPABASE_VIEWS.USER_EMAIL_ACCOUNTS_SAFE).toBe('user_email_accounts_safe');
      expect(SUPABASE_VIEWS.PREVISIONS_PIPELINE).toBe('previsions_pipeline');
      expect(SUPABASE_VIEWS.PROFILES_PUBLIC_SECURE).toBe('profiles_public_secure');
      expect(SUPABASE_VIEWS.EMAIL_THREADS_HEALTH).toBe('email_threads_health');
      expect(SUPABASE_VIEWS.EMAIL_THREADS_LIST_VIEW).toBe('email_threads_list_view');
      expect(SUPABASE_VIEWS.CSM_DATA_TO_COMPLETE).toBe('csm_data_to_complete');
    });

    it('has 6 views', () => {
      expect(Object.keys(SUPABASE_VIEWS)).toHaveLength(6);
    });
  });

  describe('type exports', () => {
    it('PrevisionWithEtablissement type is structurally valid', () => {
      const mock: PrevisionWithEtablissement = {
        id: '1',
        etablissement_id: '2',
        date_signature_estimee: '2025-06-01',
        montant_initial_estime: 10000,
        montant_mensuel_estime: 2000,
        probabilite: 0.8,
        type_offre: 'standard',
        notes: null,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
        etablissements: { nom: 'CH Test', ville: 'Paris', statut: 'Prospect', pallier_vise: 2, nombre_passages_urgences_annuel: 50000 },
      };
      expect(mock.id).toBe('1');
    });

    it('UserEmailAccountSafe type is structurally valid', () => {
      const mock: UserEmailAccountSafe = {
        id: '1', email_address: 'a@b.com', is_active: true, sync_enabled: true, last_sync_at: null,
      };
      expect(mock.email_address).toBe('a@b.com');
    });

    it('ParsedBulletinData type is structurally valid', () => {
      const mock: ParsedBulletinData = {
        salaire_brut: 3500, salaire_net: 2730, cout_employeur: 5075,
      };
      expect(mock.salaire_brut).toBe(3500);
    });
  });
});
