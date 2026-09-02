/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisImmersiveMode, ImmersiveToggle } from './JarvisImmersiveMode';

const {
  mockCn,
  mockVibrateSelection,
  mockDragControlsStart,
  mockUseDragControls,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(onFulfilled({ data: null, error: null })),
  );
  chain.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')),
    mockVibrateSelection: vi.fn(),
    mockDragControlsStart: vi.fn(),
    mockUseDragControls: vi.fn(() => ({ start: mockDragControlsStart })),
    builder: chain,
    mockFrom: vi.fn(() => chain),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Maximize2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-maximize" {...props} />,
  Minimize2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-minimize" {...props} />,
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-down" {...props} />,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useDragControls: mockUseDragControls,
    motion: {
      div: ReactModule.forwardRef<
        HTMLDivElement,
        React.HTMLAttributes<HTMLDivElement> & {
          onDragStart?: () => void;
          onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) => void;
          dragControls?: { start: (e: PointerEvent) => void };
        }
      >(function MotionDiv(props, ref) {
        const {
          children,
          onClick,
          onPointerDown,
          onDragStart,
          onDragEnd,
          className,
          style,
          ...rest
        } = props;

        return (
          <div
            ref={ref}
            onClick={onClick}
            onPointerDown={(e) => {
              if (onPointerDown) {
                onPointerDown(e as unknown as React.PointerEvent<HTMLDivElement>);
              }
            }}
            onDragStart={() => {
              if (onDragStart) {
                onDragStart();
              }
            }}
            onDragEnd={() => {
              if (onDragEnd) {
                onDragEnd(
                  new PointerEvent('pointerup'),
                  {
                    offset: { y: 150 },
                    velocity: { y: 10 },
                  },
                );
              }
            }}
            className={className}
            style={style}
            {...rest}
          >
            {children}
          </div>
        );
      }),
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('JarvisImmersiveMode', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    vi.clearAllMocks();
    mockUseDragControls.mockReturnValue({ start: mockDragControlsStart });
  });

  it('ne rend rien quand fermé et laisse le scroll du body intact', () => {
    const onClose = vi.fn();

    const { container } = render(
      <JarvisImmersiveMode isOpen={false} onClose={onClose}>
        <div>Contenu caché</div>
      </JarvisImmersiveMode>,
      { wrapper: createWrapper() },
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByText('Contenu caché')).not.toBeInTheDocument();
  });

  it('affiche le titre, le contenu et verrouille le scroll quand ouvert', () => {
    const onClose = vi.fn();

    render(
      <JarvisImmersiveMode isOpen onClose={onClose} title="Assistant Premium" className="custom-shell">
        <div>Contenu immersif réel</div>
      </JarvisImmersiveMode>,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Assistant Premium')).toBeInTheDocument();
    expect(screen.getByText('Contenu immersif réel')).toBeInTheDocument();
    expect(screen.getByText('Glisser pour fermer')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    const closeButton = screen.getByLabelText('Fermer');
    expect(closeButton).toBeInTheDocument();

    const container = closeButton.closest('div[class*="fixed"]');
    expect(container?.className).toContain('custom-shell');
  });

  it('ferme sur clic backdrop, bouton bas et touche Escape', () => {
    const onClose = vi.fn();

    const { container } = render(
      <JarvisImmersiveMode isOpen onClose={onClose}>
        <div>Body</div>
      </JarvisImmersiveMode>,
      { wrapper: createWrapper() },
    );

    const fixedLayers = Array.from(container.querySelectorAll('div')).filter((el) =>
      el.className.includes('fixed'),
    );

    expect(fixedLayers.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(fixedLayers[0]);
    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('démarre le drag via la poignée et ferme avec swipe vers le bas en vibrant', () => {
    const onClose = vi.fn();

    const { container } = render(
      <JarvisImmersiveMode isOpen onClose={onClose}>
        <div>Drag me</div>
      </JarvisImmersiveMode>,
      { wrapper: createWrapper() },
    );

    const handle = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('cursor-grab'),
    );

    expect(handle).toBeTruthy();

    fireEvent.pointerDown(handle as Element);
    expect(mockDragControlsStart).toHaveBeenCalledTimes(1);

    const draggableContainer = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('safe-area-inset'),
    );

    expect(draggableContainer).toBeTruthy();

    fireEvent.dragStart(draggableContainer as Element);
    fireEvent.dragEnd(draggableContainer as Element);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nettoie le overflow du body au démontage', () => {
    const onClose = vi.fn();

    const { unmount } = render(
      <JarvisImmersiveMode isOpen onClose={onClose}>
        <div>Cleanup</div>
      </JarvisImmersiveMode>,
      { wrapper: createWrapper() },
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });
});

describe('ImmersiveToggle', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('affiche maximize quand non immersif et déclenche vibration + toggle au clic', () => {
    const onToggle = vi.fn();

    render(<ImmersiveToggle isImmersive={false} onToggle={onToggle} className="toggle-class" />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByLabelText('Réduire');
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('toggle-class');
    expect(screen.getByTestId('icon-maximize')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-minimize')).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('affiche minimize quand immersif', () => {
    const onToggle = vi.fn();

    render(<ImmersiveToggle isImmersive onToggle={onToggle} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('icon-minimize')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-maximize')).not.toBeInTheDocument();
  });
});