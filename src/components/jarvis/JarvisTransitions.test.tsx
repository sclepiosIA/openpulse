// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  fadeVariants,
  slideUpVariants,
  slideRightVariants,
  scaleVariants,
  bounceVariants,
  staggerContainerVariants,
  staggerItemVariants,
  FadeTransition,
  SlideUpTransition,
  ScaleTransition,
  BounceTransition,
  PageTransition,
  StaggerList,
  StaggerItem,
  JarvisSkeleton,
  HapticButton,
  PresenceWrapper,
} from './JarvisTransitions';

const { motionDivSpy, motionButtonSpy, animatePresenceSpy, cnSpy } = vi.hoisted(() => ({
  motionDivSpy: vi.fn(),
  motionButtonSpy: vi.fn(),
  animatePresenceSpy: vi.fn(),
  cnSpy: vi.fn((...args: unknown[]) => {
    const classes: string[] = [];
    for (const arg of args) {
      if (typeof arg === 'string') {
        classes.push(arg);
      } else if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
        for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
          if (value) classes.push(key);
        }
      }
    }
    return classes.join(' ');
  }),
}));

vi.mock('@/lib/utils', () => ({
  cn: cnSpy,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');
  const ReactLib = ReactModule.default;

  const Div = ReactLib.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>>(
    function Div(props, ref) {
      motionDivSpy(props);
      const {
        children,
        variants,
        transition,
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        ...domProps
      } = props;
      return ReactLib.createElement(
        'div',
        {
          ref,
          ...domProps,
          'data-initial': typeof initial === 'string' ? initial : undefined,
          'data-animate': typeof animate === 'string' ? animate : undefined,
          'data-exit': typeof exit === 'string' ? exit : undefined,
          'data-variants': variants ? JSON.stringify(variants) : undefined,
          'data-transition': transition ? JSON.stringify(transition) : undefined,
          'data-while-hover': whileHover ? JSON.stringify(whileHover) : undefined,
          'data-while-tap': whileTap ? JSON.stringify(whileTap) : undefined,
        },
        children
      );
    }
  );

  const Button = ReactLib.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>>(
    function Button(props, ref) {
      motionButtonSpy(props);
      const {
        children,
        transition,
        whileHover,
        whileTap,
        ...domProps
      } = props;
      return ReactLib.createElement(
        'button',
        {
          ref,
          ...domProps,
          'data-transition': transition ? JSON.stringify(transition) : undefined,
          'data-while-hover': whileHover ? JSON.stringify(whileHover) : undefined,
          'data-while-tap': whileTap ? JSON.stringify(whileTap) : undefined,
        },
        children
      );
    }
  );

  const AnimatePresence = ({ children, mode }: { children: React.ReactNode; mode?: string }) => {
    animatePresenceSpy({ mode });
    return ReactLib.createElement(ReactLib.Fragment, null, children);
  };

  return {
    motion: {
      div: Div,
      button: Button,
    },
    AnimatePresence,
  };
});

describe('JarvisTransitions variants', () => {
  it('exports the expected animation variant objects', () => {
    expect(fadeVariants).toEqual({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    });

    expect(slideUpVariants).toEqual({
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
    });

    expect(slideRightVariants).toEqual({
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 20 },
    });

    expect(scaleVariants).toEqual({
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    });

    expect(bounceVariants).toEqual({
      initial: { opacity: 0, scale: 0.9 },
      animate: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      },
      exit: { opacity: 0, scale: 0.9 },
    });

    expect(staggerContainerVariants).toEqual({
      initial: {},
      animate: {
        transition: {
          staggerChildren: 0.05,
          delayChildren: 0.1,
        },
      },
      exit: {
        transition: {
          staggerChildren: 0.03,
          staggerDirection: -1,
        },
      },
    });

    expect(staggerItemVariants).toEqual({
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
    });
  });
});

describe('transition components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders FadeTransition with fade variants and custom timing', () => {
    render(
      <FadeTransition className="fade-box" delay={0.4} duration={0.7}>
        <span>fade child</span>
      </FadeTransition>
    );

    expect(screen.getByText('fade child')).toBeInTheDocument();
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'fade-box',
        initial: 'initial',
        animate: 'animate',
        exit: 'exit',
        variants: fadeVariants,
        transition: { duration: 0.7, delay: 0.4 },
      })
    );
  });

  it('renders SlideUpTransition with slide variants and easeOut', () => {
    render(
      <SlideUpTransition className="slide-box" delay={0.1} duration={0.5}>
        <span>slide child</span>
      </SlideUpTransition>
    );

    expect(screen.getByText('slide child')).toBeInTheDocument();
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'slide-box',
        variants: slideUpVariants,
        transition: { duration: 0.5, delay: 0.1, ease: 'easeOut' },
      })
    );
  });

  it('renders ScaleTransition with default duration', () => {
    render(
      <ScaleTransition className="scale-box">
        <span>scale child</span>
      </ScaleTransition>
    );

    expect(screen.getByText('scale child')).toBeInTheDocument();
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'scale-box',
        variants: scaleVariants,
        transition: { duration: 0.2, delay: 0 },
      })
    );
  });

  it('renders BounceTransition with bounce variants and delay only', () => {
    render(
      <BounceTransition className="bounce-box" delay={0.25}>
        <span>bounce child</span>
      </BounceTransition>
    );

    expect(screen.getByText('bounce child')).toBeInTheDocument();
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'bounce-box',
        variants: bounceVariants,
        transition: { delay: 0.25 },
      })
    );
  });

  it('renders PageTransition with fade mode by default', () => {
    render(
      <PageTransition className="page-fade">
        <span>page child</span>
      </PageTransition>
    );

    expect(animatePresenceSpy).toHaveBeenCalledWith({ mode: 'wait' });
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'page-fade',
        variants: fadeVariants,
        transition: { duration: 0.25, delay: 0 },
      })
    );
  });

  it('renders PageTransition with slide and scale modes', () => {
    const { rerender } = render(
      <PageTransition className="page-slide" mode="slide" delay={0.15}>
        <span>slide page</span>
      </PageTransition>
    );

    expect(motionDivSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        className: 'page-slide',
        variants: slideUpVariants,
        transition: { duration: 0.25, delay: 0.15 },
      })
    );

    rerender(
      <PageTransition className="page-scale" mode="scale">
        <span>scale page</span>
      </PageTransition>
    );

    expect(motionDivSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        className: 'page-scale',
        variants: scaleVariants,
        transition: { duration: 0.25, delay: 0 },
      })
    );
  });

  it('renders StaggerList and StaggerItem with stagger variants', () => {
    render(
      <StaggerList className="list-wrap">
        <StaggerItem className="item-wrap">One</StaggerItem>
        <StaggerItem className="item-wrap">Two</StaggerItem>
      </StaggerList>
    );

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();

    expect(motionDivSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        className: 'list-wrap',
        initial: 'initial',
        animate: 'animate',
        exit: 'exit',
        variants: staggerContainerVariants,
      })
    );

    expect(motionDivSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        className: 'item-wrap',
        variants: staggerItemVariants,
        transition: { duration: 0.2 },
      })
    );

    expect(motionDivSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        className: 'item-wrap',
        variants: staggerItemVariants,
        transition: { duration: 0.2 },
      })
    );
  });
});

