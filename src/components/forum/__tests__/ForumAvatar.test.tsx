import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForumAvatar } from '../ForumAvatar';

describe('ForumAvatar', () => {
  it('renders initials from nom and prenom', () => {
    render(<ForumAvatar nom="Dupont" prenom="Jean" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders single initial when only prenom', () => {
    render(<ForumAvatar prenom="Marie" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders single initial when only nom', () => {
    render(<ForumAvatar nom="Martin" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders ? when no name', () => {
    render(<ForumAvatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ForumAvatar nom="A" prenom="B" className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
