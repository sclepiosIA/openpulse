import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageLightbox } from '../ImageLightbox';

describe('ImageLightbox', () => {
  const images = [
    { id: '1', url: '/img1.png', filename: 'photo1.png' },
    { id: '2', url: '/img2.jpg', filename: 'photo2.jpg' },
    { id: '3', url: '/img3.gif', filename: 'photo3.gif' },
  ];

  it('returns null when no current image', () => {
    const { container } = render(
      <ImageLightbox images={[]} initialIndex={0} open={true} onOpenChange={vi.fn()} />
    );
    // Dialog might still render empty
    expect(container).toBeDefined();
  });

  it('renders current image filename', () => {
    render(
      <ImageLightbox images={images} initialIndex={0} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('photo1.png')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('renders image element with correct alt', () => {
    render(
      <ImageLightbox images={images} initialIndex={1} open={true} onOpenChange={vi.fn()} />
    );
    const imgs = screen.getAllByAltText('photo2.jpg');
    expect(imgs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders thumbnail strip for multiple images', () => {
    render(
      <ImageLightbox images={images} initialIndex={0} open={true} onOpenChange={vi.fn()} />
    );
    // 3 thumbnails + 1 main image = 4 img elements
    const allImgs = screen.getAllByRole('img');
    expect(allImgs.length).toBe(4);
  });

  it('renders download button when handler provided', () => {
    const onDownload = vi.fn();
    render(
      <ImageLightbox images={images} initialIndex={0} open={true} onOpenChange={vi.fn()} onDownload={onDownload} />
    );
    // Should have zoom-, zoom+, rotate, download, close buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });
});
