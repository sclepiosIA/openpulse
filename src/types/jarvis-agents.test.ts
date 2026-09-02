import { describe, it, expect } from 'vitest';
import type {
  AgentExecutionResult,
  AgentInteraction,
  AgentMessage,
  JarvisPrimeRequest,
  JarvisPrimeResponse,
  JarvisTeamState,
  SharedAgentMemory,
  StandupSection,
  TeamStandupBriefing,
  UserAgentPreferences,
  VoiceHandoff,
} from './jarvis-agents';

describe('jarvis-agents types', () => {
  it('construit des objets métier cohérents pour un agent et une réponse prime', () => {
    const request: JarvisPrimeRequest = {
      query: 'Montre les priorités CRM',
      conversationId: 'conv-1',
      context: { source: 'dashboard' },
      preferredAgent: 'sophia',
      forceAgents: ['sophia', 'alex'],
    };

    const result1: AgentExecutionResult = {
      agentId: 'sophia',
      success: true,
      response: 'Voici les opportunités prioritaires.',
      data: { opportunities: 3 },
      toolCalls: [
        {
          id: 'tool-1',
          name: 'fetch_crm_pipeline',
          arguments: { limit: 3 },
          status: 'completed',
          result: { rows: 3 },
        },
      ],
      executionTimeMs: 120,
      handoffTo: 'alex',
    };

    const result2: AgentExecutionResult = {
      agentId: 'alex',
      success: true,
      response: 'Analyse des tendances terminée.',
      data: { trend: 'up' },
      toolCalls: [
        {
          id: 'tool-2',
          name: 'compute_trends',
          arguments: { window: '30d' },
          status: 'completed',
          result: { slope: 1.2 },
        },
      ],
      executionTimeMs: 80,
    };

    const response: JarvisPrimeResponse = {
      success: true,
      selectedAgents: ['sophia', 'alex'],
      results: [result1, result2],
      synthesis: 'Le CRM progresse et les tendances sont favorables.',
      totalExecutionTimeMs: 200,
      conversationId: 'conv-1',
    };

    expect(request.preferredAgent).toBe('sophia');
    expect(request.forceAgents).toEqual(['sophia', 'alex']);
    expect(response.success).toBe(true);
    expect(response.selectedAgents).toContain('alex');
    expect(response.results[0].toolCalls?.[0].name).toBe('fetch_crm_pipeline');
    expect(response.results[0].handoffTo).toBe('alex');
    expect(response.results[1].data).toEqual({ trend: 'up' });
    expect(response.totalExecutionTimeMs).toBe(200);
    expect(response.synthesis).toContain('favorables');
  });

  it('représente correctement les préférences utilisateur et la mémoire partagée', () => {
    const preferences: UserAgentPreferences = {
      defaultAgent: 'emma',
      enabledAgents: ['emma', 'noah', 'olivia'],
      proactivityLevel: {
        sophia: 'off',
        marcus: 'low',
        olivia: 'medium',
        noah: 'high',
        emma: 'high',
        alex: 'medium',
      },
      customNames: {
        emma: 'Emma RH',
        noah: 'Noah Support',
      },
    };

    const memory: SharedAgentMemory = {
      id: 'mem-1',
      agentId: 'emma',
      memoryKey: 'onboarding-status',
      memoryValue: {
        employeeId: 'emp-1',
        step: 'documents',
        completed: false,
      },
      contextType: 'hr_process',
      expiresAt: '2026-01-15T10:00:00Z',
      createdAt: '2026-01-10T08:00:00Z',
    };

    expect(preferences.defaultAgent).toBe('emma');
    expect(preferences.enabledAgents).toHaveLength(3);
    expect(preferences.proactivityLevel.noah).toBe('high');
    expect(preferences.customNames?.emma).toBe('Emma RH');
    expect(memory.agentId).toBe('emma');
    expect(memory.memoryKey).toBe('onboarding-status');
    expect(memory.memoryValue).toMatchObject({
      employeeId: 'emp-1',
      step: 'documents',
      completed: false,
    });
    expect(memory.contextType).toBe('hr_process');
  });

  it('modélise les messages, handoffs vocaux et état d’équipe', () => {
    const message1: AgentMessage = {
      id: 'msg-1',
      agentId: 'user',
      content: 'Qui peut traiter ma demande RH ?',
      timestamp: '2026-02-01T09:00:00Z',
    };

    const message2: AgentMessage = {
      id: 'msg-2',
      agentId: 'emma',
      content: 'Je prends en charge votre demande RH.',
      timestamp: '2026-02-01T09:00:02Z',
      toolCalls: [
        {
          id: 'tool-3',
          name: 'lookup_employee_file',
          arguments: { employeeRef: 'emp-1' },
          status: 'executing',
        },
      ],
      metadata: { channel: 'voice' },
    };

    const handoff: VoiceHandoff = {
      fromAgent: 'emma',
      toAgent: 'marcus',
      reason: 'Validation budgétaire requise',
      contextPassed: { budgetCode: 'BUD-12', amount: 4200 },
      timestamp: '2026-02-01T09:00:05Z',
    };

    const state: JarvisTeamState = {
      activeAgents: ['emma', 'marcus'],
      currentSpeaker: 'marcus',
      conversationHistory: [message1, message2],
      isTeamMode: true,
      voiceHandoffs: [handoff],
    };

    expect(state.isTeamMode).toBe(true);
    expect(state.activeAgents).toEqual(['emma', 'marcus']);
    expect(state.currentSpeaker).toBe('marcus');
    expect(state.conversationHistory[1].agentId).toBe('emma');
    expect(state.conversationHistory[1].toolCalls?.[0].status).toBe('executing');
    expect(state.voiceHandoffs[0].reason).toContain('budgétaire');
    expect(state.voiceHandoffs[0].contextPassed).toEqual({ budgetCode: 'BUD-12', amount: 4200 });
  });

  it('décrit un briefing quotidien et une interaction analytics avec détails métier', () => {
    const section: StandupSection = {
      agentId: 'olivia',
      agentName: 'Olivia',
      emoji: '🧪',
      highlights: ['2 prototypes validés', '1 risque détecté'],
      alerts: [
        {
          priority: 'high',
          message: 'Retard sur la phase de tests',
          actionUrl: '/rd/tests',
        },
      ],
      metrics: {
        prototypes: 2,
        incidents: 1,
      },
    };

    const briefing: TeamStandupBriefing = {
      id: 'brief-1',
      date: '2026-02-02',
      userId: 'u-1',
      sections: [section],
      generatedAt: '2026-02-02T07:30:00Z',
    };

    const interaction: AgentInteraction = {
      id: 'int-1',
      userId: 'u-1',
      agentId: 'support' as never,
      query: 'Aide-moi sur un ticket prioritaire',
      response: 'Le ticket a été classé en priorité haute.',
      toolCalls: [
        {
          id: 'tool-4',
          name: 'classify_ticket',
          arguments: { severity: 'unknown' },
          status: 'completed',
          result: { priority: 'high' },
        },
      ],
      satisfactionScore: 5,
      executionTimeMs: 95,
      handoffTo: 'noah',
      createdAt: '2026-02-02T08:00:00Z',
    };

    const normalizedInteraction: Omit<AgentInteraction, 'agentId'> & { agentId: 'noah' } = {
      ...interaction,
      agentId: 'noah',
    };

    expect(briefing.sections[0].agentId).toBe('olivia');
    expect(briefing.sections[0].alerts[0].priority).toBe('high');
    expect(briefing.sections[0].metrics).toEqual({ prototypes: 2, incidents: 1 });
    expect(briefing.generatedAt).toBe('2026-02-02T07:30:00Z');
    expect(normalizedInteraction.agentId).toBe('noah');
    expect(normalizedInteraction.toolCalls?.[0].result).toEqual({ priority: 'high' });
    expect(normalizedInteraction.handoffTo).toBe('noah');
    expect(normalizedInteraction.satisfactionScore).toBe(5);
  });
});