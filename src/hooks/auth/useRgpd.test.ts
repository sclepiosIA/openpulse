import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useRgpdTraitements,
  useCreateRgpdTraitement,
  useUpdateRgpdTraitement,
  useRgpdConsentements,
  useCreateRgpdConsentement,
  useRgpdDemandes,
  useCreateRgpdDemande,
  useRgpdDpas,
  useRgpdViolations,
  useRgpdCertifications,
  useRgpdAuditLogs,
} from './useRgpd';

const {
  TRAITEMENTS_ROWS,
  CONSENTEMENTS_ROWS,
  DEMANDES_ROWS,
  DPA_ROWS,
  VIOLATIONS_ROWS,
  CERTIFICATIONS_ROWS,
  AUDIT_ROWS,
  INSERTED_TRAITEMENT,
  UPDATED_TRAITEMENT,
  INSERTED_CONSENTEMENT,
  INSERTED_DEMANDE,
  SELECT_ERROR,
  MUTATION_ERROR,
  mockFrom,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => ({
  TRAITEMENTS_ROWS: [
    {
      id: 'tr1',
      nom: 'Gestion RH',
      description: 'Dossiers salariés',
      base_legale: 'contrat',
      finalites: ['paie'],
      categories_donnees: ['identite'],
      categories_personnes: ['salaries'],
      destinataires: ['rh'],
      duree_conservation: '5 ans',
      mesures_securite: ['chiffrement'],
      dpia_requis: false,
      dpia_realise: false,
      donnees_sensibles: false,
      est_actif: true,
      responsable_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ],
  CONSENTEMENTS_ROWS: [
    {
      id: 'co1',
      personne_nom: 'Jean',
      personne_email: 'jean@example.test',
      finalite: 'newsletter',
      traitement_id: 'tr1',
      est_accorde: true,
      date_consentement: '2024-01-03',
      date_retrait: null,
      mode_collecte: 'formulaire',
      preuve_url: '/preuve',
      created_at: '2024-01-03',
      updated_at: '2024-01-03',
    },
  ],
  DEMANDES_ROWS: [
    {
      id: 'de1',
      numero: 'DRO-20240101-ABCD',
      type_droit: 'acces',
      demandeur_nom: 'Marie',
      demandeur_email: 'marie@example.test',
      description: 'Accès aux données',
      statut: 'nouvelle',
      date_demande: '2024-01-04',
      date_limite: '2024-02-04',
      date_traitement: null,
      reponse: null,
      traite_par: null,
      created_at: '2024-01-04',
      updated_at: '2024-01-04',
    },
  ],
  DPA_ROWS: [
    {
      id: 'dpa1',
      nom_sous_traitant: 'Cloud Co',
      type_service: 'hebergement',
      description: 'Stockage',
      pays: 'France',
      est_hors_ue: false,
      garanties_adequation: 'n/a',
      categories_donnees: ['identite'],
      date_signature: '2024-01-01',
      date_expiration: '2025-01-01',
      document_url: '/dpa.pdf',
      contact_email: 'dpo@example.test',
      contact_nom: 'Dpo',
      contact_telephone: '0102030405',
      certifications: ['iso'],
      est_hds: false,
      est_actif: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ],
  VIOLATIONS_ROWS: [
    {
      id: 'vi1',
      numero: 'VIO-20240101-EFGH',
      titre: 'Perte poste',
      description: 'Ordinateur perdu',
      severite: 'moyenne',
      categories_donnees: ['identite'],
      nombre_personnes_affectees: 3,
      date_detection: '2024-01-05',
      date_incident: '2024-01-04',
      origine: 'interne',
      date_notification_cnil: null,
      mesures_prises: 'reset mdp',
      statut: 'ouverte',
      responsable_id: 'u1',
      created_at: '2024-01-05',
      updated_at: '2024-01-05',
    },
  ],
  CERTIFICATIONS_ROWS: [
    {
      id: 'ce1',
      nom: 'ISO 27001',
      organisme_certificateur: 'AFNOR',
      type: 'securite',
      date_obtention: '2023-01-01',
      date_expiration: '2026-01-01',
      numero_certificat: 'CERT-1',
      perimetre: 'SI',
      est_valide: true,
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    },
  ],
  AUDIT_ROWS: [
    {
      id: 'au1',
      table_name: 'rgpd_traitements',
      record_id: 'tr1',
      action: 'UPDATE',
      old_values: { nom: 'Ancien' },
      new_values: { nom: 'Gestion RH' },
      user_id: 'u1',
      user_email: 'user@example.test',
      ip_address: '127.0.0.1',
      user_agent: 'vitest',
      metadata: { source: 'test' },
      created_at: '2024-01-06',
    },
  ],
  INSERTED_TRAITEMENT: {
    id: 'tr2',
    nom: 'Prospection',
    base_legale: 'consentement',
    est_actif: true,
  },
  UPDATED_TRAITEMENT: {
    id: 'tr1',
    nom: 'Gestion RH modifiée',
    est_actif: false,
  },
  INSERTED_CONSENTEMENT: {
    id: 'co2',
    personne_email: 'new@example.test',
    finalite: 'newsletter',
    est_accorde: true,
  },
  INSERTED_DEMANDE: {
    id: 'de2',
    numero: 'DRO-20240102-WXYZ',
    type_droit: 'rectification',
    statut: 'nouvelle',
  },
  SELECT_ERROR: { message: 'select failed' },
  MUTATION_ERROR: { message: 'mutation failed' },
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueueResponse = { data: unknown; error: { message: string } | null };

const responseQueue: QueueResponse[] = [];

function enqueueResponse(data: unknown, error: { message: string } | null = null) {
  responseQueue.push({ data, error });
}

function resetSupabaseMock() {
  responseQueue.length = 0;
  mockFrom.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  debugError.mockReset();

  mockFrom.mockImplementation((table: string) => {
    let current = responseQueue[0] ?? { data: null, error: null };
    let selected = false;

    const builder = {
      table,
      select: vi.fn(() => {
        selected = true;
        return builder;
      }),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        current = responseQueue.shift() ?? { data: payload, error: null };
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        current = responseQueue.shift() ?? { data: payload, error: null };
        return builder;
      }),
      delete: vi.fn(() => {
        current = responseQueue.shift() ?? { data: null, error: null };
        return builder;
      }),
      single: vi.fn(async () => current),
      maybeSingle: vi.fn(async () => current),
      then: (
        onFulfilled?: (value: QueueResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        const value = selected ? responseQueue.shift() ?? current : { data: null, error: null };
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
      catch: (onRejected?: (reason: unknown) => unknown) => {
        const value = selected ? responseQueue.shift() ?? current : { data: null, error: null };
        return Promise.resolve(value).catch(onRejected);
      },
    };

    return builder;
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useRgpd', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it('charge les traitements actifs avec filtre est_actif=true', async () => {
    enqueueResponse(TRAITEMENTS_ROWS);

    const { result } = renderHook(() => useRgpdTraitements(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(TRAITEMENTS_ROWS);

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_traitements');
    expect(builder.order).toHaveBeenCalledWith('nom', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(200);
    expect(builder.eq).toHaveBeenCalledWith('est_actif', true);
    expect(result.current.data?.[0]?.nom).toBe('Gestion RH');
  });

  it('remonte une erreur de query pour les traitements', async () => {
    enqueueResponse(null, SELECT_ERROR);

    const { result } = renderHook(() => useRgpdTraitements(false), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ message: 'select failed' });

    const builder = mockFrom.mock.results[0]?.value;
    expect(builder.eq).not.toHaveBeenCalledWith('est_actif', true);
  });

  it('crée un traitement, caste base_legale et déclenche toast succès', async () => {
    enqueueResponse(INSERTED_TRAITEMENT);

    const { result } = renderHook(() => useCreateRgpdTraitement(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Prospection',
        base_legale: 'consentement',
        est_actif: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockFrom).toHaveBeenCalledWith('rgpd_traitements');

    const builder = mockFrom.mock.results[0]?.value;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Prospection',
        base_legale: 'consentement',
        est_actif: true,
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Traitement créé');
  });

  it('gère l’erreur de création de traitement avec toast erreur et debug', async () => {
    enqueueResponse(null, MUTATION_ERROR);

    const { result } = renderHook(() => useCreateRgpdTraitement(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          nom: 'Prospection',
          base_legale: 'consentement',
        }),
      ).rejects.toMatchObject({ message: 'mutation failed' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création');
    expect(debugError).toHaveBeenCalledWith(MUTATION_ERROR);
  });

  it('met à jour un traitement avec son id', async () => {
    enqueueResponse(UPDATED_TRAITEMENT);

    const { result } = renderHook(() => useUpdateRgpdTraitement(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'tr1',
        nom: 'Gestion RH modifiée',
        est_actif: false,
      });
    });

    const builder = mockFrom.mock.results[0]?.value;
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Gestion RH modifiée',
        est_actif: false,
      }),
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'tr1');
    expect(toastSuccess).toHaveBeenCalledWith('Traitement mis à jour');
  });

  it('charge les consentements filtrés par email', async () => {
    enqueueResponse(CONSENTEMENTS_ROWS);

    const { result } = renderHook(() => useRgpdConsentements('jean@example.test'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_consentements');
    expect(builder.eq).toHaveBeenCalledWith('personne_email', 'jean@example.test');
    expect(result.current.data?.[0]?.finalite).toBe('newsletter');
  });

  it('crée un consentement', async () => {
    enqueueResponse(INSERTED_CONSENTEMENT);

    const { result } = renderHook(() => useCreateRgpdConsentement(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        personne_email: 'new@example.test',
        finalite: 'newsletter',
        est_accorde: true,
      });
    });

    const builder = mockFrom.mock.results[0]?.value;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        personne_email: 'new@example.test',
        finalite: 'newsletter',
        est_accorde: true,
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Consentement enregistré');
  });

  it('charge les demandes filtrées par statut', async () => {
    enqueueResponse(DEMANDES_ROWS);

    const { result } = renderHook(() => useRgpdDemandes('nouvelle'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_demandes_droits');
    expect(builder.eq).toHaveBeenCalledWith('statut', 'nouvelle');
    expect(result.current.data?.[0]?.numero).toBe('DRO-20240101-ABCD');
  });

  it('crée une demande avec numero généré et statut nouvelle', async () => {
    enqueueResponse(INSERTED_DEMANDE);

    const { result } = renderHook(() => useCreateRgpdDemande(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        type_droit: 'rectification',
        demandeur_email: 'marie@example.test',
      });
    });

    const builder = mockFrom.mock.results[0]?.value;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type_droit: 'rectification',
        statut: 'nouvelle',
        demandeur_email: 'marie@example.test',
        numero: expect.stringMatching(/^DRO-\d{8}-[A-Z0-9]{4}$/),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Demande créée');
  });

  it('charge les DPA actifs', async () => {
    enqueueResponse(DPA_ROWS);

    const { result } = renderHook(() => useRgpdDpas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_dpa');
    expect(builder.eq).toHaveBeenCalledWith('est_actif', true);
    expect(result.current.data?.[0]?.nom_sous_traitant).toBe('Cloud Co');
  });

  it('charge les violations filtrées par statut', async () => {
    enqueueResponse(VIOLATIONS_ROWS);

    const { result } = renderHook(() => useRgpdViolations('ouverte'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_violations');
    expect(builder.eq).toHaveBeenCalledWith('statut', 'ouverte');
    expect(result.current.data?.[0]?.severite).toBe('moyenne');
  });

  it('charge les certifications valides', async () => {
    enqueueResponse(CERTIFICATIONS_ROWS);

    const { result } = renderHook(() => useRgpdCertifications(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_certifications');
    expect(builder.eq).toHaveBeenCalledWith('est_valide', true);
    expect(result.current.data?.[0]?.nom).toBe('ISO 27001');
  });

  it('charge les audit logs avec filtres et limite', async () => {
    enqueueResponse(AUDIT_ROWS);

    const { result } = renderHook(
      () => useRgpdAuditLogs({ table_name: 'rgpd_traitements', user_id: 'u1', limit: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const builder = mockFrom.mock.results[0]?.value;
    expect(mockFrom).toHaveBeenCalledWith('rgpd_audit_logs');
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.eq).toHaveBeenCalledWith('table_name', 'rgpd_traitements');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(result.current.data?.[0]?.action).toBe('UPDATE');
  });
});