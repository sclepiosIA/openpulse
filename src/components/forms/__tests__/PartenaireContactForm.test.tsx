import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartenaireContactForm } from '../PartenaireContactForm';

describe('PartenaireContactForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };

  it('renders add contact dialog', () => {
    render(<PartenaireContactForm {...defaultProps} />);
    expect(screen.getByText('Ajouter un contact')).toBeInTheDocument();
    expect(screen.getByText(/nouveau contact pour ce partenaire/)).toBeInTheDocument();
  });

  it('renders edit mode when contact provided', () => {
    const contact = {
      id: '1',
      nom: 'Martin',
      prenom: 'Paul',
      fonction: 'Directeur',
      email: 'paul@test.com',
      telephone: '',
      notes: 'Note test',
      est_contact_principal: true,
      partenaire_id: 'p-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as any;
    render(<PartenaireContactForm {...defaultProps} contact={contact} />);
    expect(screen.getByText('Modifier le contact')).toBeInTheDocument();
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<PartenaireContactForm {...defaultProps} />);
    expect(screen.getByText('Nom *')).toBeInTheDocument();
    expect(screen.getByText('Prénom')).toBeInTheDocument();
    expect(screen.getByText('Fonction')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Téléphone')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Contact principal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<PartenaireContactForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Ajouter un contact')).not.toBeInTheDocument();
  });
});
