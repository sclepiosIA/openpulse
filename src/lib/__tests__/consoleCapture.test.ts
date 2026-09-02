import { describe, it, expect, beforeEach } from 'vitest';
import { consoleCapture, type LogEntry } from '../consoleCapture';

describe('consoleCapture', () => {
  beforeEach(() => {
    consoleCapture.clear();
  });

  it('getLogs returns empty after clear', () => {
    expect(consoleCapture.getLogs()).toEqual([]);
  });

  it('captureExternal adds entries', () => {
    consoleCapture.captureExternal('error', ['test error']);
    const logs = consoleCapture.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].args[0]).toBe('test error');
  });

  it('captureExternal handles objects', () => {
    consoleCapture.captureExternal('info', [{ key: 'value' }]);
    const logs = consoleCapture.getLogs();
    expect(logs[0].args[0]).toContain('"key"');
  });

  it('captureExternal handles Errors', () => {
    consoleCapture.captureExternal('error', [new Error('boom')]);
    const logs = consoleCapture.getLogs();
    expect(logs[0].args[0]).toContain('boom');
  });

  it('getFormattedLogs returns formatted string', () => {
    consoleCapture.captureExternal('warn', ['warning msg']);
    const formatted = consoleCapture.getFormattedLogs();
    expect(formatted).toContain('WARN');
    expect(formatted).toContain('warning msg');
  });

  it('getErrorLogs filters errors and warnings', () => {
    consoleCapture.captureExternal('log', ['info']);
    consoleCapture.captureExternal('error', ['err']);
    consoleCapture.captureExternal('warn', ['warning']);
    expect(consoleCapture.getErrorLogs()).toHaveLength(2);
  });

  it('respects max buffer size', () => {
    for (let i = 0; i < 60; i++) {
      consoleCapture.captureExternal('log', [`msg ${i}`]);
    }
    expect(consoleCapture.getLogs().length).toBeLessThanOrEqual(50);
  });

  it('handles non-serializable values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    consoleCapture.captureExternal('log', [circular]);
    const logs = consoleCapture.getLogs();
    expect(logs).toHaveLength(1);
  });
});
