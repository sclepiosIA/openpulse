import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/todos/TodoPage', () => ({
  TodoPage: ({ isPWAMode }: any) => <div data-testid="todo-page">PWA:{String(isPWAMode)}</div>,
}));
vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}));

import MobileTodosApp from '../MobileTodosApp';

describe('MobileTodosApp', () => {
  it('renders TodoPage with isPWAMode=true', () => {
    render(<MobileTodosApp />);
    expect(screen.getByTestId('todo-page').textContent).toContain('true');
  });
});
