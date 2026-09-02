// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisAvatarAnimated, JarvisAvatarMini } from './JarvisAvatarAnimated';

const {
  motionStartMock,
  stableCnMock,
  stableLogo,
} = vi.hoisted(() => ({
  motionStartMock: vi.fn(),
  stableCnMock: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')),
  stableLogo: 'jarvis-logo-mock.png',
}));

vi.mock('@/lib/utils', () => ({
  cn: stableCnMock,
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: stableLogo,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');
  const ReactRef = ReactModule.default;

  const createMotionComponent = (tag: keyof React.JSX.IntrinsicElements) => {
    return ReactRef.forwardRef<HTMLElement, Record<string, unknown>>(function MotionComponent(props, ref) {
      const {
        animate,
        initial,
        exit,
        transition,
        whileHover,
        whileTap,
        layout,
        layoutId,
        ...rest
      } = props;

      const dataProps: Record<string, string> = {};
      if (animate !== undefined) dataProps['data-animate'] = JSON.stringify(animate);
      if (initial !== undefined) dataProps['data-initial'] = JSON.stringify(initial);
      if (exit !== undefined) dataProps['data-exit'] = JSON.stringify(exit);
      if (transition !== undefined) dataProps['data-transition'] = JSON.stringify(transition);
      if (whileHover !== undefined) dataProps['data-while-hover'] = JSON.stringify(whileHover);
      if (whileTap !== undefined) dataProps['data-while-tap'] = JSON.stringify(whileTap);
      if (layout !== undefined) dataProps['data-layout'] = JSON.stringify(layout);
      if (layoutId !== undefined) dataProps['data-layout-id'] = String(layoutId);

      return ReactRef.createElement(tag, { ref, ...rest, ...dataProps });
    });
  };

  return {
    motion: {
      div: createMotionComponent('div'),
      img: createMotionComponent('img'),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => ReactRef.createElement(ReactRef.Fragment, null, children),
    useAnimation: () => ({
      start: motionStartMock,
    }),
  };
});

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

describe('JarvisAvatarAnimated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('render l’état idle par défaut avec le logo, la taille md, le glow et le point de statut vert', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated />
      </Wrapper>
    );

    const logo = screen.getByAltText('Jarvis');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', stableLogo);
    expect(logo).toHaveClass('w-6', 'h-6');
    expect(logo.getAttribute('data-animate')).toContain('"scale":[1,1.02,1]');
    expect(logo.getAttribute('data-transition')).toContain('"duration":3');

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root).toHaveClass('relative');

    const mainAvatar = container.querySelector('.w-12.h-12');
    expect(mainAvatar).toBeTruthy();
    expect(mainAvatar).toHaveClass('from-primary', 'to-primary/80', 'rounded-2xl', 'shadow-xl');

    const glow = container.querySelector('.blur-lg');
    expect(glow).toBeTruthy();
    expect(glow).toHaveClass('-inset-1.5', 'from-primary', 'to-primary/80');
    expect(glow?.getAttribute('data-animate')).toContain('"opacity":[0.2,0.4,0.2]');
    expect(glow?.getAttribute('data-animate')).toContain('"scale":1');

    expect(container.querySelectorAll('.border-violet-500\\/30')).toHaveLength(0);
    expect(container.querySelectorAll('.border-primary\\/40')).toHaveLength(0);

    const statusDot = Array.from(container.querySelectorAll('.bg-emerald-500')).find((node) =>
      node.className.includes('-bottom-0.5') && node.className.includes('-right-0.5')
    );
    expect(statusDot).toBeTruthy();

    expect(motionStartMock).toHaveBeenCalledWith({
      rotate: 0,
      x: 0,
      scale: 1,
      transition: { duration: 0.3 },
    });
  });

  it('render l’état listening avec 3 rings violets et un indicateur violet pulsé', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="listening" size="lg" />
      </Wrapper>
    );

    const listeningRings = container.querySelectorAll('.border-violet-500\\/30');
    expect(listeningRings).toHaveLength(3);
    listeningRings.forEach((ring) => {
      expect(ring).toHaveClass('w-20', 'h-20', 'rounded-full');
      expect(ring.getAttribute('data-animate')).toContain('"opacity":[0.6,0]');
      expect(ring.getAttribute('data-transition')).toContain('"duration":1.5');
    });

    const mainAvatar = container.querySelector('.w-16.h-16');
    expect(mainAvatar).toBeTruthy();
    expect(mainAvatar).toHaveClass('from-violet-500', 'to-purple-600');

    const statusDots = container.querySelectorAll('.bg-violet-500');
    expect(statusDots.length).toBeGreaterThan(0);

    const animatedStatusDot = Array.from(statusDots).find((node) =>
      node.getAttribute('data-animate')?.includes('"scale":[1,1.3,1]')
    );
    expect(animatedStatusDot).toBeTruthy();
  });

  it('render l’état speaking avec 2 rings audio et animation verticale du logo', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="speaking" />
      </Wrapper>
    );

    const speakingRings = container.querySelectorAll('.border-primary\\/40');
    expect(speakingRings).toHaveLength(2);
    speakingRings.forEach((ring) => {
      expect(ring.getAttribute('data-animate')).toContain('"scale":[1,1.3]');
      expect(ring.getAttribute('data-transition')).toContain('"duration":0.8');
    });

    const logo = screen.getByAltText('Jarvis');
    expect(logo.getAttribute('data-animate')).toContain('"y":[0,-2,0,2,0]');
    expect(logo.getAttribute('data-transition')).toContain('"duration":0.3');

    const statusDot = Array.from(container.querySelectorAll('.bg-blue-500')).find((node) =>
      node.getAttribute('data-animate')?.includes('"scale":[1,1.3,1]')
    );
    expect(statusDot).toBeTruthy();
  });

  it('déclenche l’animation thinking et affiche l’overlay spinner', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="thinking" size="xl" />
      </Wrapper>
    );

    const mainAvatar = container.querySelector('.w-24.h-24');
    expect(mainAvatar).toBeTruthy();
    expect(mainAvatar).toHaveClass('from-amber-500', 'to-amber-600');

    const spinnerOverlay = container.querySelector('.overflow-hidden');
    expect(spinnerOverlay).toBeTruthy();

    const shimmer = container.querySelector('.bg-gradient-to-r');
    expect(shimmer).toBeTruthy();
    expect(shimmer?.getAttribute('data-animate')).toContain('"-100%"');
    expect(shimmer?.getAttribute('data-animate')).toContain('"200%"');

    expect(motionStartMock).toHaveBeenCalledWith({
      rotate: [0, 360],
      transition: { duration: 2, repeat: Infinity, ease: 'linear' },
    });

    const glow = container.querySelector('.blur-lg');
    expect(glow?.getAttribute('data-animate')).toContain('"opacity":[0.3,0.6,0.3]');
    expect(glow?.getAttribute('data-animate')).toContain('"scale":[1,1.1,1]');
  });

  it('déclenche l’état success avec 6 particules puis les nettoie après 1000ms', () => {
    vi.useFakeTimers();
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="success" />
      </Wrapper>
    );

    expect(motionStartMock).toHaveBeenCalledWith({
      scale: [1, 1.2, 1],
      transition: { duration: 0.4 },
    });

    const particlesBefore = Array.from(container.querySelectorAll('.w-2.h-2.rounded-full.bg-emerald-500')).filter(
      (node) => node.className.includes('top-1/2') && node.className.includes('left-1/2')
    );
    expect(particlesBefore).toHaveLength(6);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const particlesAfter = Array.from(container.querySelectorAll('.w-2.h-2.rounded-full.bg-emerald-500')).filter(
      (node) => node.className.includes('top-1/2') && node.className.includes('left-1/2')
    );
    expect(particlesAfter).toHaveLength(0);

    const statusDot = Array.from(container.querySelectorAll('.bg-emerald-500')).find((node) =>
      node.className.includes('-bottom-0.5') && node.className.includes('-right-0.5')
    );
    expect(statusDot).toBeTruthy();
  });

  it('déclenche l’état error avec shake rouge', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="error" showRings={false} />
      </Wrapper>
    );

    expect(container.querySelectorAll('.border-violet-500\\/30')).toHaveLength(0);
    expect(container.querySelectorAll('.border-primary\\/40')).toHaveLength(0);

    const mainAvatar = container.querySelector('.from-red-500.to-rose-600');
    expect(mainAvatar).toBeTruthy();

    expect(motionStartMock).toHaveBeenCalledWith({
      x: [0, -5, 5, -5, 5, 0],
      transition: { duration: 0.4 },
    });

    const statusDot = Array.from(container.querySelectorAll('.bg-red-500')).find((node) =>
      node.className.includes('-bottom-0.5') && node.className.includes('-right-0.5')
    );
    expect(statusDot).toBeTruthy();
  });

  it('respecte showGlow=false et showRings=false', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarAnimated state="listening" showGlow={false} showRings={false} className="custom-avatar" />
      </Wrapper>
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('custom-avatar');

    expect(container.querySelector('.blur-lg')).toBeNull();
    expect(container.querySelectorAll('.border-violet-500\\/30')).toHaveLength(0);
    expect(container.querySelectorAll('.border-primary\\/40')).toHaveLength(0);
  });
});

describe('JarvisAvatarMini', () => {
  afterEach(() => {
    cleanup();
  });

  it('render la version mini avec les classes de couleur success et le logo court', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarMini state="success" className="mini-extra" />
      </Wrapper>
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('relative', 'w-6', 'h-6', 'mini-extra');

    const logo = screen.getByAltText('J');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', stableLogo);
    expect(logo).toHaveClass('w-3', 'h-3');

    const main = container.querySelector('.rounded-lg');
    expect(main).toBeTruthy();
    expect(main).toHaveClass('from-emerald-500', 'to-green-600');

    const statusDot = container.querySelector('.w-2.h-2.rounded-full.bg-emerald-500');
    expect(statusDot).toBeTruthy();
  });

  it('anime le point mini en thinking', () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <JarvisAvatarMini state="thinking" />
      </Wrapper>
    );

    const statusDot = container.querySelector('.w-2.h-2.rounded-full.bg-amber-500');
    expect(statusDot).toBeTruthy();
    expect(statusDot?.getAttribute('data-animate')).toContain('"scale":[1,1.2,1]');
    expect(statusDot?.getAttribute('data-transition')).toContain('"duration":0.8');
  });
});