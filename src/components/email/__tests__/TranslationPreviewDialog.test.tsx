import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslationPreviewDialog } from '../TranslationPreviewDialog';

describe('TranslationPreviewDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    originalText: '<p>Bonjour le monde</p>',
    translatedText: '<p>Hello world</p>',
    targetLanguage: 'en',
    onUseTranslation: vi.fn(),
    onUseBoth: vi.fn(),
  };

  it('renders dialog when open', () => {
    render(<TranslationPreviewDialog {...defaultProps} />);
    expect(screen.getByText('Prévisualisation de la traduction')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TranslationPreviewDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Prévisualisation de la traduction')).not.toBeInTheDocument();
  });

  it('displays language info', () => {
    render(<TranslationPreviewDialog {...defaultProps} />);
    expect(screen.getByText(/Anglais/)).toBeInTheDocument();
  });

  it('renders original and translated content', () => {
    render(<TranslationPreviewDialog {...defaultProps} />);
    expect(screen.getByText('Bonjour le monde')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('calls onUseTranslation when button clicked', () => {
    render(<TranslationPreviewDialog {...defaultProps} />);
    fireEvent.click(screen.getByText(/Utiliser la traduction/));
    expect(defaultProps.onUseTranslation).toHaveBeenCalled();
  });

  it('calls onUseBoth when button clicked', () => {
    render(<TranslationPreviewDialog {...defaultProps} />);
    fireEvent.click(screen.getByText(/Garder les deux versions/));
    expect(defaultProps.onUseBoth).toHaveBeenCalled();
  });
});

