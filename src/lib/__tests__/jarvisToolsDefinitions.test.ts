import { describe, it, expect } from 'vitest';
import { JARVIS_REALTIME_TOOLS, SENSITIVE_VOICE_ACTIONS } from '../jarvis-tools-definitions';

describe('jarvis-tools-definitions', () => {
  it('exposes a non-empty list of realtime tools', () => {
    expect(Array.isArray(JARVIS_REALTIME_TOOLS)).toBe(true);
    expect(JARVIS_REALTIME_TOOLS.length).toBeGreaterThan(5);
  });

  it('each tool has required shape', () => {
    for (const tool of JARVIS_REALTIME_TOOLS) {
      expect(tool.type).toBe('function');
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.parameters?.type).toBe('object');
      expect(tool.parameters?.properties).toBeTruthy();
    }
  });

  it('sensitive actions list contains known sensitive tools', () => {
    expect(SENSITIVE_VOICE_ACTIONS).toContain('send_email');
    expect(SENSITIVE_VOICE_ACTIONS).toContain('delete_entity');
  });

  it('tool names are unique', () => {
    const names = JARVIS_REALTIME_TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
