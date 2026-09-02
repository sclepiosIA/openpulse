import React, { forwardRef } from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisMiniFab } from './JarvisMiniFab';

const {
  STATE,
  RESTORE_PANEL,
  CTX_NULL,
  CTX_NOT_MINIMIZED,
  CTX_MINIMIZED_WORKING,
  CTX_MINIMIZED_READY,
} = vi.hoisted(() => {
  const RESTORE_PANEL = vi.fn();
  const CTX_NOT_MINIMIZED = {
    isMinimized: false,
    isProcessingInBackground: false,
    hasCompletedResponse: false,
    restorePanel: RESTORE_PANEL,
  };
  const CTX_MINIMIZED_WORKING = {
    isMinimized: true,
    isProcessingInBackground: true,
    hasCompletedResponse: false,
    restorePanel: RESTORE_PANEL,
  };
  const CTX_MINIMIZED_READY = {
    isMinimized: true,
    isProcessingInBackground: false,
    hasCompletedResponse: true,
    restorePanel: RESTORE_PANEL,
  };
  const CTX_NULL = undefined;
  const STATE = { current: CTX_NULL as typeof CTX_NULL | typeof CTX_NOT_MINIMIZED | typeof CTX_MINIMIZED_WORKING | typeof CTX_MINIMIZED_READY };
  return {
    STATE,
    RESTORE_PANEL,
    CTX_NULL,
    CTX_NOT_MINIMIZED,
    CTX_MINIMIZED_WORKING,
    CTX_MINIMIZED_READY,
  };
});

vi.mock('framer-motion', () => {
  const createMock = (tag: keyof JSX.IntrinsicElements) =>
    forwardRef<any, any>((props, ref) => React.createElement(tag, { ...props, ref }, props.children));
  const motion = new Proxy(
    {},
    {
      get: (_target, prop: string) => createMock(prop as keyof JSX.IntrinsicElements),
    }
  );
  const AnimatePresence = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return { motion, AnimatePresence };
});

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: vi.fn(() => STATE.current),
}));

vi.mock('@/assets/marque/logo.png', () => ({
  default: 'croix-marque.png',
}));

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe('JarvisMiniFab', () => {
  afterEach(() => {
    vi.clearAllMocks();
    STATE.current = CTX_NULL;
  });

  it('ne rend rien quand le contexte est absent', () => {
    STATE.current = CTX_NULL;
    const Wrapper = makeWrapper();
    render(<JarvisMiniFab />, { wrapper: Wrapper });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ne rend rien quand Jarvis n’est pas minimisé', () => {
    STATE.current = CTX_NOT_MINIMIZED;
    const Wrapper = makeWrapper();
    render(<JarvisMiniFab />, { wrapper: Wrapper });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('affiche l’état de travail en arrière-plan quand minimisé et en cours de traitement', () => {
    STATE.current = CTX_MINIMIZED_WORKING;
    const Wrapper = makeWrapper();
    render(<JarvisMiniFab />, { wrapper: Wrapper });

    const btn = screen.getByRole('button', { name: /Jarvis travaille en arrière-plan/i });
    expect(btn).toBeInTheDocument();

    // L'image du logo est présente
    expect(screen.getByAltText('Jarvis')).toBeInTheDocument();

    // Pas de badge "✓" en mode travail
    expect(screen.queryByText('✓')).toBeNull();

    // La classe "prête" ne doit pas être présente
    expect(btn).not.toHaveClass('bg-emerald-500/10');
  });

  it('affiche l’état prêt quand minimisé et réponse complétée', () => {
    STATE.current = CTX_MINIMIZED_READY;
    const Wrapper = makeWrapper();
    render(<JarvisMiniFab />, { wrapper: Wrapper });

    const btn = screen.getByRole('button', { name: /Jarvis a terminé - Cliquer pour voir la réponse/i });
    expect(btn).toBeInTheDocument();

    // Badge ✓ présent
    expect(screen.getByText('✓')).toBeInTheDocument();

    // Classe indicative de l'état prêt
    expect(btn).toHaveClass('bg-emerald-500/10');

    // L'image du logo est présente
    expect(screen.getByAltText('Jarvis')).toBeInTheDocument();
  });

  it('appelle restorePanel au clic sur le bouton', () => {
    STATE.current = CTX_MINIMIZED_READY;
    RESTORE_PANEL.mockClear();
    const Wrapper = makeWrapper();
    render(<JarvisMiniFab />, { wrapper: Wrapper });

    const btn = screen.getByRole('button', { name: /Jarvis a terminé - Cliquer pour voir la réponse/i });
    fireEvent.click(btn);
    expect(RESTORE_PANEL).toHaveBeenCalledTimes(1);
  });
});