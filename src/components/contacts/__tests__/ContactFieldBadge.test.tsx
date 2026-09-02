import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ContactFieldBadge } from '@/components/contacts/ContactFieldBadge';

describe('ContactFieldBadge', () => {
  it('should render email source badge', () => {
    render(React.createElement(ContactFieldBadge, { source: 'email' }));
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should render FHF source badge', () => {
    render(React.createElement(ContactFieldBadge, { source: 'fhf' }));
    expect(screen.getByText('FHF')).toBeInTheDocument();
  });

  it('should render LinkedIn source badge', () => {
    render(React.createElement(ContactFieldBadge, { source: 'linkedin' }));
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('should render manual source badge', () => {
    render(React.createElement(ContactFieldBadge, { source: 'manual' }));
    expect(screen.getByText('Manuel')).toBeInTheDocument();
  });
});
