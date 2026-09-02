import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockVibrateSelection, mockCn, MotionDiv, MotionButton, AnimatePresenceMock, Icons } = vi.hoisted(() => {
  const mockVibrateSelection = vi.fn();
  const mockCn = (...classes: unknown[]) => classes.filter(Boolean).join(' ');
  const MotionDiv = (props: any) => {
    const { children, ...rest } = props;
    return (<div {...rest}>{children}</div>);
  };
  const MotionButton = (props: any) => {
    const { children, ...rest } = props;
    return (<button {...rest}>{children}</button>);
  };
  const AnimatePresenceMock = (props: any) => <>{props.children}</>;
  const Icons = {
    Search: (p: any) => <span {...p} data-icon="Search" />,
    Sparkles: (p: any) => <span {...p} data-icon="Sparkles" />,
    Mail: (p: any) => <span {...p} data-icon="Mail" />,
    BarChart2: (p: any) => <span {...p} data-icon="BarChart2" />,
    FileText: (p: any) => <span {...p} data-icon="FileText" />,
    Users: (p: any) => <span {...p} data-icon="Users" />,
    ArrowRight: (p: any) => <span {...p} data-icon="ArrowRight" />,
    Command: (p: any) => <span {...p} data-icon="Command" />,
    CheckCircle: (p: any) => <span {...p} data-icon="CheckCircle" />,
    MessageCircle: (p: any) => <span {...p} data-icon="MessageCircle" />,
    Brain: (p: any) => <span {...p} data-icon="Brain" />,
  };
  return { mockVibrateSelection, mockCn, MotionDiv, MotionButton, AnimatePresenceMock, Icons };
});

vi.mock('@/lib/haptics', () => ({ vibrateSelection: mockVibrateSelection }));
vi.mock('@/lib/utils', () => ({ cn: mockCn }));
vi.mock('framer-motion', () => ({ motion: { div: MotionDiv, button: MotionButton }, AnimatePresence: AnimatePresenceMock }));
vi.mock('lucide-react', () => Icons);

import { JarvisCommandBar, useJarvisCommandBar } from './JarvisCommandBar';

const createWrapper = () => {
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

describe('JarvisCommandBar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={false} onClose={onClose} onCommand={onCommand} />);
    expect(screen.queryByPlaceholderText('Que voulez-vous faire ?')).toBeNull();
  });

  it('renders when open and lists default commands', () => {
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    expect(screen.getByPlaceholderText('Que voulez-vous faire ?')).toBeInTheDocument();

    // Check presence of some known commands
    expect(screen.getByText('Briefing du jour')).toBeInTheDocument();
    expect(screen.getByText('Tâches prioritaires')).toBeInTheDocument();
    expect(screen.getByText('Rapport hebdo')).toBeInTheDocument();
    expect(screen.getByText('Analyser les tendances')).toBeInTheDocument();

    // Ensure we have 8 command buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(8);
  });

  it('filters commands by search input', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    const input = screen.getByPlaceholderText('Que voulez-vous faire ?');
    await user.type(input, 'email');

    // Should include email-related commands
    expect(screen.getByText('Emails urgents')).toBeInTheDocument();
    expect(screen.getByText('Composer un email')).toBeInTheDocument();

    // Should not include unrelated command
    expect(screen.queryByText('Briefing du jour')).toBeNull();
  });

  it('shows empty state when no command matches', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    const input = screen.getByPlaceholderText('Que voulez-vous faire ?');
    await user.type(input, 'zzzz');

    expect(screen.getByText('Aucune commande trouvée')).toBeInTheDocument();
  });

  it('keyboard navigation and enter triggers correct command, vibrates and closes', () => {
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    // Move selection from index 0 to index 1
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    // Press Enter to select
    fireEvent.keyDown(window, { key: 'Enter' });

    // Second command is "Tâches prioritaires" with action "Mes tâches prioritaires"
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith('Mes tâches prioritaires');
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a command triggers onCommand with its action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCommand = vi.fn();
    render(<JarvisCommandBar isOpen={true} onClose={onClose} onCommand={onCommand} />);

    const btn = screen.getByText('Rapport hebdo').closest('button');
    expect(btn).not.toBeNull();

    await user.click(btn as HTMLElement);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith('Génère un rapport hebdomadaire');
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useJarvisCommandBar hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens on Ctrl+K and close() sets isOpen to false', () => {
    const onCommand = vi.fn();
    const wrapper = createWrapper();

    const { result, unmount } = renderHook(() => useJarvisCommandBar(onCommand), { wrapper });

    expect(result.current.isOpen).toBe(false);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);

    unmount();
  });
});