import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const {
  MESSAGE_EMPTY,
  MESSAGE_FULL_FR,
  MESSAGE_FULL_EN,
  mockSanitizeDisplayName,
  spyVisioCard,
  spyCalendarCard,
  spyInlineGallery,
  spyAttachmentViewer,
  spyBilingualContent,
  spyContentWithImages,
  mockFormatDistanceToNow,
  spyEntityAvatar,
  onToggleMessageMock,
  onRefetchContentMock,
  onNavigateNextMock,
  onNavigatePreviousMock,
} = vi.hoisted(() => {
  const msgBase = {
    thread_id: 't1',
    subject: 'Sujet',
    from_address: 'sender@example.com',
    from_name: 'Sender Name',
    has_attachments: false,
    _wasEncoded: false,
    to_addresses: ['to1@example.com', { address: 'to2@example.com' }],
    sent_date: '2023-01-01T10:00:00.000Z',
  };

  const MESSAGE_EMPTY = {
    ...msgBase,
    id: 'm1',
    body_html: '',
    body_text: '',
    to_addresses: undefined,
  };

  const MESSAGE_FULL_FR = {
    ...msgBase,
    id: 'm2',
    from_name: 'FR Name',
    from_address: 'fr@example.com',
    has_attachments: true,
    _wasEncoded: true,
    body_html: '<p>Bonjour</p>',
    body_text: 'Bonjour',
    detected_language: 'fr',
  };

  const MESSAGE_FULL_EN = {
    ...msgBase,
    id: 'm3',
    from_name: 'EN Name',
    from_address: 'en@example.com',
    has_attachments: false,
    _wasEncoded: false,
    body_html: '<p>Hello</p>',
    body_text: 'Hello',
    detected_language: 'en',
    french_translation: 'Bonjour',
  };

  const mockSanitizeDisplayName = vi.fn((name: string | null | undefined) => {
    if (!name) return undefined;
    return `Sanitized(${name})`;
  });

  const spyVisioCard = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'visio-card' }, JSON.stringify(props));
  });

  const spyCalendarCard = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'calendar-card' }, JSON.stringify(props));
  });

  const spyInlineGallery = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'inline-gallery' }, JSON.stringify(props));
  });

  const spyAttachmentViewer = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'attachment-viewer' }, JSON.stringify(props));
  });

  const spyBilingualContent = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'bilingual-content' }, JSON.stringify(props));
  });

  const spyContentWithImages = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'content-with-images' }, JSON.stringify(props));
  });

  const mockFormatDistanceToNow = vi.fn(() => 'il y a un moment');

  const spyEntityAvatar = vi.fn((props: any) => {
    return React.createElement('div', { 'data-testid': 'entity-avatar' }, JSON.stringify(props));
  });

  const onToggleMessageMock = vi.fn();
  const onRefetchContentMock = vi.fn();
  const onNavigateNextMock = vi.fn();
  const onNavigatePreviousMock = vi.fn();

  return {
    MESSAGE_EMPTY,
    MESSAGE_FULL_FR,
    MESSAGE_FULL_EN,
    mockSanitizeDisplayName,
    spyVisioCard,
    spyCalendarCard,
    spyInlineGallery,
    spyAttachmentViewer,
    spyBilingualContent,
    spyContentWithImages,
    mockFormatDistanceToNow,
    spyEntityAvatar,
    onToggleMessageMock,
    onRefetchContentMock,
    onNavigateNextMock,
    onNavigatePreviousMock,
  };
});

vi.mock('@/components/ui/button', () => {
  const Button = ({ children, onClick, disabled, title }: any) =>
    React.createElement('button', { onClick, disabled, title, 'data-testid': 'ui-button' }, children);
  return { Button };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children }: any) => React.createElement('span', { 'data-testid': 'ui-badge' }, children);
  return { Badge };
});

