import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulatorState } from '../quote/useSimulatorState';

describe('useSimulatorState', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useSimulatorState());
    expect(result.current.activeTab).toBe('simulation');
    expect(result.current.params.passages).toBeGreaterThan(0);
    expect(result.current.configuration).not.toBeNull();
    expect(result.current.simulationResults).toBeDefined();
  });

  it('accepts initial passages and baseline', () => {
    const { result } = renderHook(() => useSimulatorState({ initialPassages: 80000, initialBaseline: 25 }));
    expect(result.current.params.passages).toBe(80000);
    expect(result.current.params.baseline).toBe(25);
  });

  it('updateParam updates single param', () => {
    const { result } = renderHook(() => useSimulatorState());
    act(() => { result.current.updateParam('passages', 99000); });
    expect(result.current.params.passages).toBe(99000);
  });

  it('updateParams updates multiple params', () => {
    const { result } = renderHook(() => useSimulatorState());
    act(() => { result.current.updateParams({ passages: 60000, baseline: 30 }); });
    expect(result.current.params.passages).toBe(60000);
    expect(result.current.params.baseline).toBe(30);
  });

  it('resetParams restores defaults', () => {
    const { result } = renderHook(() => useSimulatorState());
    const defaultPassages = result.current.params.passages;
    act(() => { result.current.updateParam('passages', 1); });
    act(() => { result.current.resetParams(); });
    expect(result.current.params.passages).toBe(defaultPassages);
  });

  it('setActiveTab changes tab', () => {
    const { result } = renderHook(() => useSimulatorState());
    act(() => { result.current.setActiveTab('devis'); });
    expect(result.current.activeTab).toBe('devis');
  });

  it('updateAnalyticsParam updates analytics', () => {
    const { result } = renderHook(() => useSimulatorState());
    act(() => { result.current.updateAnalyticsParam('uhcdMois', 500); });
    expect(result.current.analyticsParams.uhcdMois).toBe(500);
  });

  it('quoteResults is computed', () => {
    const { result } = renderHook(() => useSimulatorState());
    expect(result.current.quoteResults).not.toBeNull();
    expect(result.current.quoteResults!.paliers).toHaveLength(4);
  });

  it('analyticsResults is computed', () => {
    const { result } = renderHook(() => useSimulatorState());
    expect(result.current.analyticsResults).toBeDefined();
    expect(result.current.analyticsResults.uhcdAn).toBeGreaterThan(0);
  });
});
