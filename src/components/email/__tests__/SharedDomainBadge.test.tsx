import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharedDomainBadge } from '../SharedDomainBadge';

describe('SharedDomainBadge', () => {
  it('returns null for single establishment', () => {
    const { container } = render(<SharedDomainBadge etablissementNames={['CHU Lyon']} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for empty array', () => {
    const { container } = render(<SharedDomainBadge etablissementNames={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders GHT badge for multiple establishments without group', () => {
    render(<SharedDomainBadge etablissementNames={['CHU Lyon', 'CH Grenoble', 'CH Annecy']} />);
    expect(screen.getByText('GHT (3)')).toBeInTheDocument();
  });

  it('renders group name badge when provided', () => {
    render(<SharedDomainBadge etablissementNames={['CHU Lyon', 'CH Grenoble']} groupeNom="GHT Rhône-Alpes" />);
    expect(screen.getByText('GHT Rhône-Alpes (2)')).toBeInTheDocument();
  });
});
