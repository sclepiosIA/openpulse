import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptionSummaryView } from '../TranscriptionSummaryView';

const baseSession = {
  id: 's1',
  title: 'Réunion Sprint 42',
  status: 'ended' as const,
  started_at: '2026-03-09T10:00:00Z',
  ended_at: '2026-03-09T10:45:30Z',
  summary: 'Discussion sur le nouveau module CRM.',
  decisions: [
    { decision: 'Migrer vers GPT-5', owner: 'Jean' },
    { decision: 'Reporter le déploiement', owner: 'Marie' },
  ],
  next_steps: [
    { task: 'Préparer le POC', assignee: 'Jean', priority: 'haute', deadline: '2026-03-15' },
    { task: 'Rédiger le CR', assignee: 'Alice', priority: 'basse' },
  ],
  full_transcript: 'Jean: Bonjour à tous...\nMarie: Merci Jean...',
  participants: [],
} as any;

describe('TranscriptionSummaryView', () => {
  it('renders session title', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('Réunion Sprint 42')).toBeInTheDocument();
  });

  it('renders duration', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText(/45 min 30 sec/)).toBeInTheDocument();
  });

  it('renders summary', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('Discussion sur le nouveau module CRM.')).toBeInTheDocument();
  });

  it('renders decisions', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('Décisions prises')).toBeInTheDocument();
    expect(screen.getByText('Migrer vers GPT-5')).toBeInTheDocument();
    expect(screen.getByText('Reporter le déploiement')).toBeInTheDocument();
    expect(screen.getByText('Responsable: Jean')).toBeInTheDocument();
  });

  it('renders next steps', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('Prochaines étapes')).toBeInTheDocument();
    expect(screen.getByText('Préparer le POC')).toBeInTheDocument();
    expect(screen.getByText('haute')).toBeInTheDocument();
    expect(screen.getByText('→ Jean')).toBeInTheDocument();
  });

  it('shows create task buttons when handler provided', () => {
    render(<TranscriptionSummaryView session={baseSession} onCreateTask={vi.fn()} />);
    const buttons = screen.getAllByText('Créer tâche');
    expect(buttons.length).toBe(2);
  });

  it('hides create task buttons when no handler', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.queryByText('Créer tâche')).toBeNull();
  });

  it('shows archive button when not archived', () => {
    render(<TranscriptionSummaryView session={baseSession} onArchive={vi.fn()} />);
    expect(screen.getByText('Archiver')).toBeInTheDocument();
  });

  it('hides archive button when already archived', () => {
    const archived = { ...baseSession, status: 'archived' };
    render(<TranscriptionSummaryView session={archived} onArchive={vi.fn()} />);
    expect(screen.queryByText('Archiver')).toBeNull();
  });

  it('shows transcript toggle', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('Transcription complète')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<TranscriptionSummaryView session={baseSession} />);
    expect(screen.getByText('ended')).toBeInTheDocument();
  });

  it('shows Archivé badge for archived status', () => {
    const archived = { ...baseSession, status: 'archived' };
    render(<TranscriptionSummaryView session={archived} />);
    expect(screen.getByText('Archivé')).toBeInTheDocument();
  });
});
