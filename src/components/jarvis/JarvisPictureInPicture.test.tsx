import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable mocks and constants (vi.hoisted ensures stable references)
const {
  mockInvoke,
  mockDebugError,
  successResponse,
  errorObject,
  mockDragStart
} = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const mockDebugError = vi.fn();
  const successResponse = { response: 'Bonjour depuis Jarvis' };
  const errorObject = new Error('edge-failed');
  const mockDragStart = vi.fn();
  return { mockInvoke, mockDebugError, successResponse, errorObject, mockDragStart };
});

// Mocking external/internal modules used by the component
vi.mock('@/services/edgeFunctions', () => ({ invokeEdge: mockInvoke }));
vi.mock('@/lib/debug', () => ({ debug: { error: mockDebugError } }));
vi.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(' ') }));

vi.mock('lucide-react', () => {
  const Icon = (props: any) => React.createElement('span', props);
  return {
    MessageCircle: Icon,
    X: Icon,
    Minimize2: Icon,
    Maximize2: Icon,
    Send: Icon,
    Sparkles: Icon
  };
});

// Mock framer-motion to avoid animations; provide useDragControls and PanInfo shape not required
vi.mock('framer-motion', () => {
  const ForwardDiv = React.forwardRef((props: any, ref: any) =>
    React.createElement('div', { ref, ...props }, props.children)
  );
  return {
    motion: {
      div: ForwardDiv,
    },
    AnimatePresence: (props: any) => React.createElement(React.Fragment, null, props.children),
    useDragControls: () => ({ start: mockDragStart })
  };
});

// Mock UI components: Button and Input. Input forwards ref to a native input.
vi.mock('@/components/ui/button', () => {
  const Button = ({ children, ...props }: any) => React.createElement('button', props, children);
  return { Button };
});
vi.mock('@/components/ui/input', () => {
  const Input = React.forwardRef<HTMLInputElement, any>(({ ...props }, ref) =>
    React.createElement('input', { ref, ...props })
  );
  return { Input };
});

// Now import the module under test
import { JarvisPictureInPicture, useJarvisPiP } from './JarvisPictureInPicture';

// Helper: QueryClientProvider wrapper for renderHook per requirements
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } }
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useJarvisPiP hook', () => {
  it('opens, closes, toggles and sets position correctly', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisPiP(), { wrapper });

    // initial state
    expect(result.current.isOpen).toBe(false);
    expect(result.current.position).toEqual({ x: 0, y: 0 });

    // open with a specific position
    act(() => {
      result.current.open({ x: 10, y: 20 });
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.position).toEqual({ x: 10, y: 20 });

    // toggle (should close)
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);

    // setPosition directly
    act(() => {
      result.current.setPosition({ x: 5, y: 6 });
    });
    expect(result.current.position).toEqual({ x: 5, y: 6 });

    // close is idempotent
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

describe('JarvisPictureInPicture component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure a deterministic viewport for position calculations if needed
    // jsdom default is 1024x768 but keep explicit in case
    // @ts-ignore
    window.innerWidth = 1024;
    // @ts-ignore
    window.innerHeight = 768;
  });

  it('shows prompt, sends message, shows loading and displays assistant response on success', async () => {
    // Make invokeEdge resolve after a short timeout to observe loading state
    mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(successResponse), 20)));

    const onClose = vi.fn();
    const onExpand = vi.fn();

    render(
      React.createElement(JarvisPictureInPicture, {
        isOpen: true,
        onClose,
        onExpand,
        defaultPosition: { x: 100, y: 100 }
      })
    );

    // initial prompt present
    expect(screen.getByText('Comment puis-je vous aider ?')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Message rapide...') as HTMLInputElement;
    const sendButton = screen.getByLabelText('Envoyer') as HTMLButtonElement;

    // type a message and send
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Salut Jarvis' } });
    });
    expect(input.value).toBe('Salut Jarvis');

    await act(async () => {
      fireEvent.click(sendButton);
    });

    // loading indicator should appear (findBy waits for it)
    const loading = await screen.findByText('Réflexion...');
    expect(loading).toBeInTheDocument();

    // wait for assistant response to appear
    const assistant = await screen.findByText(successResponse.response);
    expect(assistant).toBeInTheDocument();

    // user message should be rendered as well
    expect(screen.getByText('Salut Jarvis')).toBeInTheDocument();

    // verify invokeEdge called with expected args
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-brain', {
      query: 'Salut Jarvis',
      context: { source: 'pip_widget' }
    });

    // test header buttons call callbacks
    const expandBtn = screen.getByTitle('Ouvrir en grand');
    const closeBtn = screen.getByLabelText('Fermer');

    fireEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledTimes(1);

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles invokeEdge failure by calling debug.error and not appending assistant message', async () => {
    // Make invokeEdge reject
    mockInvoke.mockRejectedValue(errorObject);

    const onClose = vi.fn();
    const onExpand = vi.fn();

    render(
      React.createElement(JarvisPictureInPicture, {
        isOpen: true,
        onClose,
        onExpand
      })
    );

    const input = screen.getByPlaceholderText('Message rapide...') as HTMLInputElement;
    const sendButton = screen.getByLabelText('Envoyer') as HTMLButtonElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Erreur test' } });
    });
    expect(input.value).toBe('Erreur test');

    await act(async () => {
      fireEvent.click(sendButton);
    });

    // debug.error should have been called with prefix and error
    expect(mockDebugError).toHaveBeenCalled();
    const firstCallArgs = mockDebugError.mock.calls[0];
    // Ensure the first string argument contains expected prefix
    expect(String(firstCallArgs[0])).toContain('PiP message error:');

    // No assistant message should be added (default fallback 'Réponse reçue' is added only on success)
    const maybeAssistant = screen.queryByText('Réponse reçue');
    expect(maybeAssistant).toBeNull();
  });
});