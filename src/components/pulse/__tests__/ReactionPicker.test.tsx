import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactionPicker } from '../ReactionPicker';

describe('ReactionPicker', () => {
  it('renders search input', () => {
    render(<ReactionPicker onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText('Rechercher un emoji...')).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    render(<ReactionPicker onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(13);
  });

  it('renders quick reaction bar', () => {
    render(<ReactionPicker onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Réaction rapide 👍')).toBeInTheDocument();
    expect(screen.getByLabelText('Réaction rapide ❤️')).toBeInTheDocument();
  });

  it('calls onSelect when emoji clicked', () => {
    const onSelect = vi.fn();
    render(<ReactionPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Réaction rapide 👍'));
    expect(onSelect).toHaveBeenCalledWith('👍');
  });

  it('filters emojis by search', () => {
    render(<ReactionPicker onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Rechercher un emoji...'), { target: { value: 'coeur' } });
    expect(screen.getByLabelText('Sélectionner ❤️')).toBeInTheDocument();
  });

  it('shows filtered results for partial keyword match', () => {
    render(<ReactionPicker onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Rechercher un emoji...'), { target: { value: 'merci' } });
    expect(screen.getByLabelText('Sélectionner 🙏')).toBeInTheDocument();
  });
});
