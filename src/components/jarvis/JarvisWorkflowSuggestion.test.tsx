import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { SUGGESTIONS, mockInvokeEdge, mockToast, mockDebugError, behavior } = vi.hoisted(() => {
  const SUGGESTIONS = [
    {
      id: 's1',
      name: 'Relancer clients',
      description: 'Envoie un email de relance aux clients en retard de paiement',
      actions: ['send_email', 'create_task'],
      confidence: 0.87,
      timesSaved: 15,
      suggestedAt: new Date().toISOString()
    }
  ];
  const behavior = { mode: 'ok' };
  const mockInvokeEdge = vi.fn(async (name: string, payload: any) => {
    // Simulate network/edge behavior based on payload.action and mode
    if (payload && payload.action === 'get_suggestions') {
      if (behavior.mode === 'error') {
        throw new Error('edge failure');
      }
      return { suggestions: SUGGESTIONS };
    }
    if (payload && payload.action === 'create_workflow') {
      if (behavior.mode === 'create_error') {
        throw new Error('create failure');
      }
      return { ok: true, id: 'wf_123' };
    }
    return {};
  });
  const mockToast = vi.fn();
  const mockDebugError = vi.fn();
  return { SUGGESTIONS, mockInvokeEdge, mockToast, mockDebugError, behavior };
});

vi.mock('@/services/edgeFunctions', () => {
  return { invokeEdge: mockInvokeEdge };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast })
  };
});

vi.mock('@/lib/debug', () => {
  return { debug: { error: mockDebugError } };
});

vi.mock('framer-motion', () => {
  const React = require('react');
  const MotionDiv = (props: any) => {
    const { children, ...rest } = props;
    return React.createElement('div', rest, children);
  };
  const AnimatePresence = (props: any) => {
    const ReactLocal = require('react');
    return ReactLocal.createElement(ReactLocal.Fragment, {}, props.children);
  };
  return { motion: { div: MotionDiv }, AnimatePresence };
});

vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) => (props: any) => React.createElement('span', { 'data-icon': name, ...props }, null);
  return {
    Workflow: make('Workflow'),
    ArrowRight: make('ArrowRight'),
    Zap: make('Zap'),
    Clock: make('Clock'),
    CheckCircle2: make('CheckCircle2'),
    X: make('X'),
    ChevronDown: make('ChevronDown'),
    ChevronUp: make('ChevronUp'),
    Sparkles: make('Sparkles'),
  };
});

vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('button', { ...rest, type: rest.type || 'button' }, children);
    },
  };
});

vi.mock('@/components/ui/card', () => {
  const React = require('react');
  return {
    Card: (props: any) => React.createElement('div', { 'data-testid': 'card', ...props }, props.children),
    CardContent: (props: any) => React.createElement('div', { 'data-testid': 'card-content', ...props }, props.children),
    CardHeader: (props: any) => React.createElement('div', { 'data-testid': 'card-header', ...props }, props.children),
    CardTitle: (props: any) => React.createElement('div', { 'data-testid': 'card-title', ...props }, props.children),
  };
});

vi.mock('@/components/ui/badge', () => {
  const React = require('react');
  return {
    Badge: (props: any) => React.createElement('span', { 'data-testid': 'badge', ...props }, props.children),
  };
});

vi.mock('@/lib/utils', () => {
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(' ')
  };
});

// Now import module under test after mocks
import { JarvisWorkflowSuggestion, useWorkflowSuggestions } from './JarvisWorkflowSuggestion';

describe('useWorkflowSuggestions hook', () => {
  const createWrapper = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);
  };

  beforeEach(() => {
    mockInvokeEdge.mockClear();
    mockToast.mockClear();
    mockDebugError.mockClear();
    behavior.mode = 'ok';
  });

  it('fetches suggestions successfully and accepts a suggestion (mutation calls invokeEdge)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowSuggestions(), { wrapper });

    // Initial state
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    // Fetch suggestions
    await act(async () => {
      await result.current.fetchSuggestions();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual(SUGGESTIONS);

    // Accept suggestion -> should call invokeEdge with create_workflow payload and remove suggestion
    await act(async () => {
      await result.current.acceptSuggestion(SUGGESTIONS[0]);
    });

    expect(mockInvokeEdge).toHaveBeenCalledWith('jarvis-workflow-learner', expect.objectContaining({
      action: 'create_workflow',
      workflowName: SUGGESTIONS[0].name,
      actions: SUGGESTIONS[0].actions,
      description: SUGGESTIONS[0].description
    }));
    expect(result.current.suggestions).toEqual([]);
  });

  it('handles fetch error and logs via debug.error', async () => {
    behavior.mode = 'error';
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowSuggestions(), { wrapper });

    await act(async () => {
      await result.current.fetchSuggestions();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
    expect(mockDebugError).toHaveBeenCalled();
    // ensure the debug error was called with the expected prefix
    const firstCall = mockDebugError.mock.calls[0];
    expect(firstCall[0]).toMatch(/^Failed to fetch workflow suggestions:/);
  });
});

