import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const { mockNavigate, mockToast, AUTH, mockWriteText } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
  AUTH: { user: { id: 'u1', email: 'doc@test.fr' } },
  mockWriteText: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH,
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const passthroughDiv = (testId?: string) =>
  ({ children, ...rest }: DivProps) =>
    React.createElement('div', { ...rest, 'data-testid': testId }, children);

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...rest }: BtnProps) =>
    React.createElement('button', rest, children),
}));

vi.mock('@/components/ui/card', () => ({
  Card: passthroughDiv(),
  CardContent: passthroughDiv(),
  CardDescription: passthroughDiv(),
  CardHeader: passthroughDiv(),
  CardTitle: passthroughDiv(),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: passthroughDiv(),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: passthroughDiv(),
  AlertDescription: passthroughDiv(),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: passthroughDiv('tabs-root'),
  TabsContent: passthroughDiv(),
  TabsList: passthroughDiv(),
  TabsTrigger: passthroughDiv(),
}));

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    ArrowLeft: Icon,
    HardDrive: Icon,
    Monitor: Icon,
    Apple: Icon,
    Terminal: Icon,
    Copy: Icon,
    CheckCircle: Icon,
    Info: Icon,
    Shield: Icon,
  };
});

describe('ParametresWebDAV', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderPage() {
    const mod = await import('./ParametresWebDAV');
    const Page = mod.default;
    return render(React.createElement(Page));
  }

  it('affiche le titre, l’URL WebDAV et l’email de l’utilisateur connecté', async () => {
    await renderPage();

    expect(screen.getByText('Lecteur réseau WebDAV')).toBeTruthy();

    const url = 'https://example.supabase.co/functions/v1/webdav-server';
    const urlOccurrences = screen.getAllByText(url);
    expect(urlOccurrences.length).toBeGreaterThanOrEqual(1);

    const emails = screen.getAllByText(/doc@test\.fr/);
    expect(emails.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Informations de connexion')).toBeTruthy();
    expect(screen.getByText('Opérations supportées')).toBeTruthy();
  });

  it('affiche les instructions pour les trois systèmes d’exploitation', async () => {
    await renderPage();

    expect(
      screen.getByText('Monter comme lecteur réseau sur Windows'),
    ).toBeTruthy();
    expect(
      screen.getByText('Monter comme lecteur réseau sur macOS'),
    ).toBeTruthy();
    expect(
      screen.getByText('Monter comme lecteur réseau sur Linux'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'davs://example.supabase.co/functions/v1/webdav-server',
      ),
    ).toBeTruthy();
  });

  it('navigue vers /parametres au clic sur le bouton retour', async () => {
    await renderPage();

    const backButton = screen.getByLabelText('Retour');
    await act(async () => {
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/parametres');
  });

  it('copie l’URL WebDAV dans le presse-papiers et affiche un toast', async () => {
    await renderPage();

    const buttons = screen.getAllByRole('button');
    const copyUrlButton = buttons[1];

    await act(async () => {
      fireEvent.click(copyUrlButton);
    });

    expect(mockWriteText).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/webdav-server',
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Copié !' }),
    );
  });

  it("copie l'email de l'utilisateur via le bouton de copie de l'identifiant", async () => {
    await renderPage();

    const buttons = screen.getAllByRole('button');
    const copyEmailButton = buttons[2];

    await act(async () => {
      fireEvent.click(copyEmailButton);
    });

    expect(mockWriteText).toHaveBeenCalledWith('doc@test.fr');
    expect(mockToast).toHaveBeenCalledTimes(1);
  });
});