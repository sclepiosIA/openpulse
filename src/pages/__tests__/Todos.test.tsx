import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/todos/TodoPage', () => ({
  TodoPage: ({ isPWAMode }: any) => <div data-testid="todo-page">PWA:{String(isPWAMode)}</div>,
}));

import Todos from '../Todos';

describe('Todos page', () => {
  it('renders TodoPage with isPWAMode=false', () => {
    const { getByTestId } = render(<Todos />);
    expect(getByTestId('todo-page').textContent).toContain('false');
  });
});