describe('JarvisWorkflowSuggestion component', () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  it('renders suggestion details, allows dismissing and accepts suggestion showing creation state and toast', async () => {
    // Prepare an onAccept that we can control (pending -> resolve)
    let resolveAccept: (() => void) | null = null;
    const acceptPromise = new Promise<void>((res) => { resolveAccept = res; });
    const onAccept = vi.fn(() => acceptPromise);
    const onDismiss = vi.fn();

    render(
      React.createElement(JarvisWorkflowSuggestion, {
        suggestions: [SUGGESTIONS[0]],
        onAccept,
        onDismiss,
        className: 'test-class'
      })
    );

    // Basic texts
    expect(screen.getByText(SUGGESTIONS[0].name)).toBeTruthy();
    expect(screen.getByText(SUGGESTIONS[0].description)).toBeTruthy();
    // Action label "Email" expected for send_email
    expect(screen.getByText('Email')).toBeTruthy();
    // Confidence percentage text
    expect(screen.getByText(`Confiance: ${Math.round(SUGGESTIONS[0].confidence * 100)}%`)).toBeTruthy();
    // Times saved text
    expect(screen.getByText(`~${SUGGESTIONS[0].timesSaved} min économisés`)).toBeTruthy();

    // Dismiss button
    const dismissButton = screen.getByLabelText('Fermer');
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledWith(SUGGESTIONS[0].id);

    // Expand details
    const expandButton = screen.getByText('Plus de détails');
    fireEvent.click(expandButton);
    // Now create button visible
    const createButton = screen.getByText('Créer ce workflow');
    // Click create and assert onAccept called and UI shows "Création..." while pending
    await act(async () => {
      fireEvent.click(createButton);
    });
    expect(onAccept).toHaveBeenCalledWith(SUGGESTIONS[0]);
    // Because onAccept is pending, the component should show "Création..."
    expect(screen.getByText('Création...')).toBeTruthy();

    // Resolve the accept promise to simulate success
    await act(async () => {
      if (resolveAccept) resolveAccept();
      // wait a microtask to let component update
      await Promise.resolve();
    });

    // Toast should have been called with success message
    expect(mockToast).toHaveBeenCalled();
    const toastArg = mockToast.mock.calls[0][0];
    expect(toastArg).toEqual(expect.objectContaining({
      title: '✨ Workflow créé',
      description: expect.stringContaining(SUGGESTIONS[0].name)
    }));

    // After completion, create button text should be back to original
    expect(screen.getByText('Créer ce workflow')).toBeTruthy();
  });

  it('shows error toast when onAccept throws', async () => {
    const onAccept = vi.fn(() => Promise.reject(new Error('create fail')));
    const onDismiss = vi.fn();

    render(
      React.createElement(JarvisWorkflowSuggestion, {
        suggestions: [SUGGESTIONS[0]],
        onAccept,
        onDismiss
      })
    );

    // Expand and click create
    fireEvent.click(screen.getByText('Plus de détails'));
    await act(async () => {
      fireEvent.click(screen.getByText('Créer ce workflow'));
    });

    // Wait for promise chain to settle
    await act(async () => {
      await Promise.resolve();
    });

    // Expect error toast variant destructive
    expect(mockToast).toHaveBeenCalled();
    const toastArg = mockToast.mock.calls[0][0];
    expect(toastArg).toEqual(expect.objectContaining({
      title: 'Erreur',
      description: 'Impossible de créer le workflow',
      variant: 'destructive'
    }));
  });
});