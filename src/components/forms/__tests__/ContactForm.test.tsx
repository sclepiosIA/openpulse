import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactForm } from '../ContactForm';

describe('ContactForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };

  it('renders add contact dialog when open', () => {
    render(<ContactForm {...defaultProps} />);
    expect(screen.getByText('Ajouter un contact')).toBeInTheDocument();
  });

  it('renders edit mode when contact is provided', () => {
    const contact = {
      id: '1',
      nom: 'Dupont',
      prenom: 'Jean',
      fonction: 'DSI',
      email: 'jean@test.com',
      telephone: '0199001234',
      type_contact: 'informatique',
      est_contact_principal: false,
      etablissement_id: 'etab-1',
      created_at: '2024-01-01',
      created_metadata: {},
      created_source: null,
      engagement: null,
      groupe_id: null,
      last_contacted_at: null,
      notes: null,
      partenaire_id: null,
      score_confiance: null,
      updated_at: '2024-01-01',
      updated_by: null,
    } as any;
    render(<ContactForm {...defaultProps} contact={contact} />);
    expect(screen.getByText('Modifier le contact')).toBeInTheDocument();
  });

  it('renders required fields', () => {
    render(<ContactForm {...defaultProps} />);
    expect(screen.getByText('Nom *')).toBeInTheDocument();
    expect(screen.getByText('Fonction *')).toBeInTheDocument();
  });

  it('renders form buttons', () => {
    render(<ContactForm {...defaultProps} />);
    expect(screen.getByText('Annuler')).toBeInTheDocument();
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ContactForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Ajouter un contact')).not.toBeInTheDocument();
  });
});
