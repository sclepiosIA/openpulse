import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createDeferredProvider, useDeferredReady } from '../DeferredProvider';
import React, { ReactNode } from 'react';

describe('DeferredProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useDeferredReady returns true by default (no provider)', () => {
    let ready = false;
    function TestComponent() {
      ready = useDeferredReady();
      return null;
    }
    render(<TestComponent />);
    expect(ready).toBe(true);
  });

  it('createDeferredProvider starts not ready then becomes ready', () => {
    const readyValues: boolean[] = [];

    function InnerProvider({ children }: { children: ReactNode }) {
      return <>{children}</>;
    }

    const DeferredInner = createDeferredProvider(InnerProvider, 1000);

    function TestComponent() {
      readyValues.push(useDeferredReady());
      return <div>Test</div>;
    }

    render(
      <DeferredInner delay={1000}>
        <TestComponent />
      </DeferredInner>
    );

    // Initially not ready
    expect(readyValues[readyValues.length - 1]).toBe(false);

    // After delay
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(readyValues[readyValues.length - 1]).toBe(true);
  });
});
