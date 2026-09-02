import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttachmentPreview } from '../AttachmentPreview';

vi.mock('react-pdf', () => ({
  Document: ({ children }: any) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page">PDF Page</div>,
}));

vi.mock('@/lib/pdfjs', () => ({}));

const attachment = {
  id: 'att1',
  filename: 'document.pdf',
  mime_type: 'application/pdf',
  storage_path: 'attachments/doc.pdf',
  size_bytes: 12345,
};

describe('AttachmentPreview', () => {
  const defaultProps = {
    attachment,
    open: true,
    onOpenChange: vi.fn(),
    onDownload: vi.fn(),
    getAttachmentUrl: vi.fn().mockResolvedValue('https://example.com/doc.pdf'),
  };

  it('renders dialog with filename', () => {
    render(<AttachmentPreview {...defaultProps} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('renders download button', () => {
    render(<AttachmentPreview {...defaultProps} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('.lucide-download')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AttachmentPreview {...defaultProps} open={false} />);
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('renders image preview for image attachments', () => {
    const imgAttachment = { ...attachment, filename: 'photo.jpg', mime_type: 'image/jpeg' };
    render(<AttachmentPreview {...defaultProps} attachment={imgAttachment} />);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });
});
