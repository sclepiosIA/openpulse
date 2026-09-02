import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EmailListItemSkeleton, EmailListSkeleton } from '@/components/email/EmailListItemSkeleton';

describe('EmailListItemSkeleton', () => {
  it('should render with loading status', () => {
    render(React.createElement(EmailListItemSkeleton));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have accessible label', () => {
    render(React.createElement(EmailListItemSkeleton));
    expect(screen.getByLabelText("Chargement de l'email...")).toBeInTheDocument();
  });
});

describe('EmailListSkeleton', () => {
  it('should render default 10 skeletons', () => {
    render(React.createElement(EmailListSkeleton));
    const statuses = screen.getAllByLabelText("Chargement de l'email...");
    expect(statuses).toHaveLength(10);
  });

  it('should render custom count', () => {
    render(React.createElement(EmailListSkeleton, { count: 3 }));
    const statuses = screen.getAllByLabelText("Chargement de l'email...");
    expect(statuses).toHaveLength(3);
  });

  it('should have sr-only loading text', () => {
    render(React.createElement(EmailListSkeleton));
    expect(screen.getByText('Chargement des emails...')).toBeInTheDocument();
  });
});
