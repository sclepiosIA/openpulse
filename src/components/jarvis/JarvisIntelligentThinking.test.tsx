import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const { cnMock, motionDivProps, motionSpanProps, AnimatePresenceMock } = vi.hoisted(() => {
  const cnMock = vi.fn((...args: Array<unknown>) => args.filter(Boolean).join(' '));
  const motionDivProps = vi.fn();
  const motionSpanProps = vi.fn();

  const AnimatePresenceMock = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  return { cnMock, motionDivProps, motionSpanProps, AnimatePresenceMock };
});

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: 'jarvis-logo-mock.png',
}));

vi.mock('lucide-react', () => {
  const mk = (name: string) => {
    const Comp = (props: { className?: string }) => <svg data-icon={name} className={props.className} />;
    return Comp;
  };
  return {
    Brain: mk('Brain'),
    Sparkles: mk('Sparkles'),
    Search: mk('Search'),
    Database: mk('Database'),
    Mail: mk('Mail'),
    FileText: mk('FileText'),
    Zap: mk('Zap'),
    BarChart2: mk('BarChart2'),
    Settings: mk('Settings'),
    Loader2: mk('Loader2'),
  };
});

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');

  const Div = ReactMod.forwardRef<HTMLDivElement, ReactMod.ComponentProps<'div'> & Record<string, unknown>>(
    (props, ref) => {
      motionDivProps(props);
      const { children, ...rest } = props;
      return (
        <div ref={ref} data-motion="div" {...(rest as ReactMod.ComponentProps<'div'>)}>
          {children}
        </div>
      );
    }
  );
  Div.displayName = 'MotionDiv';

  const Span = ReactMod.forwardRef<HTMLSpanElement, ReactMod.ComponentProps<'span'> & Record<string, unknown>>(
    (props, ref) => {
      motionSpanProps(props);
      const { children, ...rest } = props;
      return (
        <span ref={ref} data-motion="span" {...(rest as ReactMod.ComponentProps<'span'>)}>
          {children}
        </span>
      );
    }
  );
  Span.displayName = 'MotionSpan';

  return {
    motion: {
      div: Div,
      span: Span,
    },
    AnimatePresence: AnimatePresenceMock,
  };
});

import { JarvisIntelligentThinking, JarvisDNAThinking } from './JarvisIntelligentThinking';

describe('JarvisIntelligentThinking', () => {
  it('renders dots variant by default with 3 dots and avatar image', () => {
    render(<JarvisIntelligentThinking />);

    const img = screen.getByAltText('Jarvis') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('jarvis-logo-mock.png');

    const dots = document.querySelectorAll('[data-motion="div"][class*="w-2"][class*="h-2"][class*="rounded-full"]');
    expect(dots.length).toBe(3);

    expect(screen.queryByText(/Exécution:/)).toBeNull();
  });

  it('renders wave variant with 5 bars', () => {
    render(<JarvisIntelligentThinking variant="wave" />);

    const bars = document.querySelectorAll('[data-motion="div"][class*="w-1"][class*="rounded-full"]');
    expect(bars.length).toBe(5);
  });

  it('renders brain variant with first message and rotates message after interval', async () => {
    vi.useFakeTimers();

    render(<JarvisIntelligentThinking variant="brain" />);

    expect(screen.getByText('Analyse en cours...')).toBeTruthy();
    expect(document.querySelector('[data-icon="Brain"]')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(2500);
    expect(screen.getByText('Réflexion...')).toBeTruthy();
    expect(document.querySelector('[data-icon="Sparkles"]')).toBeTruthy();

    vi.useRealTimers();
  });

  it('renders minimal variant static text', () => {
    render(<JarvisIntelligentThinking variant="minimal" />);
    expect(screen.getByText('Jarvis réfléchit...')).toBeTruthy();
  });

  it('renders tool execution indicator when currentTool is provided', () => {
    render(<JarvisIntelligentThinking currentTool="get_emails" />);

    expect(screen.getByText('Exécution:')).toBeTruthy();
    expect(screen.getByText('get_emails')).toBeTruthy();
    expect(document.querySelector('[data-icon="Loader2"]')).toBeTruthy();
  });

  it('applies className through cn()', () => {
    cnMock.mockClear();
    render(<JarvisIntelligentThinking className="extra-class" />);

    const outer = document.querySelector('[data-motion="div"].flex.gap-3') as HTMLDivElement | null;
    expect(outer).toBeTruthy();
    expect(outer?.className.includes('extra-class')).toBe(true);

    expect(cnMock).toHaveBeenCalled();
    const calls = cnMock.mock.calls.map((c) => c.join(' ')).join(' | ');
    expect(calls.includes('extra-class')).toBe(true);
  });
});

describe('JarvisDNAThinking', () => {
  it('renders 3 particles and a core', () => {
    render(<JarvisDNAThinking />);

    const particles = document.querySelectorAll('[data-motion="div"][class*="w-2"][class*="h-2"][class*="rounded-full"]');
    expect(particles.length).toBe(3);

    const core = document.querySelector('[data-motion="div"][class*="w-4"][class*="h-4"][class*="rounded-full"]');
    expect(core).toBeTruthy();
  });

  it('applies className through cn()', () => {
    cnMock.mockClear();
    render(<JarvisDNAThinking className="dna-extra" />);

    const root = document.querySelector('[data-motion="div"].flex.items-center.justify-center.py-4') as HTMLDivElement | null;
    expect(root).toBeTruthy();
    expect(root?.className.includes('dna-extra')).toBe(true);

    const calls = cnMock.mock.calls.map((c) => c.join(' ')).join(' | ');
    expect(calls.includes('dna-extra')).toBe(true);
  });
});

afterEach(() => {
  cleanup();
});