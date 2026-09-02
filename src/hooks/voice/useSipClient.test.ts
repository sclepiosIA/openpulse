import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

declare global {
  // Stable globals for inspecting side effects in mocks
   
  var __sipLastCallTarget: string | null;
   
  var __sipLastCallOpts: unknown;
   
  var __sipForceFail: boolean;
}

const HOISTED = vi.hoisted(() => ({
  SIP_CRED: {
    sip_domain: 'example.com',
    sip_username: 'alice',
    sip_password: 'pwd',
    sip_uri: 'sip:alice@example.com',
    sip_transport: 'wss',
    caller_id: 'Alice',
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(
          async (
            name: string,
            _payload: unknown,
          ): Promise<{ data: unknown; error: { message: string } | null }> => {
            if (name === 'sip-credentials') {
              if (globalThis.__sipForceFail) {
                return { data: null, error: { message: 'boom' } };
              }
              return { data: { credentials: HOISTED.SIP_CRED }, error: null };
            }
            return { data: null, error: { message: 'unknown' } };
          },
        ),
      },
    },
  };
});

vi.mock('jssip', () => {
  class MockWebSocketInterface {
     
    constructor(_uri: string) {}
  }

  class MockJsSIP_UA {
     
    constructor(_config: unknown) {}
    on(event: string, cb: (arg?: unknown) => void) {
      if (event === 'registered') {
        cb();
      }
    }
    start() {}
    stop() {}
    call(target: string, opts: unknown) {
      globalThis.__sipLastCallTarget = target;
      globalThis.__sipLastCallOpts = opts;
    }
  }

  return {
    default: {
      WebSocketInterface: MockWebSocketInterface,
      UA: MockJsSIP_UA,
    },
  };
});

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => JSX.Element } {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: {
            queries: { retry: 0, gcTime: 0 },
            mutations: { retry: 0 },
          },
        }),
      },
      children,
    ) as unknown as JSX.Element;
  return { wrapper };
}

describe('useSipClient', () => {
  beforeEach(() => {
    globalThis.__sipLastCallTarget = null;
    globalThis.__sipLastCallOpts = null;
    globalThis.__sipForceFail = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('chargement -> succès (connect)', async () => {
    const { wrapper } = makeWrapper();
    const mod = await import('./useSipClient');
    const { result } = renderHook(() => mod.useSipClient(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state).toBe('registered');
    expect(result.current.call).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('démarre un appel et construit une cible SIP correcte', async () => {
    const { wrapper } = makeWrapper();
    const mod = await import('./useSipClient');
    const { result } = renderHook(() => mod.useSipClient(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.startCall('12345');
    });

    expect(globalThis.__sipLastCallTarget).toBe('sip:12345@example.com');
    const opts = globalThis.__sipLastCallOpts;
    expect(opts).toBeTruthy();
    expect(Object(opts as Record<string, unknown>)).toHaveProperty('mediaConstraints');
  });

  it('gère une erreur pendant la récupération des credentials (isError)', async () => {
    globalThis.__sipForceFail = true;
    const { wrapper } = makeWrapper();
    const mod = await import('./useSipClient');
    const { result } = renderHook(() => mod.useSipClient(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state).toBe('failed');
    expect(typeof result.current.error).toBe('string');
  });

  it('disconnect réinitialise à idle et nettoie l’état', async () => {
    const { wrapper } = makeWrapper();
    const mod = await import('./useSipClient');
    const { result } = renderHook(() => mod.useSipClient(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      result.current.disconnect();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.call).toBeNull();
    expect(result.current.remoteStream).toBeNull();
  });

  it('startRecording retourne null sans remoteStream', async () => {
    const { wrapper } = makeWrapper();
    const mod = await import('./useSipClient');
    const { result } = renderHook(() => mod.useSipClient(), { wrapper });

    const rec = result.current.startRecording();
    expect(rec).toBeNull();
  });
})