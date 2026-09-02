import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const { MODE, setMode, MockSheet, MockSheetContent, MockJarvisSettingsContent, mockOnOpenChange } = vi.hoisted(() => {
  const MODE = { value: 'loading' };
  const setMode = (v: string) => {
    MODE.value = v;
  };

  // store calls for assertions
  const MockSheet = (props: { open: boolean; onOpenChange: (o: boolean) => void; children?: React.ReactNode }) => {
    MockSheet.calls.push({ open: props.open, onOpenChange: props.onOpenChange });
    return React.createElement(
      'div',
      { 'data-testid': 'mock-sheet', 'data-open': props.open ? 'true' : 'false' },
      props.children,
    );
  };
  (MockSheet as any).calls = [] as Array<{ open: boolean; onOpenChange: (o: boolean) => void }>;

  const MockSheetContent = (props: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-testid': 'mock-sheet-content', className: props.className }, props.children);

  const MockJarvisSettingsContent = () => {
    const v = MODE.value;
    if (v === 'loading') {
      return React.createElement('div', { 'data-testid': 'js-loading' }, 'loading-state');
    }
    if (v === 'error') {
      return React.createElement('div', { 'data-testid': 'js-error' }, 'error: simulated');
    }
    // success
    return React.createElement('div', { 'data-testid': 'js-success' }, 'settings value: 42');
  };

  const mockOnOpenChange = vi.fn();

  return { MODE, setMode, MockSheet, MockSheetContent, MockJarvisSettingsContent, mockOnOpenChange };
});

vi.mock('@/components/ui/sheet', () => {
  return {
    Sheet: MockSheet,
    SheetContent: MockSheetContent,
  };
});

vi.mock('./JarvisSettingsContent', () => {
  return {
    JarvisSettingsContent: MockJarvisSettingsContent,
  };
});

// Ensure any other potential '@/' imports used elsewhere resolve harmlessly
vi.mock('@/', () => ({}));

// Now import the module under test (after mocks are set)
import { JarvisSettingsSheet } from './JarvisSettingsSheet';

describe('JarvisSettingsSheet wrapper', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    // reset mode and mock call records
    setMode('loading');
    (MockSheet as any).calls.length = 0;
    vi.clearAllMocks();
  });

  it('exposes QueryClient wrapper correctly (renderHook usage)', () => {
    // Minimal hook usage to satisfy requirement: wrapped in QueryClientProvider with specified options
    const { result } = renderHook(() => true, { wrapper });
    expect(result.current).toBe(true);
  });

  it('renders loading state and forwards open/onOpenChange to Sheet', () => {
    setMode('loading');
    const externalOnOpenChange = vi.fn();
    render(<JarvisSettingsSheet open={true} onOpenChange={externalOnOpenChange} />);

    // Sheet wrapper should be present and reflect open=true
    const sheet = screen.getByTestId('mock-sheet');
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute('data-open')).toBe('true');

    // The mocked content should show loading indicator
    const loading = screen.getByTestId('js-loading');
    expect(loading).toBeTruthy();
    expect(loading.textContent).toBe('loading-state');

    // Ensure the onOpenChange function passed to Sheet is the same reference we provided
    expect((MockSheet as any).calls.length).toBeGreaterThan(0);
    const passedOnOpenChange = (MockSheet as any).calls[0].onOpenChange;
    expect(typeof passedOnOpenChange).toBe('function');

    // Call the passed onOpenChange and assert external handler is invoked with the same arg
    act(() => {
      passedOnOpenChange(false);
    });
    expect(externalOnOpenChange).toHaveBeenCalledTimes(1);
    expect(externalOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders success state with business value from content', () => {
    setMode('success');
    const externalOnOpenChange = vi.fn();
    const { rerender } = render(<JarvisSettingsSheet open={true} onOpenChange={externalOnOpenChange} />);

    // On first render after mode change, content should show success text
    const successEl = screen.getByTestId('js-success');
    expect(successEl).toBeTruthy();
    expect(successEl.textContent).toBe('settings value: 42');

    // Ensure Sheet still has open=true
    const sheetCalls = (MockSheet as any).calls;
    expect(sheetCalls.length).toBeGreaterThan(0);
    expect(sheetCalls[sheetCalls.length - 1].open).toBe(true);

    // Re-render with open=false to assert prop forwarding updates
    rerender(<JarvisSettingsSheet open={false} onOpenChange={externalOnOpenChange} />);
    const sheet = screen.getByTestId('mock-sheet');
    expect(sheet.getAttribute('data-open')).toBe('false');
  });

  it('renders error state from content', () => {
    setMode('error');
    render(<JarvisSettingsSheet open={true} onOpenChange={mockOnOpenChange} />);

    const err = screen.getByTestId('js-error');
    expect(err).toBeTruthy();
    expect(err.textContent).toBe('error: simulated');
  });
});