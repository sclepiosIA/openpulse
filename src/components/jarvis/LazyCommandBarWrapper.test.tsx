/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LazyCommandBarWrapper } from './LazyCommandBarWrapper';

const {
  mockLog,
  mockUseJarvisCommandBar,
  commandBarRenderSpy,
  actionPayload,
} = vi.hoisted(() => {
  const commandBarRenderSpy = vi.fn();
  const actionPayload = { id: 'act-1', type: 'open' };

  return {
    mockLog: vi.fn(),
    mockUseJarvisCommandBar: vi.fn((onAction: (action: { id: string; type: string }) => void) => ({
      CommandBar: () => {
        commandBarRenderSpy();
        onAction(actionPayload);
        return <div data-testid="lazy-command-bar">Jarvis Command Bar</div>;
      },
    })),
    commandBarRenderSpy,
    actionPayload,
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockLog,
  },
}));

vi.mock('@/components/jarvis/JarvisCommandBar', () => ({
  JarvisCommandBar: () => <div data-testid="unused-jarvis-component" />,
  useJarvisCommandBar: mockUseJarvisCommandBar,
}));

describe('LazyCommandBarWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the CommandBar returned by useJarvisCommandBar', () => {
    render(<LazyCommandBarWrapper />);

    expect(screen.getByTestId('lazy-command-bar')).toBeInTheDocument();
    expect(screen.getByText('Jarvis Command Bar')).toBeInTheDocument();
    expect(commandBarRenderSpy).toHaveBeenCalledTimes(1);
  });

  it('initializes useJarvisCommandBar with a callback that logs the action through debug.log', () => {
    render(<LazyCommandBarWrapper />);

    expect(mockUseJarvisCommandBar).toHaveBeenCalledTimes(1);
    expect(mockUseJarvisCommandBar).toHaveBeenCalledWith(expect.any(Function));
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith('[Jarvis CommandBar] Action:', actionPayload);
  });

  it('does not render the direct JarvisCommandBar export', () => {
    render(<LazyCommandBarWrapper />);

    expect(screen.queryByTestId('unused-jarvis-component')).not.toBeInTheDocument();
    expect(screen.getByTestId('lazy-command-bar')).toBeInTheDocument();
  });
});