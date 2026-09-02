import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ContactRoleBadge } from '@/components/contacts/ContactRoleBadge';

// Mock the dialog to avoid complexity
vi.mock('@/components/contacts/ContactRoleQuickAssignDialog', () => ({
  ContactRoleQuickAssignDialog: () => null,
}));

describe('ContactRoleBadge', () => {
  const baseContact = {
    id: 'c1',
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean@example.com',
    type_contact: 'Cliniciens' as string | null,
  };

  it('should render known role with correct label', () => {
    render(React.createElement(ContactRoleBadge, { contact: baseContact }));
    expect(screen.getByText('Cliniciens')).toBeInTheDocument();
  });

  it('should render Administration role', () => {
    render(React.createElement(ContactRoleBadge, { contact: { ...baseContact, type_contact: 'Administration' } }));
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should render DIM role', () => {
    render(React.createElement(ContactRoleBadge, { contact: { ...baseContact, type_contact: 'DIM' } }));
    expect(screen.getByText('DIM')).toBeInTheDocument();
  });

  it('should render unknown role badge', () => {
    render(React.createElement(ContactRoleBadge, { contact: { ...baseContact, type_contact: null } }));
    expect(screen.getByText('Rôle inconnu')).toBeInTheDocument();
  });

  it('should render "Rôle inconnu" for explicit unknown', () => {
    render(React.createElement(ContactRoleBadge, { contact: { ...baseContact, type_contact: 'Rôle inconnu' } }));
    expect(screen.getByText('Rôle inconnu')).toBeInTheDocument();
  });

  it('should render custom unknown role as text', () => {
    render(React.createElement(ContactRoleBadge, { contact: { ...baseContact, type_contact: 'CustomRole' } }));
    expect(screen.getByText('CustomRole')).toBeInTheDocument();
  });

  it('should render small size variant', () => {
    const { container } = render(React.createElement(ContactRoleBadge, {
      contact: baseContact,
      size: 'sm',
    }));
    expect(container.querySelector('[class*="text-xs"]')).toBeInTheDocument();
  });
});
