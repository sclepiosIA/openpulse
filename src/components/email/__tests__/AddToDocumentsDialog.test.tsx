import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddToDocumentsDialog } from '../AddToDocumentsDialog';

describe('AddToDocumentsDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    attachment: { id: 'a1', filename: 'doc.pdf', content_type: 'application/pdf', storage_path: '/path' },
    etablissementId: 'e1',
  };

  it('renders dialog when open', () => {
    render(<AddToDocumentsDialog {...defaultProps} />);
    expect(screen.getByText(/Ajouter aux documents/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AddToDocumentsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText(/Ajouter aux documents/i)).not.toBeInTheDocument();
  });

  it('renders filename in form', () => {
    render(<AddToDocumentsDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('doc.pdf')).toBeInTheDocument();
  });
});