vi.mock('@/components/ui/accordion', () => {
  const Accordion = ({ children }: any) => React.createElement('div', { 'data-testid': 'ui-accordion' }, children);
  const AccordionItem = ({ children, value }: any) =>
    React.createElement('div', { 'data-testid': `accordion-item-${value}` }, children);
  const AccordionTrigger = ({ children, onClick, className }: any) =>
    React.createElement('button', { onClick, className, 'data-testid': 'accordion-trigger' }, children);
  const AccordionContent = ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'accordion-content' }, children);
  return { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
});

vi.mock('lucide-react', () => {
  const Icon = (props: any) => React.createElement('span', { ...props });
  return {
    RefreshCw: Icon,
    Paperclip: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
  };
});

vi.mock('date-fns', () => {
  return { formatDistanceToNow: mockFormatDistanceToNow };
});

vi.mock('date-fns/locale', () => {
  return { fr: {} };
});

vi.mock('./EmailContentWithImages', () => {
  return { EmailContentWithImages: spyContentWithImages };
});

vi.mock('./BilingualEmailContent', () => {
  return { BilingualEmailContent: spyBilingualContent };
});

vi.mock('./EmailAttachmentViewer', () => {
  return { EmailAttachmentViewer: spyAttachmentViewer };
});

vi.mock('./EmailInlineImageGallery', () => {
  return { EmailInlineImageGallery: spyInlineGallery };
});

vi.mock('./EmailVisioInvitationCard', () => {
  return { EmailVisioInvitationCard: spyVisioCard };
});

vi.mock('./EmailCalendarInvitationCard', () => {
  return { EmailCalendarInvitationCard: spyCalendarCard };
});

vi.mock('@/components/ui/EntityAvatar', () => {
  return { EntityAvatar: spyEntityAvatar };
});

vi.mock('@/lib/emailUtils', () => {
  return { sanitizeDisplayName: mockSanitizeDisplayName };
});

import { EmailThreadMessages } from './EmailThreadMessages';

