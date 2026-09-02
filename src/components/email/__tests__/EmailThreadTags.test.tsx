import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailThreadTags } from '../EmailThreadTags';

describe('EmailThreadTags', () => {
  it('renders tags', () => {
    render(<EmailThreadTags tags={['urgent', 'support']} onUpdateTags={vi.fn()} />);
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('support')).toBeInTheDocument();
  });

  it('removes tag on X click', () => {
    const onUpdate = vi.fn();
    render(<EmailThreadTags tags={['a', 'b']} onUpdateTags={onUpdate} />);
    // Find the X button inside the 'a' badge
    const aBadge = screen.getByText('a').closest('.inline-flex, [class*="badge"]');
    const xBtn = aBadge?.querySelector('button');
    if (xBtn) fireEvent.click(xBtn);
    expect(onUpdate).toHaveBeenCalledWith(['b']);
  });

  it('shows +N badge with maxVisible', () => {
    render(<EmailThreadTags tags={['a', 'b', 'c', 'd']} onUpdateTags={vi.fn()} maxVisible={2} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('expands hidden tags on +N click', () => {
    render(<EmailThreadTags tags={['a', 'b', 'c']} onUpdateTags={vi.fn()} maxVisible={1} />);
    fireEvent.click(screen.getByText('+2'));
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('renders empty state with add button', () => {
    render(<EmailThreadTags tags={[]} onUpdateTags={vi.fn()} />);
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });
});
