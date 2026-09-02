import { describe, it, expect, beforeEach } from 'vitest';
import { consoleCapture, type LogEntry } from '../consoleCapture';

describe('consoleCapture extended', () => {
  beforeEach(() => {
    consoleCapture.clear();
  });

  it('getLogs returns copy, not reference', () => {
    consoleCapture.captureExternal('log', ['test']);
    const logs1 = consoleCapture.getLogs();
    const logs2 = consoleCapture.getLogs();
    expect(logs1).not.toBe(logs2);
    expect(logs1).toEqual(logs2);
  });

  it('captureExternal handles multiple args', () => {
    consoleCapture.captureExternal('info', ['arg1', 42, true]);
    const logs = consoleCapture.getLogs();
    expect(logs[0].args).toHaveLength(3);
    expect(logs[0].args[0]).toBe('arg1');
    expect(logs[0].args[1]).toBe('42');
    expect(logs[0].args[2]).toBe('true');
  });

  it('getFormattedLogs includes level icons', () => {
    consoleCapture.captureExternal('error', ['err']);
    consoleCapture.captureExternal('warn', ['warn']);
    consoleCapture.captureExternal('info', ['info']);
    consoleCapture.captureExternal('log', ['log']);
    const formatted = consoleCapture.getFormattedLogs();
    expect(formatted).toContain('ERROR');
    expect(formatted).toContain('WARN');
    expect(formatted).toContain('INFO');
    expect(formatted).toContain('LOG');
  });

  it('getErrorLogs excludes log and info', () => {
    consoleCapture.captureExternal('log', ['debug info']);
    consoleCapture.captureExternal('info', ['info msg']);
    consoleCapture.captureExternal('error', ['real error']);
    const errors = consoleCapture.getErrorLogs();
    expect(errors).toHaveLength(1);
    expect(errors[0].level).toBe('error');
  });

  it('clear empties all logs', () => {
    consoleCapture.captureExternal('error', ['err1']);
    consoleCapture.captureExternal('error', ['err2']);
    expect(consoleCapture.getLogs()).toHaveLength(2);
    consoleCapture.clear();
    expect(consoleCapture.getLogs()).toHaveLength(0);
  });

  it('entries have timestamp', () => {
    const before = Date.now();
    consoleCapture.captureExternal('log', ['ts test']);
    const after = Date.now();
    const log = consoleCapture.getLogs()[0];
    expect(log.timestamp).toBeGreaterThanOrEqual(before);
    expect(log.timestamp).toBeLessThanOrEqual(after);
  });

  it('handles null and undefined args', () => {
    consoleCapture.captureExternal('log', [null, undefined]);
    const logs = consoleCapture.getLogs();
    expect(logs[0].args).toHaveLength(2);
    expect(logs[0].args[0]).toBe('null');
    expect(logs[0].args[1]).toBe('undefined');
  });

  it('handles Error with stack', () => {
    const err = new Error('stack test');
    consoleCapture.captureExternal('error', [err]);
    const log = consoleCapture.getLogs()[0];
    expect(log.args[0]).toContain('Error: stack test');
  });
});
