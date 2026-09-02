/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { JarvisAgentAvatar, JarvisAgentRow } from './JarvisAgentAvatar';

const { AGENT_METADATA, debugWarn, motionDivSpy } = vi.hoisted(() => ({
  AGENT_METADATA: {
    sophia: {
      displayName: 'Sophia',
      domain: 'Strategy',
      emoji: '🧠',
      gradientFrom: '#112233',
      gradientTo: '#445566',
      color: '#778899',
    },
    marcus: {
      displayName: 'Marcus',
      domain: 'Operations',
      emoji: '⚙️',
      gradientFrom: '#220011',
      gradientTo: '#660044',
      color: '#aa3377',
    },
    olivia: {
      displayName: 'Olivia',
      domain: 'Research',
      emoji: '🔎',
      gradientFrom: '#003344',
      gradientTo: '#007799',
      color: '#00aacc',
    },
    noah: {
      displayName: 'Noah',
      domain: 'Engineering',
      emoji: '💻',
      gradientFrom: '#113300',
      gradientTo: '#55aa00',
      color: '#66cc22',
    },
    emma: {
      displayName: 'Emma',
      domain: 'Design',
      emoji: '🎨',
      gradientFrom: '#331122',
      gradientTo: '#bb4488',
      color: '#dd66aa',
    },
    alex: {
      displayName: 'Alex',
      domain: 'Support',
      emoji: '🛠️',
      gradientFrom: '#222222',
      gradientTo: '#777777',
      color: '#999999',
    },
  },
  debugWarn: vi.fn(),
  motionDivSpy: vi.fn(),
}));

