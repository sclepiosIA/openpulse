import { describe, it, expect } from 'vitest';
import {
  JARVIS_AGENTS,
  AGENT_VOICE_MAP,
  HANDOFF_TRIGGER_PHRASES,
  HANDOFF_PHRASES,
  detectAgentFromText,
  getAgentVoicePrompt,
  getRandomHandoffPhrase,
} from '../jarvis-agents-config';

describe('jarvisAgentsConfig extended2', () => {
  const agentIds = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'] as const;
  const allIds = ['prime', ...agentIds] as const;

  describe('AGENT_VOICE_MAP', () => {
    it('has all agents + prime', () => {
      allIds.forEach(id => expect(AGENT_VOICE_MAP[id]).toBeDefined());
    });
    it('all voices are unique', () => {
      const voices = Object.values(AGENT_VOICE_MAP);
      expect(new Set(voices).size).toBe(voices.length);
    });
  });

  describe('JARVIS_AGENTS', () => {
    it('has all 6 agents', () => {
      expect(Object.keys(JARVIS_AGENTS)).toHaveLength(6);
    });

    agentIds.forEach(id => {
      it(`${id} has required fields`, () => {
        const agent = JARVIS_AGENTS[id];
        expect(agent.id).toBe(id);
        expect(agent.name).toBeTruthy();
        expect(agent.domain).toBeTruthy();
        expect(agent.voice).toBeTruthy();
        expect(agent.emoji).toBeTruthy();
        expect(agent.allowedTools.length).toBeGreaterThan(0);
        expect(agent.allowedTables.length).toBeGreaterThan(0);
        expect(agent.keywords.length).toBeGreaterThan(0);
      });
    });

    it('sophia handles CRM', () => expect(JARVIS_AGENTS.sophia.domain).toBe('crm'));
    it('marcus handles RH', () => expect(JARVIS_AGENTS.marcus.domain).toBe('rh'));
    it('olivia handles tresorerie', () => expect(JARVIS_AGENTS.olivia.domain).toBe('tresorerie'));
    it('noah handles R&D', () => expect(JARVIS_AGENTS.noah.domain).toBe('rd'));
    it('emma handles support', () => expect(JARVIS_AGENTS.emma.domain).toBe('support'));
    it('alex handles analytics', () => expect(JARVIS_AGENTS.alex.domain).toBe('analytics'));
  });

  describe('HANDOFF_TRIGGER_PHRASES', () => {
    it('has all agents + prime', () => {
      allIds.forEach(id => {
        expect(HANDOFF_TRIGGER_PHRASES[id]).toBeDefined();
        expect(HANDOFF_TRIGGER_PHRASES[id].length).toBeGreaterThan(0);
      });
    });
  });

  describe('HANDOFF_PHRASES', () => {
    it('has all agents + prime', () => {
      allIds.forEach(id => {
        expect(HANDOFF_PHRASES[id]).toBeDefined();
        expect(HANDOFF_PHRASES[id].length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('detectAgentFromText', () => {
    it('detects sophia for CRM keywords', () => {
      expect(detectAgentFromText('Montre-moi les prospects')).toBe('sophia');
    });
    it('detects marcus for RH keywords', () => {
      expect(detectAgentFromText('Gestion des absences du collaborateur')).toBe('marcus');
    });
    it('detects olivia for finance keywords', () => {
      expect(detectAgentFromText('Voir les factures et la trésorerie')).toBe('olivia');
    });
    it('detects noah for R&D keywords', () => {
      expect(detectAgentFromText('Créer une user story dans le sprint')).toBe('noah');
    });
    it('detects emma for support keywords', () => {
      expect(detectAgentFromText('Ouvrir un ticket de support')).toBe('emma');
    });
    it('detects alex for analytics keywords', () => {
      expect(detectAgentFromText('Affiche les stats et le rapport de tendance')).toBe('alex');
    });
    it('detects prime for coordinator keywords', () => {
      expect(detectAgentFromText('Appelle jarvis')).toBe('prime');
    });
    it('returns null for unrelated text', () => {
      expect(detectAgentFromText('Bonjour comment allez-vous')).toBeNull();
    });
    it('handles accents', () => {
      expect(detectAgentFromText('trésorerie')).toBe('olivia');
    });
    it('handles empty string', () => {
      expect(detectAgentFromText('')).toBeNull();
    });
  });

  describe('getAgentVoicePrompt', () => {
    it('prime prompt includes user name', () => {
      const prompt = getAgentVoicePrompt('prime', 'Jean');
      expect(prompt).toContain('Jean');
      expect(prompt).toContain('JARVIS Prime');
    });

    agentIds.forEach(id => {
      it(`${id} prompt includes agent name and user name`, () => {
        const prompt = getAgentVoicePrompt(id, 'Marie');
        expect(prompt).toContain(JARVIS_AGENTS[id].name);
        expect(prompt).toContain('Marie');
      });
    });
  });

  describe('getRandomHandoffPhrase', () => {
    allIds.forEach(id => {
      it(`${id} returns a phrase from the list`, () => {
        const phrase = getRandomHandoffPhrase(id);
        expect(HANDOFF_PHRASES[id]).toContain(phrase);
      });
    });
  });
});
