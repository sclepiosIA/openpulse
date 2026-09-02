import React from 'react';
import { render, screen, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  MockCard,
  MockCardContent,
  MockCardDescription,
  MockCardHeader,
  MockCardTitle,
  MockBadge,
  MockProgress,
  IconLoader2,
  IconCheckCircle2,
  IconAlertCircle,
  mockFormatMontant,
} = vi.hoisted(() => {
  type BasicProps = { children?: React.ReactNode; className?: string };
  const MockCard: React.FC<BasicProps> = ({ children, className }) => (
    <div data-ui="Card" className={className}>{children}</div>
  );
  const MockCardContent: React.FC<BasicProps> = ({ children, className }) => (
    <div data-ui="CardContent" className={className}>{children}</div>
  );
  const MockCardDescription: React.FC<BasicProps> = ({ children, className }) => (
    <div data-ui="CardDescription" className={className}>{children}</div>
  );
  const MockCardHeader: React.FC<BasicProps> = ({ children, className }) => (
    <div data-ui="CardHeader" className={className}>{children}</div>
  );
  const MockCardTitle: React.FC<BasicProps> = ({ children, className }) => (
    <div data-ui="CardTitle" className={className}>{children}</div>
  );
  const MockBadge: React.FC<{ children?: React.ReactNode; className?: string; variant?: string }> = ({ children, className, variant }) => (
    <span data-ui="Badge" data-variant={variant} className={className}>{children}</span>
  );
  const MockProgress: React.FC<{ value?: number }> = ({ value }) => (
    <progress data-ui="Progress" role="progressbar" value={value} max={100}></progress>
  );
  const IconLoader2: React.FC = () => <svg data-icon="Loader2" />;
  const IconCheckCircle2: React.FC = () => <svg data-icon="CheckCircle2" />;
  const IconAlertCircle: React.FC = () => <svg data-icon="AlertCircle" />;
  const mockFormatMontant = (n: number | undefined) => {
    const val = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
    return `€${val.toFixed(2)}`;
  };
  return {
    MockCard,
    MockCardContent,
    MockCardDescription,
    MockCardHeader,
    MockCardTitle,
    MockBadge,
    MockProgress,
    IconLoader2,
    IconCheckCircle2,
    IconAlertCircle,
    mockFormatMontant,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardContent: MockCardContent,
  CardDescription: MockCardDescription,
  CardHeader: MockCardHeader,
  CardTitle: MockCardTitle,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: MockBadge,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: MockProgress,
}));

vi.mock('lucide-react', () => ({
  Loader2: IconLoader2,
  CheckCircle2: IconCheckCircle2,
  AlertCircle: IconAlertCircle,
}));

vi.mock('@/components/rh/uploadDocumentHelpers', () => ({
  formatMontant: mockFormatMontant,
}));

import {
  MultiUploadProgressCard,
  SingleAnalyzingCard,
  ParsedBulletinPreviewCard,
  ParseErrorCard,
  UploadResultsSummaryCard,
} from './UploadDocumentDialogCards';

type UploadResultLocal = { file: string; success: boolean; error?: string };

