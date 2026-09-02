import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentUpload } from '../DocumentUpload';

vi.mock('@/hooks/documents/useDocumentUpload', () => ({
  useDocumentUpload: () => ({
    uploads: [],
    uploadFiles: vi.fn(),
    removeUpload: vi.fn(),
    isUploading: false,
  }),
}));

describe('DocumentUpload', () => {
  it('renders drop zone', () => {
    render(<DocumentUpload />);
    expect(screen.getByText(/Glissez-déposez/i)).toBeInTheDocument();
  });

  it('renders file limit info', () => {
    render(<DocumentUpload />);
    expect(screen.getByText(/cliquez/i)).toBeInTheDocument();
  });

  it('applies compact mode', () => {
    const { container } = render(<DocumentUpload compact />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DocumentUpload className="my-upload" />);
    expect(container.querySelector('.my-upload')).toBeInTheDocument();
  });
});
