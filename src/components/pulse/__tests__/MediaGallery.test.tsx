import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaPreview } from '../MediaGallery';

describe('MediaPreview', () => {
  it('renders image thumbnail', () => {
    const item = {
      id: 'm1', file_name: 'photo.jpg', file_type: 'image',
      file_url: 'https://example.com/photo.jpg',
      thumbnail_url: 'https://example.com/thumb.jpg', file_size: 1024,
    } as any;
    render(<MediaPreview item={item} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'photo.jpg');
  });

  it('renders document icon for document type', () => {
    const item = {
      id: 'm2', file_name: 'rapport.pdf', file_type: 'document',
      file_url: 'https://example.com/rapport.pdf',
      thumbnail_url: null, file_size: 2048,
    } as any;
    render(<MediaPreview item={item} />);
    expect(screen.getByText('rapport.pdf')).toBeInTheDocument();
  });

  it('formats file size correctly', () => {
    const item = {
      id: 'm3', file_name: 'video.mp4', file_type: 'video',
      file_url: 'https://example.com/video.mp4',
      thumbnail_url: null, file_size: 1536000,
    } as any;
    render(<MediaPreview item={item} />);
    expect(screen.getByText(/Mo/)).toBeInTheDocument();
  });
});