describe('JarvisSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single text skeleton with provided dimensions', () => {
    const { container } = render(
      <JarvisSkeleton className="extra-class" width={120} height={18} />
    );

    const skeleton = container.firstElementChild;
    expect(skeleton).not.toBeNull();
    expect(skeleton?.className).toContain('relative');
    expect(skeleton?.className).toContain('overflow-hidden');
    expect(skeleton?.className).toContain('bg-muted/50');
    expect(skeleton?.className).toContain('rounded h-4');
    expect(skeleton?.className).toContain('extra-class');
    expect(skeleton).toHaveStyle({ width: '120px', height: '18px' });

    expect(cnSpy).toHaveBeenCalled();
  });

  it('renders multiple lines and shortens the last line to 60%', () => {
    const { container } = render(
      <JarvisSkeleton variant="rounded" width="80%" height={12} lines={3} />
    );

    const wrapper = container.firstElementChild as HTMLDivElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('space-y-2');

    const lines = wrapper?.children ?? [];
    expect(lines).toHaveLength(3);

    const first = lines[0] as HTMLElement;
    const second = lines[1] as HTMLElement;
    const third = lines[2] as HTMLElement;

    expect(first.className).toContain('rounded-lg');
    expect(first).toHaveStyle({ width: '80%', height: '12px' });
    expect(second).toHaveStyle({ width: '80%', height: '12px' });
    expect(third).toHaveStyle({ width: '60%', height: '12px' });
  });

  it('applies the correct class for circular and rectangular variants', () => {
    const { rerender, container } = render(
      <JarvisSkeleton variant="circular" />
    );

    expect(container.firstElementChild?.className).toContain('rounded-full');

    rerender(<JarvisSkeleton variant="rectangular" />);
    expect(container.firstElementChild?.className).toContain('rounded-md');
  });
});

describe('HapticButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button and passes medium intensity motion values by default', () => {
    const onClick = vi.fn();

    render(
      <HapticButton className="cta" onClick={onClick}>
        Press me
      </HapticButton>
    );

    const button = screen.getByRole('button', { name: 'Press me' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    expect(motionButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'cta',
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.96 },
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      })
    );
  });

  it('uses light and heavy intensity scale presets', () => {
    const { rerender } = render(<HapticButton intensity="light">Light</HapticButton>);

    expect(motionButtonSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        whileHover: { scale: 1.01 },
        whileTap: { scale: 0.98 },
      })
    );

    rerender(<HapticButton intensity="heavy">Heavy</HapticButton>);

    expect(motionButtonSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.94 },
      })
    );
  });
});

describe('PresenceWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when visible with fade mode by default', () => {
    render(
      <PresenceWrapper isVisible className="presence-box">
        <span>visible content</span>
      </PresenceWrapper>
    );

    expect(screen.getByText('visible content')).toBeInTheDocument();
    expect(animatePresenceSpy).toHaveBeenCalledWith({ mode: 'wait' });
    expect(motionDivSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'presence-box',
        variants: fadeVariants,
        transition: { duration: 0.2 },
      })
    );
  });

  it('does not render children when not visible', () => {
    render(
      <PresenceWrapper isVisible={false}>
        <span>hidden content</span>
      </PresenceWrapper>
    );

    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
    expect(animatePresenceSpy).toHaveBeenCalledWith({ mode: 'wait' });
    expect(motionDivSpy).not.toHaveBeenCalled();
  });

  it('switches variants based on mode', () => {
    const { rerender } = render(
      <PresenceWrapper isVisible mode="slide">
        <span>slide visible</span>
      </PresenceWrapper>
    );

    expect(motionDivSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variants: slideUpVariants,
        transition: { duration: 0.2 },
      })
    );

    rerender(
      <PresenceWrapper isVisible mode="scale">
        <span>scale visible</span>
      </PresenceWrapper>
    );

    expect(motionDivSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variants: scaleVariants,
        transition: { duration: 0.2 },
      })
    );
  });
});