import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/jarvis/useJarvisContextualSuggestions', () => ({
  useJarvisContextualSuggestions: () => ({
    suggestions: [],
    quickActions: [
      { id: 'a1', label: 'Briefing', command: 'résume ma journée', icon: 'summary', category: 'analyze', priority: 1 },
    ],
    pageType: 'dashboard',
    module: 'dashboard',
    isLoading: false,
  }),
}));

import { JarvisQuickActions } from '../JarvisQuickActions';

describe('JarvisQuickActions', () => {
  it('renders action buttons', () => {
    render(
      <TooltipProvider>
        <JarvisQuickActions onExecute={vi.fn()} />
      </TooltipProvider>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onExecute when clicked', () => {
    const onExecute = vi.fn();
    render(
      <TooltipProvider>
        <JarvisQuickActions onExecute={onExecute} />
      </TooltipProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onExecute).toHaveBeenCalledWith('résume ma journée');
  });
});
