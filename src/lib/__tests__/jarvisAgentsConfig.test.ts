import { describe, it, expect } from 'vitest';
import { AGENT_VOICE_MAP, JARVIS_AGENTS } from '../jarvis-agents-config';

describe('jarvis-agents-config', () => {
  it('exposes voice map with prime + all agents', () => {
    expect(AGENT_VOICE_MAP.prime).toBeTruthy();
    for (const id of Object.keys(JARVIS_AGENTS)) {
      expect(AGENT_VOICE_MAP[id as keyof typeof AGENT_VOICE_MAP]).toBeTruthy();
    }
  });

  it('each agent has required fields', () => {
    for (const agent of Object.values(JARVIS_AGENTS)) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.voice).toBeTruthy();
      expect(Array.isArray(agent.allowedTools)).toBe(true);
      expect(agent.allowedTools.length).toBeGreaterThan(0);
      expect(Array.isArray(agent.allowedTables)).toBe(true);
      expect(Array.isArray(agent.keywords)).toBe(true);
    }
  });

  it('voice values are valid Azure voices', () => {
    const valid = ['alloy', 'shimmer', 'echo', 'nova', 'fable', 'onyx', 'coral'];
    for (const v of Object.values(AGENT_VOICE_MAP)) {
      expect(valid).toContain(v);
    }
  });
});
