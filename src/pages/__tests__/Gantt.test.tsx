import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock the heavy GlobalGanttContainer
vi.mock('@/components/global-gantt/GlobalGanttContainer', () => ({
  GlobalGanttContainer: () => <div data-testid="gantt-container">Gantt</div>,
}));

import Gantt from '../Gantt';

describe('Gantt page', () => {
  it('renders GlobalGanttContainer', () => {
    const { getByTestId } = render(<Gantt />);
    expect(getByTestId('gantt-container')).toBeInTheDocument();
  });
});
