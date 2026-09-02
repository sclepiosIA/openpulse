import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactRoleQuickAssignDialog } from '../ContactRoleQuickAssignDialog';

describe('ContactRoleQuickAssignDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    contactData: { nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com' },
  };

  it('renders dialog title when open', () => {
    render(<ContactRoleQuickAssignDialog {...defaultProps} />);
    expect(screen.getByText('Assigner un rôle au contact')).toBeInTheDocument();
  });

  it('renders role options', () => {
    render(<ContactRoleQuickAssignDialog {...defaultProps} />);
    expect(screen.getByText('Cliniciens')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('calls onSelect when role clicked', () => {
    const onSelect = vi.fn();
    render(<ContactRoleQuickAssignDialog {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Cliniciens'));
    expect(onSelect).toHaveBeenCalledWith('Cliniciens');
  });
});