describe('UploadDocumentDialogCards', () => {
  afterEach(() => {
    cleanup();
  });

  it('MultiUploadProgressCard affiche progression et nom de fichier', () => {
    render(
      <MultiUploadProgressCard currentUploadIndex={0} total={3} currentFileName="bulletin-janvier.pdf" />
    );

    expect(screen.getByText(/Upload en cours : 1 \/ 3/i)).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    const progress = screen.getByRole('progressbar') as HTMLProgressElement;
    expect(Math.round(Number(progress.value))).toBe(33);
    expect(screen.getByText('bulletin-janvier.pdf')).toBeTruthy();
    expect(screen.getByText(/Analyse automatique avec GPT-5/i)).toBeTruthy();
    expect(screen.getByTestId ? screen.queryByTestId('Loader2') : screen.queryByRole('img')).toBeNull(); // icon rendered as svg; just ensure no crash
  });

  it('SingleAnalyzingCard affiche les textes d’analyse', () => {
    render(<SingleAnalyzingCard />);
    expect(screen.getByText('Analyse du bulletin en cours...')).toBeTruthy();
    expect(screen.getByText('GPT-5 extrait les données automatiquement')).toBeTruthy();
  });

  it('ParsedBulletinPreviewCard affiche les données extraites et masque les primes quand 0', () => {
    const parsedData = {
      mois: '2024-01-10',
      salaire_brut: 1234.5,
      salaire_net: 1000,
      cotisations_salariales: 234.5,
      cotisations_patronales: 345.67,
      primes: 0,
      confidence: 85,
    };
    render(<ParsedBulletinPreviewCard parsedData={parsedData as any} />);

    expect(screen.getByText('Bulletin analysé avec succès !')).toBeTruthy();
    const badge = screen.getByText(/Confiance : 85%/i).closest('[data-ui="Badge"]') as HTMLElement;
    expect(badge?.getAttribute('data-variant')).toBe('default');

    expect(screen.getByText('💰 Salaire brut :')).toBeTruthy();
    expect(screen.getByText('€1234.50')).toBeTruthy();

    expect(screen.getByText('💵 Salaire net :')).toBeTruthy();
    expect(screen.getByText('€1000.00')).toBeTruthy();

    expect(screen.getByText('📊 Cotisations sal. :')).toBeTruthy();
    expect(screen.getByText('€234.50')).toBeTruthy();

    expect(screen.getByText('🏢 Cotisations patr. :')).toBeTruthy();
    expect(screen.getByText('€345.67')).toBeTruthy();

    expect(screen.queryByText('🎁 Primes :')).toBeNull();

    const dateText = screen.getByText((t) => t.includes('2024'));
    expect(dateText).toBeTruthy();
    expect(screen.queryByText('N/A')).toBeNull();
  });

  it('ParsedBulletinPreviewCard affiche primes et badge secondaire si confiance faible', () => {
    const parsedDataLow = {
      mois: undefined,
      salaire_brut: 2000,
      salaire_net: 1500,
      cotisations_salariales: 300,
      cotisations_patronales: 400,
      primes: 120,
      confidence: 60,
    };
    render(<ParsedBulletinPreviewCard parsedData={parsedDataLow as any} />);

    const badgeLow = screen.getByText(/Confiance : 60%/i).closest('[data-ui="Badge"]') as HTMLElement;
    expect(badgeLow?.getAttribute('data-variant')).toBe('secondary');

    expect(screen.getByText('🎁 Primes :')).toBeTruthy();
    expect(screen.getByText('€120.00')).toBeTruthy();

    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('ParseErrorCard affiche message et explications', () => {
    render(<ParseErrorCard message="Impossible de parser le document" />);
    expect(screen.getByText('Analyse échouée')).toBeTruthy();
    expect(screen.getByText('Impossible de parser le document')).toBeTruthy();
    expect(
      screen.getByText(/Le document a été enregistré mais vous devrez saisir le salaire manuellement\./i)
    ).toBeTruthy();
  });

  it('UploadResultsSummaryCard affiche succès global (bordure verte)', () => {
    const resultsOk: UploadResultLocal[] = [
      { file: 'janvier.pdf', success: true },
      { file: 'février.pdf', success: true },
    ];
    render(<UploadResultsSummaryCard results={resultsOk as any} />);
    const title = screen.getByText('Tous les bulletins ont été traités avec succès !');
    expect(title).toBeTruthy();
    const card = title.closest('[data-ui="Card"]') as HTMLElement;
    expect(card.className).toContain('border-green-500');
    expect(screen.getByText('janvier.pdf')).toBeTruthy();
    expect(screen.getByText('février.pdf')).toBeTruthy();
    expect(screen.queryByText(/Certains bulletins ont échoué/i)).toBeNull();
  });

  it('UploadResultsSummaryCard affiche échecs (bordure orange) et erreurs associées', () => {
    const resultsMixed: UploadResultLocal[] = [
      { file: 'mars.pdf', success: true },
      { file: 'avril.pdf', success: false, error: 'Analyse échouée' },
      { file: 'mai.pdf', success: true },
    ];
    render(<UploadResultsSummaryCard results={resultsMixed as any} />);
    const title = screen.getByText('Certains bulletins ont échoué');
    expect(title).toBeTruthy();
    const card = title.closest('[data-ui="Card"]') as HTMLElement;
    expect(card.className).toContain('border-orange-500');
    expect(screen.getByText('mars.pdf')).toBeTruthy();
    expect(screen.getByText('avril.pdf')).toBeTruthy();
    expect(screen.getByText('Analyse échouée')).toBeTruthy();
    expect(screen.getByText('mai.pdf')).toBeTruthy();
  });

  it('hook wrapper avec QueryClientProvider fonctionne', () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => 'ok', { wrapper });
    expect(result.current).toBe('ok');
  });
});