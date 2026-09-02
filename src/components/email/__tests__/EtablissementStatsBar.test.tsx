import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EtablissementStatsBar } from '../EtablissementStatsBar';

describe('EtablissementStatsBar', () => {
  const defaultProps = {
    totalEtablissements: 12,
    totalConversations: 45,
    totalMessages: 320,
    totalUnread: 8,
    avgEngagement: 75,
  };

  it('renders engagement percentage', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders engagement label', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('Engagement moyen')).toBeInTheDocument();
  });

  it('renders etablissements count', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders conversations count', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders messages count', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('320')).toBeInTheDocument();
  });

  it('renders unread count', () => {
    render(<EtablissementStatsBar {...defaultProps} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
