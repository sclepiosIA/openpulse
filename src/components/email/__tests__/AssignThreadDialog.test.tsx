import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/search/useMultiEntitySearch', () => ({
  useMultiEntitySearch: () => ({ results: [], isLoading: false }),
}));

vi.mock('@/hooks/email/useAssignThreadWithParticipants', () => ({
  useAssignThreadWithParticipants: () => ({
    assignThread: vi.fn(),
    isAssigning: false,
  }),
  isMarqueEmail: () => false,
}));

vi.mock('@/lib/internalEmailConfig', () => ({
  isMarqueEmail: () => false,
}));

import { AssignThreadDialog } from '../AssignThreadDialog';

describe('AssignThreadDialog', () => {
  it('renders dialog when open', () => {
    render(
      <AssignThreadDialog
        open={true}
        onOpenChange={vi.fn()}
        threadId="t1"
        participants={[]}
      />
    );
    expect(screen.getByText(/Associer ce thread/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <AssignThreadDialog
        open={false}
        onOpenChange={vi.fn()}
        threadId="t1"
        participants={[]}
      />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