vi.mock('@/hooks/jarvis/useJarvisTeam', () => ({
  AGENT_METADATA,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: debugWarn,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');
  return {
    motion: {
      div: ReactModule.forwardRef<
        HTMLDivElement,
        React.HTMLAttributes<HTMLDivElement> & {
          animate?: unknown;
          initial?: unknown;
          transition?: unknown;
          whileHover?: unknown;
          whileTap?: unknown;
        }
      >(({ children, animate, initial, transition, whileHover, whileTap, ...props }, ref) => {
        motionDivSpy({
          animate,
          initial,
          transition,
          whileHover,
          whileTap,
          className: props.className,
          style: props.style,
        });

        const dataAnimate = animate ? JSON.stringify(animate) : undefined;
        const dataInitial = initial ? JSON.stringify(initial) : undefined;
        const dataTransition = transition ? JSON.stringify(transition) : undefined;
        const dataWhileHover = whileHover ? JSON.stringify(whileHover) : undefined;
        const dataWhileTap = whileTap ? JSON.stringify(whileTap) : undefined;

        return ReactModule.createElement(
          'div',
          {
            ...props,
            ref,
            'data-animate': dataAnimate,
            'data-initial': dataInitial,
            'data-transition': dataTransition,
            'data-while-hover': dataWhileHover,
            'data-while-tap': dataWhileTap,
          },
          children,
        );
      }),
    },
  };
});

describe('JarvisAgentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders avatar with agent emoji, name, domain and gradient styling', () => {
    const { container } = render(
      <JarvisAgentAvatar
        agentId="sophia"
        size="lg"
        status="idle"
        showName
        showDomain
      />,
    );

    expect(screen.getByText('🧠')).toBeInTheDocument();
    expect(screen.getByText('Sophia')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();

    const avatar = container.querySelector('.relative.rounded-full');
    expect(avatar).not.toBeNull();
    expect(avatar?.className).toContain('h-12');
    expect(avatar?.className).toContain('w-12');
    expect(avatar?.className).toContain('text-base');
    expect((avatar as HTMLDivElement | null)?.style.background).toContain('linear-gradient(135deg');
    expect((avatar as HTMLDivElement | null)?.style.background).toContain('rgb(17, 34, 51)');
    expect((avatar as HTMLDivElement | null)?.style.background).toContain('rgb(68, 85, 102)');
    expect((avatar as HTMLDivElement | null)?.style.boxShadow).toContain('0 4px 15px');

    const badge = container.querySelector('.absolute.-bottom-0\\.5.-right-0\\.5');
    expect(badge?.className).toContain('bg-muted-foreground/50');
    expect(badge?.className).toContain('h-4');
    expect(badge?.className).toContain('w-4');
  });

  it('uses customName for the displayed label while keeping the agent emoji', () => {
    render(
      <JarvisAgentAvatar
        agentId="marcus"
        customName="Beta"
        showName
      />,
    );

    expect(screen.getByText('⚙️')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Marcus')).not.toBeInTheDocument();
  });

  it('applies interactive props and calls onClick when clickable', () => {
    const onClick = vi.fn();
    const { container } = render(
      <JarvisAgentAvatar
        agentId="olivia"
        onClick={onClick}
        className="extra-class"
      />,
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain('cursor-pointer');
    expect(root?.className).toContain('extra-class');

    fireEvent.click(root as Element);
    expect(onClick).toHaveBeenCalledTimes(1);

    const interactiveCall = motionDivSpy.mock.calls
      .map((call) => call[0] as { whileHover?: unknown; whileTap?: unknown; className?: string })
      .find((entry) => typeof entry.className === 'string' && entry.className.includes('relative rounded-full'));

    expect(interactiveCall?.whileHover).toEqual({ scale: 1.1 });
    expect(interactiveCall?.whileTap).toEqual({ scale: 0.95 });
  });

  it('renders thinking status with pulse badge, thinking dots, and looping animation', () => {
    const { container } = render(
      <JarvisAgentAvatar
        agentId="noah"
        status="thinking"
      />,
    );

    const badge = container.querySelector('.absolute.-bottom-0\\.5.-right-0\\.5');
    expect(badge?.className).toContain('bg-amber-500');
    expect(badge?.className).toContain('animate-pulse');

    const dots = container.querySelectorAll('.bg-amber-400');
    expect(dots).toHaveLength(3);

    const avatarCall = motionDivSpy.mock.calls
      .map((call) => call[0] as { animate?: unknown; transition?: unknown; className?: string; style?: React.CSSProperties })
      .find((entry) => typeof entry.className === 'string' && entry.className.includes('relative rounded-full'));

    expect(avatarCall?.animate).toEqual({ scale: [1, 1.05, 1] });
    expect(avatarCall?.transition).toEqual({
      duration: 1.2,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    expect(String(avatarCall?.style?.boxShadow)).toContain('0 0 15px');
  });

  it('renders speaking status with wave effects and speaking animation', () => {
    const { container } = render(
      <JarvisAgentAvatar
        agentId="emma"
        status="speaking"
      />,
    );

    const badge = container.querySelector('.absolute.-bottom-0\\.5.-right-0\\.5');
    expect(badge?.className).toContain('bg-emerald-500');
    expect(badge?.className).toContain('animate-pulse');

    const waveNodes = container.querySelectorAll('.absolute.inset-0.rounded-full');
    expect(waveNodes).toHaveLength(2);

    const avatarCall = motionDivSpy.mock.calls
      .map((call) => call[0] as { animate?: unknown; transition?: unknown; className?: string; style?: React.CSSProperties })
      .find((entry) => typeof entry.className === 'string' && entry.className.includes('relative rounded-full'));

    expect(avatarCall?.animate).toEqual({ scale: [1, 1.08, 1] });
    expect(avatarCall?.transition).toEqual({
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    expect(String(avatarCall?.style?.boxShadow)).toContain('0 0 20px');
  });

  it('renders error status with destructive badge and no speaking/thinking extras', () => {
    const { container } = render(
      <JarvisAgentAvatar
        agentId="alex"
        status="error"
      />,
    );

    const badge = container.querySelector('.absolute.-bottom-0\\.5.-right-0\\.5');
    expect(badge?.className).toContain('bg-destructive');
    expect(container.querySelectorAll('.bg-amber-400')).toHaveLength(0);
    expect(container.querySelectorAll('.absolute.inset-0.rounded-full')).toHaveLength(0);
  });

  it('returns null and warns for unknown agent ids', () => {
    const { container } = render(
      <JarvisAgentAvatar
        agentId={'ghost' as never}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(debugWarn).toHaveBeenCalledTimes(1);
    expect(debugWarn).toHaveBeenCalledWith('[JarvisAgentAvatar] Unknown agent: ghost');
  });
});

describe('JarvisAgentRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all enabled agents, shows active status, selected ring, and names', () => {
    const { container } = render(
      <JarvisAgentRow
        activeAgents={['sophia', 'emma']}
        selectedAgent="emma"
        showNames
        size="sm"
        enabledAgents={['sophia', 'emma', 'alex']}
      />,
    );

    expect(screen.getByText('Sophia')).toBeInTheDocument();
    expect(screen.getByText('Emma')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();

    expect(screen.queryByText('Marcus')).not.toBeInTheDocument();
    expect(screen.queryByText('Olivia')).not.toBeInTheDocument();
    expect(screen.queryByText('Noah')).not.toBeInTheDocument();

    const selectedWrapper = Array.from(container.querySelectorAll('div')).find((node) =>
      node.className.includes('ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full'),
    );
    expect(selectedWrapper).toBeDefined();

    const thinkingBadges = container.querySelectorAll('.bg-amber-500.animate-pulse');
    expect(thinkingBadges).toHaveLength(2);

    const idleBadges = container.querySelectorAll('.bg-muted-foreground\\/50');
    expect(idleBadges).toHaveLength(1);

    const smallAvatars = Array.from(container.querySelectorAll('.relative.rounded-full')).filter((node) =>
      node.className.includes('h-8 w-8 text-xs'),
    );
    expect(smallAvatars).toHaveLength(3);
  });

  it('calls onSelectAgent with the clicked agent id', () => {
    const onSelectAgent = vi.fn();

    render(
      <JarvisAgentRow
        enabledAgents={['sophia', 'marcus']}
        onSelectAgent={onSelectAgent}
        showNames
      />,
    );

    fireEvent.click(screen.getByText('Marcus'));
    expect(onSelectAgent).toHaveBeenCalledTimes(1);
    expect(onSelectAgent).toHaveBeenCalledWith('marcus');

    fireEvent.click(screen.getByText('Sophia'));
    expect(onSelectAgent).toHaveBeenCalledWith('sophia');
  });

  it('renders all default agents when enabledAgents is omitted', () => {
    render(<JarvisAgentRow showNames />);

    expect(screen.getByText('Sophia')).toBeInTheDocument();
    expect(screen.getByText('Marcus')).toBeInTheDocument();
    expect(screen.getByText('Olivia')).toBeInTheDocument();
    expect(screen.getByText('Noah')).toBeInTheDocument();
    expect(screen.getByText('Emma')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });
});