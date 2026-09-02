/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  AGENT_VOICE_MAP,
  JARVIS_AGENTS,
  HANDOFF_TRIGGER_PHRASES,
  HANDOFF_PHRASES,
  detectAgentFromText,
  getAgentVoicePrompt,
  getRandomHandoffPhrase,
} from './jarvis-agents-config';

const { AUTH_STATE, TOAST_SUCCESS, TOAST_ERROR, NAVIGATE_MOCK, SUPABASE_ROWS, mockFrom } = vi.hoisted(() => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: typeof SUPABASE_ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: SUPABASE_ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: SUPABASE_ROWS, error: null }).catch(onRejected),
  };

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    TOAST_SUCCESS: vi.fn(),
    TOAST_ERROR: vi.fn(),
    NAVIGATE_MOCK: vi.fn(),
    SUPABASE_ROWS: [{ id: '1' }],
    mockFrom: vi.fn(() => builder),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: TOAST_SUCCESS,
    error: TOAST_ERROR,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => NAVIGATE_MOCK,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return Wrapper;
}

describe('jarvis-agents-config', () => {
  it('expose une configuration cohérente des voix et agents', () => {
    expect(AGENT_VOICE_MAP.prime).toBe('coral');
    expect(AGENT_VOICE_MAP.sophia).toBe('shimmer');
    expect(AGENT_VOICE_MAP.marcus).toBe('echo');
    expect(AGENT_VOICE_MAP.olivia).toBe('alloy');
    expect(AGENT_VOICE_MAP.noah).toBe('nova');
    expect(AGENT_VOICE_MAP.emma).toBe('fable');
    expect(AGENT_VOICE_MAP.alex).toBe('onyx');

    expect(Object.keys(JARVIS_AGENTS)).toEqual(['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex']);

    expect(JARVIS_AGENTS.sophia.domain).toBe('crm');
    expect(JARVIS_AGENTS.sophia.allowedTools).toContain('search_etablissements');
    expect(JARVIS_AGENTS.sophia.allowedTables).toContain('contacts');
    expect(JARVIS_AGENTS.sophia.keywords).toContain('CRM');

    expect(JARVIS_AGENTS.marcus.domain).toBe('rh');
    expect(JARVIS_AGENTS.marcus.allowedTools).toContain('get_team_members');
    expect(JARVIS_AGENTS.marcus.allowedTables).toContain('profiles');

    expect(JARVIS_AGENTS.olivia.domain).toBe('tresorerie');
    expect(JARVIS_AGENTS.olivia.allowedTools).toContain('get_qonto_balance');
    expect(JARVIS_AGENTS.olivia.allowedTables).toContain('qonto_transactions');

    expect(JARVIS_AGENTS.noah.domain).toBe('rd');
    expect(JARVIS_AGENTS.noah.allowedTools).toContain('create_user_story');
    expect(JARVIS_AGENTS.noah.allowedTables).toContain('rd_sprints');

    expect(JARVIS_AGENTS.emma.domain).toBe('support');
    expect(JARVIS_AGENTS.emma.allowedTools).toContain('search_knowledge_base');
    expect(JARVIS_AGENTS.emma.allowedTables).toContain('support_tickets');

    expect(JARVIS_AGENTS.alex.domain).toBe('analytics');
    expect(JARVIS_AGENTS.alex.allowedTools).toContain('get_predictions');
    expect(JARVIS_AGENTS.alex.allowedTables).toContain('jarvis_predictions');
  });

  it('contient des triggers et phrases de handoff utiles pour chaque agent', () => {
    expect(HANDOFF_TRIGGER_PHRASES.prime).toContain('jarvis');
    expect(HANDOFF_TRIGGER_PHRASES.sophia).toContain('commercial');
    expect(HANDOFF_TRIGGER_PHRASES.marcus).toContain('recrutement');
    expect(HANDOFF_TRIGGER_PHRASES.olivia).toContain('budget');
    expect(HANDOFF_TRIGGER_PHRASES.noah).toContain('sprint');
    expect(HANDOFF_TRIGGER_PHRASES.emma).toContain('incident');
    expect(HANDOFF_TRIGGER_PHRASES.alex).toContain('kpi');

    expect(HANDOFF_PHRASES.prime.length).toBe(3);
    expect(HANDOFF_PHRASES.sophia[0]).toContain('commerciale');
    expect(HANDOFF_PHRASES.marcus[0]).toContain('RH');
    expect(HANDOFF_PHRASES.olivia[0]).toContain('trésorerie');
    expect(HANDOFF_PHRASES.noah[0]).toContain('R&D');
    expect(HANDOFF_PHRASES.emma[2]).toContain('aider');
    expect(HANDOFF_PHRASES.alex[0]).toContain('analyse');
  });

  it('détecte correctement l’agent à partir du texte avec accents et pondération', () => {
    expect(detectAgentFromText('Peux-tu demander à Sophia de gérer ce prospect CRM ?')).toBe('sophia');
    expect(detectAgentFromText('Question RH sur un congé et la paie du collaborateur')).toBe('marcus');
    expect(detectAgentFromText('Besoin de trésorerie, budget et paiement facture')).toBe('olivia');
    expect(detectAgentFromText('Le sprint R&D a un bug sur une feature du backlog')).toBe('noah');
    expect(detectAgentFromText('J’ai un problème de support, ticket incident')).toBe('emma');
    expect(detectAgentFromText('Fais une analyse KPI avec rapport et tendance')).toBe('alex');
    expect(detectAgentFromText('Jarvis, coordonne toute l’équipe complète')).toBe('prime');
    expect(detectAgentFromText('TRESORERIE et depense sans accents')).toBe('olivia');
    expect(detectAgentFromText('Sujet totalement hors périmètre')).toBeNull();
  });

  it('génère des prompts vocaux adaptés pour prime et les agents spécialisés', () => {
    const primePrompt = getAgentVoicePrompt('prime', 'Camille');
    expect(primePrompt).toContain('JARVIS Prime');
    expect(primePrompt).toContain("Camille");
    expect(primePrompt).toContain('coordinateur');
    expect(primePrompt).toContain('Sois concis et efficace');

    const sophiaPrompt = getAgentVoicePrompt('sophia', 'Camille');
    expect(sophiaPrompt).toContain('Tu es Sophia');
    expect(sophiaPrompt).toContain("Experte CRM et relations clients");
    expect(sophiaPrompt).toContain('Dynamique et orientée résultats');
    expect(sophiaPrompt).toContain('crm');
    expect(sophiaPrompt).toContain('tutois Camille');

    const alexPrompt = getAgentVoicePrompt('alex', 'Camille');
    expect(alexPrompt).toContain('Tu es Alex');
    expect(alexPrompt).toContain('Expert données et insights');
    expect(alexPrompt).toContain('Analytique et perspicace');
    expect(alexPrompt).toContain('analytics');
  });

  it('retourne une phrase de handoff aléatoire issue de la liste de l’agent', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(getRandomHandoffPhrase('emma')).toBe(HANDOFF_PHRASES.emma[0]);
    expect(getRandomHandoffPhrase('prime')).toBe(HANDOFF_PHRASES.prime[0]);
    spy.mockRestore();

    const spyLast = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(getRandomHandoffPhrase('alex')).toBe(HANDOFF_PHRASES.alex[2]);
    spyLast.mockRestore();
  });

  it('couvre un hook React Query: loading puis succès avec valeurs métier réelles', async () => {
    function useAgentDetection(text: string) {
      return useQuery({
        queryKey: ['agent-detection', text],
        queryFn: async () => {
          const agentId = detectAgentFromText(text);
          if (!agentId) {
            return { agentId: null, voice: null, prompt: null };
          }
          return {
            agentId,
            voice: AGENT_VOICE_MAP[agentId],
            prompt: getAgentVoicePrompt(agentId, 'Camille'),
          };
        },
      });
    }

    const { result } = renderHook(() => useAgentDetection('Peux-tu analyser les KPI et faire un rapport ?'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      agentId: 'alex',
      voice: 'onyx',
      prompt: expect.stringContaining('Expert données et insights'),
    });
  });

  it('couvre un hook React Query en erreur quand la queryFn renvoie { data:null, error:{ message:"x" } }', async () => {
    function useErroredAgentConfig() {
      return useQuery({
        queryKey: ['agent-config-error'],
        queryFn: async () => {
          const response = { data: null, error: { message: 'x' } };
          if (response.error) {
            throw new Error(response.error.message);
          }
          return response.data;
        },
      });
    }

    const { result } = renderHook(() => useErroredAgentConfig(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('x');
  });
});