import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisStatusIndicator, JarvisStatusDot } from '../JarvisStatusIndicator';
import { TooltipProvider } from '@/components/ui/tooltip';

const wrap = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe('JarvisStatusIndicator', () => {
  it('renders connected status by default', () => {
    wrap(<JarvisStatusIndicator />);
    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it('renders disconnected status', () => {
    wrap(<JarvisStatusIndicator status="disconnected" />);
    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it('renders error status', () => {
    wrap(<JarvisStatusIndicator status="error" />);
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });

  it('renders connecting status', () => {
    wrap(<JarvisStatusIndicator status="connecting" />);
    expect(screen.getByText('Connexion...')).toBeInTheDocument();
  });

  it('renders idle status', () => {
    wrap(<JarvisStatusIndicator status="idle" />);
    expect(screen.getByText('Prêt')).toBeInTheDocument();
  });

  it('shows Réflexion when isTyping', () => {
    wrap(<JarvisStatusIndicator isTyping={true} />);
    expect(screen.getByText('Réflexion...')).toBeInTheDocument();
  });

  it('hides text in compact mode', () => {
    wrap(<JarvisStatusIndicator compact={true} />);
    expect(screen.queryByText('En ligne')).toBeNull();
  });
});

describe('JarvisStatusDot', () => {
  it('renders dot element', () => {
    const { container } = render(<JarvisStatusDot />);
    expect(container.querySelector('.rounded-full')).toBeTruthy();
  });

  it('renders with custom className', () => {
    const { container } = render(<JarvisStatusDot className="my-class" />);
    expect(container.querySelector('.my-class')).toBeTruthy();
  });
});
