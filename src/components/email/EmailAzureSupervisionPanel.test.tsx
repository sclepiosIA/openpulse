import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailAzureSupervisionPanel } from './EmailAzureSupervisionPanel';
import type { EmailAzureSyncStatusResponse } from '@/types/emailAzure';

const mockUseEmailAzureSyncStatus = vi.fn();

vi.mock('@/hooks/email/useEmailAzureSyncStatus', () => ({
  useEmailAzureSyncStatus: () => mockUseEmailAzureSyncStatus(),
}));

const okPayload: EmailAzureSyncStatusResponse = {
  backend: 'azure',
  generated_at: '2026-07-07T12:00:00Z',
  accounts: [
    {
      account_id: 'acc-1',
      email_address: 'contact@exploitant.example.org',
      provider: 'imap_smtp',
      sync_enabled: true,
      last_sync_at: '2026-07-07T11:55:00Z',
      last_error: null,
      error_count: 0,
      pending_messages: 3,
      health: 'healthy',
    },
    {
      account_id: 'acc-2',
      email_address: 'support@exploitant.example.org',
      provider: 'microsoft_graph',
      sync_enabled: true,
      last_sync_at: null,
      last_error: 'IMAP timeout',
      error_count: 4,
      pending_messages: 0,
      health: 'error',
    },
  ],
  queue: { ai_pending: 5, unclassified: 12 },
};

beforeEach(() => {
  mockUseEmailAzureSyncStatus.mockReset();
});

describe('EmailAzureSupervisionPanel', () => {
  it('ne rend RIEN en mode supabase (comportement historique intact)', () => {
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: false,
      backend: 'supabase',
      result: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    const { container } = render(<EmailAzureSupervisionPanel />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('email-azure-supervision-panel')).not.toBeInTheDocument();
  });

  it("affiche l'état non configuré en mode hybrid sans API URL", () => {
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: true,
      backend: 'hybrid',
      result: { state: 'unconfigured' },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<EmailAzureSupervisionPanel />);
    expect(screen.getByTestId('email-azure-supervision-panel')).toBeInTheDocument();
    expect(screen.getByTestId('azure-supervision-unconfigured')).toBeInTheDocument();
    expect(screen.getByText(/VITE_EMAIL_AZURE_API_URL/)).toBeInTheDocument();
    expect(screen.getByText('hybrid')).toBeInTheDocument();
  });

  it('affiche les comptes, la santé et les files IA en état ok', () => {
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: true,
      backend: 'azure',
      result: { state: 'ok', data: okPayload },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<EmailAzureSupervisionPanel />);
    expect(screen.getByTestId('azure-supervision-accounts')).toBeInTheDocument();
    expect(screen.getByText('contact@exploitant.example.org')).toBeInTheDocument();
    expect(screen.getByText('support@exploitant.example.org')).toBeInTheDocument();
    expect(screen.getByText('Opérationnel')).toBeInTheDocument();
    expect(screen.getByText('Erreur')).toBeInTheDocument();
    expect(screen.getByText(/IMAP timeout/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it("affiche le message d'erreur si la supervision est indisponible", () => {
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: true,
      backend: 'hybrid',
      result: { state: 'error', message: 'HTTP 503' },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<EmailAzureSupervisionPanel />);
    expect(screen.getByTestId('azure-supervision-error')).toHaveTextContent('HTTP 503');
  });

  it('affiche un squelette pendant le chargement', () => {
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: true,
      backend: 'hybrid',
      result: null,
      isLoading: true,
      refetch: vi.fn(),
    });
    render(<EmailAzureSupervisionPanel />);
    expect(screen.getByTestId('azure-supervision-loading')).toBeInTheDocument();
  });

  it('déclenche refetch via le bouton rafraîchir', async () => {
    const refetch = vi.fn();
    mockUseEmailAzureSyncStatus.mockReturnValue({
      azureEnabled: true,
      backend: 'hybrid',
      result: { state: 'unconfigured' },
      isLoading: false,
      refetch,
    });
    render(<EmailAzureSupervisionPanel />);
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: /rafraîchir la supervision azure/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
