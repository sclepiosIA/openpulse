import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/email/useEmailTemplates', () => ({
  useEmailTemplates: () => ({ data: [], isLoading: false }),
  useCreateEmailTemplate: () => ({ mutateAsync: vi.fn() }),
  useUpdateEmailTemplate: () => ({ mutateAsync: vi.fn() }),
  useDeleteEmailTemplate: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import EmailTemplates from '../EmailTemplates';

describe('EmailTemplates page', () => {
  it('renders title', () => {
    render(<EmailTemplates />);
    expect(screen.getByText("Templates d'emails")).toBeInTheDocument();
  });
});
