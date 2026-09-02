/* @vitest-environment jsdom */

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import {
  callDocumentAiAssist,
  isBackendMissingError,
  type DocumentAiRequest,
} from './documentAiAssist';

const BASE_REQUEST: DocumentAiRequest = {
  action: 'summarize',
  content: '<p>Compte-rendu de réunion du 12 juin.</p>',
  documentName: 'CR réunion',
};

describe('callDocumentAiAssist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle document-ai-assist avec le body typé et retourne le résultat texte', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'ok', configured: true, action: 'summarize', result: 'Résumé.', model: 'gpt-5.4' },
      error: null,
    });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(mockInvoke).toHaveBeenCalledWith('document-ai-assist', { body: BASE_REQUEST });
    expect(response).toEqual({
      status: 'ok',
      action: 'summarize',
      result: 'Résumé.',
      classification: undefined,
      actions: undefined,
      model: 'gpt-5.4',
    });
  });

  it('transmet le ton pour la reformulation', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'ok', action: 'rewrite', result: 'Texte reformulé.' },
      error: null,
    });

    await callDocumentAiAssist({ ...BASE_REQUEST, action: 'rewrite', tone: 'concise' });

    expect(mockInvoke).toHaveBeenCalledWith('document-ai-assist', {
      body: expect.objectContaining({ action: 'rewrite', tone: 'concise' }),
    });
  });

  it('retourne la classification DPO/RSSI typée', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'ok',
        action: 'classify',
        classification: {
          dpo_level: 'donnees_sante',
          rssi_level: 'critique',
          rationale: 'Le document contient des données patients.',
          recommendations: ['Chiffrer le document', 'Restreindre les accès'],
        },
      },
      error: null,
    });

    const response = await callDocumentAiAssist({ ...BASE_REQUEST, action: 'classify' });

    expect(response.status).toBe('ok');
    if (response.status === 'ok') {
      expect(response.classification?.dpo_level).toBe('donnees_sante');
      expect(response.classification?.rssi_level).toBe('critique');
      expect(response.classification?.recommendations).toHaveLength(2);
    }
  });

  it("retourne les actions extraites avec responsables et échéances", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'ok',
        action: 'extract_actions',
        actions: [
          { action: 'Envoyer le devis', owner: 'Alice', due_date: '2026-07-15' },
          { action: 'Planifier la réunion de suivi' },
        ],
      },
      error: null,
    });

    const response = await callDocumentAiAssist({ ...BASE_REQUEST, action: 'extract_actions' });

    expect(response.status).toBe('ok');
    if (response.status === 'ok') {
      expect(response.actions).toHaveLength(2);
      expect(response.actions?.[0]).toEqual({
        action: 'Envoyer le devis',
        owner: 'Alice',
        due_date: '2026-07-15',
      });
    }
  });

  it("retourne 'unconfigured' quand le serveur signale configured: false", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'unconfigured', configured: false, message: 'Azure absent' },
      error: null,
    });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response).toEqual({ status: 'unconfigured', message: 'Azure absent' });
  });

  it("retourne 'unconfigured' avec message par défaut quand la fonction edge est absente (404)", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: { status: 404 },
      }),
    });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response.status).toBe('unconfigured');
    if (response.status === 'unconfigured') {
      expect(response.message).toMatch(/n'est pas configuré/);
    }
  });

  it("retourne 'unconfigured' quand la requête réseau échoue (backend injoignable)", async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to send a request to the Edge Function'));

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response.status).toBe('unconfigured');
  });

  it("retourne 'error' pour une erreur serveur non liée à la configuration", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Internal server error'), { context: { status: 500 } }),
    });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response).toEqual({ status: 'error', message: 'Internal server error' });
  });

  it("retourne 'error' quand le serveur renvoie un champ error métier", async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Contenu du document requis' },
      error: null,
    });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response).toEqual({ status: 'error', message: 'Contenu du document requis' });
  });

  it("retourne 'error' pour une réponse vide", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const response = await callDocumentAiAssist(BASE_REQUEST);

    expect(response).toEqual({ status: 'error', message: 'Réponse vide du serveur IA' });
  });
});

describe('isBackendMissingError', () => {
  it('détecte un statut 404 direct ou dans le contexte', () => {
    expect(isBackendMissingError({ status: 404 })).toBe(true);
    expect(isBackendMissingError({ context: { status: 404 } })).toBe(true);
  });

  it('détecte les messages de fonction absente / injoignable', () => {
    expect(isBackendMissingError(new Error('Function not found'))).toBe(true);
    expect(isBackendMissingError(new Error('Failed to send a request to the Edge Function'))).toBe(true);
  });

  it('ne classe pas les erreurs serveur classiques comme backend absent', () => {
    expect(isBackendMissingError(Object.assign(new Error('boom'), { status: 500 }))).toBe(false);
    expect(isBackendMissingError(new Error('Internal server error'))).toBe(false);
  });
});
