import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnifiedPageHeader } from '../UnifiedPageHeader';

describe('UnifiedPageHeader', () => {
  it('renders title as h1', () => {
    render(<UnifiedPageHeader title="Paramètres" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paramètres');
  });

  it('renders actions', () => {
    render(<UnifiedPageHeader title="T" actions={<button>Save</button>} />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders children below header', () => {
    render(<UnifiedPageHeader title="T"><div>Tabs</div></UnifiedPageHeader>);
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('is sticky by default', () => {
    const { container } = render(<UnifiedPageHeader title="T" />);
    expect(container.firstChild).toHaveClass('sticky');
  });

  it('can disable sticky', () => {
    const { container } = render(<UnifiedPageHeader title="T" sticky={false} />);
    expect(container.firstChild).not.toHaveClass('sticky');
  });
});
