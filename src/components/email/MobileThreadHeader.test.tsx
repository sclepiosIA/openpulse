import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileThreadHeader } from './MobileThreadHeader';

const {
  MockButton,
  MockBadge,
  MockCard,
  MockDropdownMenu,
  MockDropdownMenuTrigger,
  MockDropdownMenuContent,
  MockDropdownMenuItem,
  mockSanitizeEmailSubject,
  BASE_THREAD,
} = vi.hoisted(() => {
  const MockButton = ({ children, onClick, className, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
  const MockBadge = ({ children, className }: any) => <span className={className}>{children}</span>;
  const MockCard = ({ children, className, onClick }: any) => (
    <div className={className} onClick={onClick} data-testid="mock-card">
      {children}
    </div>
  );
  const MockDropdownMenu = ({ children }: any) => <div>{children}</div>;
  const MockDropdownMenuTrigger = ({ children }: any) => <div>{children}</div>;
  const MockDropdownMenuContent = ({ children }: any) => <div>{children}</div>;
  const MockDropdownMenuItem = ({ children, onClick, disabled }: any) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  );
  const mockSanitizeEmailSubject = (input: string) => `SAN(${input})`;
  const BASE_THREAD = {
    ai_generated_title: 'AI Title',
    subject: 'Original Subject',
    ai_summary:
      'This is a very long AI generated summary that should exceed eighty characters to enable the toggle UI and test the clamping behavior correctly.',
    suggested_actions: ['Answer now', 'Schedule meeting'],
    is_archived: false,
    is_spam: false,
    priority: 'high',
    category: 'Sales',
    account: { email_address: 'acc@example.com' },
  };
  return {
    MockButton,
    MockBadge,
    MockCard,
    MockDropdownMenu,
    MockDropdownMenuTrigger,
    MockDropdownMenuContent,
    MockDropdownMenuItem,
    mockSanitizeEmailSubject,
    BASE_THREAD,
  };
});

vi.mock('@/components/ui/button', () => ({ Button: MockButton }));
vi.mock('@/components/ui/badge', () => ({ Badge: MockBadge }));
vi.mock('@/components/ui/card', () => ({ Card: MockCard }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: MockDropdownMenu,
  DropdownMenuTrigger: MockDropdownMenuTrigger,
  DropdownMenuContent: MockDropdownMenuContent,
  DropdownMenuItem: MockDropdownMenuItem,
}));
vi.mock('@/lib/emailUtils', () => ({ sanitizeEmailSubject: mockSanitizeEmailSubject }));

describe('MobileThreadHeader', () => {
  it('renders sanitized AI title and triggers back/reply callbacks', () => {
    const onBack = vi.fn();
    const onReply = vi.fn();
    const onReplyAll = vi.fn();
    const onArchive = vi.fn();
    const onMarkSpam = vi.fn();

    const thread = { ...BASE_THREAD };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={onBack}
        onReply={onReply}
        onReplyAll={onReplyAll}
        onArchive={onArchive}
        onMarkSpam={onMarkSpam}
      />
    );

    expect(screen.getByRole('heading', { name: 'SAN(AI Title)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('renders badges for category, priority, archived status and account email', () => {
    const thread = { ...BASE_THREAD, is_archived: true };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={vi.fn()}
        onMarkSpam={vi.fn()}
      />
    );

    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Priorité haute')).toBeInTheDocument();
    expect(screen.getByText('Archivé')).toBeInTheDocument();
    expect(screen.getByText('acc@example.com')).toBeInTheDocument();
  });

  it('shows AI summary with clamped text initially and expands to show suggested actions on click', () => {
    const thread = { ...BASE_THREAD };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={vi.fn()}
        onMarkSpam={vi.fn()}
      />
    );

    expect(screen.getByText('Résumé IA')).toBeInTheDocument();

    const summaryText = `SAN(${thread.ai_summary})`;
    const summaryNode = screen.getByText(summaryText);
    expect(summaryNode).toBeInTheDocument();
    expect(summaryNode.className).toMatch(/line-clamp-2/);

    fireEvent.click(screen.getByTestId('mock-card'));

    const expandedSummaryNode = screen.getByText(summaryText);
    expect(expandedSummaryNode.className).not.toMatch(/line-clamp-2/);

    expect(screen.getByText('Actions suggérées')).toBeInTheDocument();
    expect(screen.getByText('Answer now')).toBeInTheDocument();
    expect(screen.getByText('Schedule meeting')).toBeInTheDocument();
  });

  it('does not render AI summary section when ai_summary is missing', () => {
    const thread = { ...BASE_THREAD, ai_summary: undefined, suggested_actions: [] };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={vi.fn()}
        onMarkSpam={vi.fn()}
      />
    );

    expect(screen.queryByText('Résumé IA')).not.toBeInTheDocument();
  });

  it('renders subject when ai_generated_title is absent and sanitizes it', () => {
    const thread = { ...BASE_THREAD, ai_generated_title: undefined, subject: 'Fallback Subject' };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={vi.fn()}
        onMarkSpam={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'SAN(Fallback Subject)' })).toBeInTheDocument();
  });

  it('dropdown items call appropriate callbacks and show correct labels', () => {
    const onReplyAll = vi.fn();
    const onArchive = vi.fn();
    const onMarkSpam = vi.fn();

    const thread = { ...BASE_THREAD, is_archived: false, is_spam: false };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={onReplyAll}
        onArchive={onArchive}
        onMarkSpam={onMarkSpam}
      />
    );

    expect(screen.getByText('Répondre à tous')).toBeInTheDocument();
    expect(screen.getByText('Archiver')).toBeInTheDocument();
    expect(screen.getByText('Marquer spam')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Répondre à tous'));
    expect(onReplyAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Archiver'));
    expect(onArchive).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Marquer spam'));
    expect(onMarkSpam).toHaveBeenCalledTimes(1);
  });

  it('shows Désarchiver when thread is archived and Retirer du spam when is_spam is true', () => {
    const onArchive = vi.fn();
    const onMarkSpam = vi.fn();

    const thread = { ...BASE_THREAD, is_archived: true, is_spam: true };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={onArchive}
        onMarkSpam={onMarkSpam}
      />
    );

    expect(screen.getByText('Désarchiver')).toBeInTheDocument();
    expect(screen.getByText('Retirer du spam')).toBeInTheDocument();
  });

  it('does not call onArchive when isArchiving is true (disabled action)', () => {
    const onArchive = vi.fn();
    const thread = { ...BASE_THREAD, is_archived: false };
    render(
      <MobileThreadHeader
        thread={thread}
        onBack={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onArchive={onArchive}
        onMarkSpam={vi.fn()}
        isArchiving={true}
      />
    );

    const archiverBtn = screen.getByText('Archiver');
    expect(archiverBtn).toBeDisabled();
    fireEvent.click(archiverBtn);
    expect(onArchive).not.toHaveBeenCalled();
  });
});