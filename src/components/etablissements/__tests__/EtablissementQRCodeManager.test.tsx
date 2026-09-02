import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockQRData = { current: null as null | { qr_access_token: string; qr_access_expires_at: string } };
const generateMutate = vi.fn();

vi.mock('@/hooks/crm/useEtablissementQRCode', () => ({
  useEtablissementQRCode: () => ({ data: mockQRData.current, isLoading: false }),
  useGenerateEtablissementQRToken: () => ({ mutate: generateMutate, isPending: false }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')) },
}));

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EtablissementQRCodeManager } from '../EtablissementQRCodeManager';
import userEvent from '@testing-library/user-event';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderManager() {
  render(
    <QueryClientProvider client={qc}>
      <EtablissementQRCodeManager etablissementId="e1" etablissementNom="CHU Test" slug="chu-test" />
    </QueryClientProvider>
  );
}

describe('EtablissementQRCodeManager', () => {
  it('shows the empty state and a Générer button when no token exists', () => {
    mockQRData.current = null;
    renderManager();
    expect(screen.getByText(/Aucun QR code généré/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Générer un QR Code/i })).toBeInTheDocument();
  });

  it('shows the expired state and re-triggers generation when token is past expiry', async () => {
    mockQRData.current = {
      qr_access_token: 'tok-old',
      qr_access_expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    renderManager();
    expect(screen.getByText(/Le QR code a expiré/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Générer un QR Code/i }));
    expect(generateMutate).toHaveBeenCalledWith('e1');
  });

  it('renders the QR image when a valid token exists', async () => {
    mockQRData.current = {
      qr_access_token: 'tok-valid',
      qr_access_expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    renderManager();
    // The img element is rendered with alt="QR Code" once toDataURL resolves
    const img = await screen.findByAltText('QR Code');
    expect(img).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/));
  });
});