describe('EmailThreadMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation and handles next/previous navigation correctly', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_EMPTY, MESSAGE_FULL_FR, MESSAGE_FULL_EN]}
        currentMessageIndex={1}
        expandedMessages={new Set<string>()}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    const navText = screen.getByText('Message 2 sur 3');
    expect(navText).toBeTruthy();

    const buttons = screen.getAllByTestId('ui-button');
    // There are two nav buttons rendered
    const prevBtn = buttons.find((b) => b.getAttribute('title') === 'Message précédent (p)')!;
    const nextBtn = buttons.find((b) => b.getAttribute('title') === 'Message suivant (n)')!;

    expect(prevBtn.getAttribute('disabled')).toBeNull();
    expect(nextBtn.getAttribute('disabled')).toBeNull();

    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);

    expect(onNavigatePreviousMock).toHaveBeenCalledTimes(1);
    expect(onNavigateNextMock).toHaveBeenCalledTimes(1);
  });

  it('displays header info with sanitized name, relative date, recipients and badges', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_FULL_FR]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m2'])}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    // Sanitized display name appears
    expect(screen.getByText('Sanitized(FR Name)')).toBeTruthy();

    // Relative date string from mocked formatDistanceToNow
    expect(screen.getByText('il y a un moment')).toBeTruthy();

    // Recipients formatted as a string list
    expect(screen.getByText('À: to1@example.com, to2@example.com')).toBeTruthy();

    // Badges
    expect(screen.getByText('Pièces jointes')).toBeTruthy();
    expect(screen.getByText('Encodage corrigé')).toBeTruthy();

    // EntityAvatar receives sanitized name and email
    expect(spyEntityAvatar).toHaveBeenCalledTimes(1);
    const avatarProps = (spyEntityAvatar as any).mock.calls[0][0];
    expect(avatarProps.name).toBe('Sanitized(FR Name)');
    expect(avatarProps.email).toBe('fr@example.com');
    expect(avatarProps.size).toBe('sm');
  });

  it('calls onToggleMessage when clicking accordion trigger', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_EMPTY]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>()}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    const trigger = screen.getAllByTestId('accordion-trigger')[0];
    fireEvent.click(trigger);
    expect(onToggleMessageMock).toHaveBeenCalledWith('m1');
  });

  it('shows empty content panel and allows refetch; shows loading state when refetching', () => {
    const { rerender } = render(
      <EmailThreadMessages
        messages={[MESSAGE_EMPTY]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m1'])}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    const refetchBtn = screen.getByText('Récupérer le contenu').closest('button')!;
    expect(refetchBtn).toBeTruthy();
    expect(refetchBtn.getAttribute('disabled')).toBeNull();

    fireEvent.click(refetchBtn);
    expect(onRefetchContentMock).toHaveBeenCalledWith('m1');

    rerender(
      <EmailThreadMessages
        messages={[MESSAGE_EMPTY]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m1'])}
        refetchingContent={'m1'}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    const loadingBtn = screen.getByText('Récupération...').closest('button')!;
    expect(loadingBtn).toBeTruthy();
    expect(loadingBtn.getAttribute('disabled')).not.toBeNull();
  });

  it('renders full French content with content component, visio and calendar cards, and attachments components', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_FULL_FR]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m2'])}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    // Cards called with proper props
    expect(spyVisioCard).toHaveBeenCalledTimes(1);
    const visioProps = (spyVisioCard as any).mock.calls[0][0];
    expect(visioProps.messageId).toBe('m2');
    expect(visioProps.threadId).toBe('t1');
    expect(visioProps.bodyHtml).toBe('<p>Bonjour</p>');
    expect(visioProps.bodyText).toBe('Bonjour');
    expect(visioProps.subject).toBe('Sujet');
    expect(visioProps.fromAddress).toBe('fr@example.com');

    expect(spyCalendarCard).toHaveBeenCalledTimes(1);
    const calendarProps = (spyCalendarCard as any).mock.calls[0][0];
    expect(calendarProps.messageId).toBe('m2');
    expect(calendarProps.threadId).toBe('t1');
    expect(calendarProps.bodyHtml).toBe('<p>Bonjour</p>');
    expect(calendarProps.bodyText).toBe('Bonjour');
    expect(calendarProps.subject).toBe('Sujet');
    expect(calendarProps.fromAddress).toBe('fr@example.com');

    // Attachments present
    expect(screen.getByTestId('inline-gallery')).toBeTruthy();
    expect(screen.getByTestId('attachment-viewer')).toBeTruthy();

    // Content: French => EmailContentWithImages
    expect(spyContentWithImages).toHaveBeenCalledTimes(1);
    const contentProps = (spyContentWithImages as any).mock.calls[0][0];
    expect(contentProps.htmlContent).toBe('<p>Bonjour</p>');
    expect(contentProps.textContent).toBe('Bonjour');
    expect(contentProps.messageId).toBe('m2');

    // Bilingual should not be used
    expect(spyBilingualContent).not.toHaveBeenCalled();
  });

  it('renders bilingual content for non-French messages and no attachments when none present', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_FULL_EN]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m3'])}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    expect(spyBilingualContent).toHaveBeenCalledTimes(1);
    const bilingualProps = (spyBilingualContent as any).mock.calls[0][0];
    expect(bilingualProps.originalHtml).toBe('<p>Hello</p>');
    expect(bilingualProps.originalText).toBe('Hello');
    expect(bilingualProps.translationText).toBe('Bonjour');
    expect(bilingualProps.detectedLanguage).toBe('en');
    expect(bilingualProps.messageId).toBe('m3');

    expect(spyContentWithImages).not.toHaveBeenCalled();

    // No attachments components should render
    expect(screen.queryByTestId('inline-gallery')).toBeNull();
    expect(screen.queryByTestId('attachment-viewer')).toBeNull();
  });

  it('shows recipients fallback when to_addresses is not specified', () => {
    render(
      <EmailThreadMessages
        messages={[MESSAGE_EMPTY]}
        currentMessageIndex={0}
        expandedMessages={new Set<string>(['m1'])}
        refetchingContent={null}
        onToggleMessage={onToggleMessageMock}
        onRefetchContent={onRefetchContentMock}
        onNavigateNext={onNavigateNextMock}
        onNavigatePrevious={onNavigatePreviousMock}
      />
    );

    expect(screen.getByText('À: Non spécifié')).toBeTruthy();
  });
});