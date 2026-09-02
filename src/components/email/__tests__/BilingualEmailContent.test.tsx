import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BilingualEmailContent } from '../BilingualEmailContent';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock('../EmailContentWithImages', () => ({
  EmailContentWithImages: ({ textContent, htmlContent }: any) => (
    <div data-testid="email-content">{textContent || htmlContent || 'empty'}</div>
  ),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const w = (ui: React.ReactElement) => render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('BilingualEmailContent', () => {
  it('renders original content when no translation', () => {
    w(<BilingualEmailContent originalText="Hello world" messageId="m1" />);
    expect(screen.getByTestId('email-content')).toBeInTheDocument();
  });

  it('shows language badge when detected', () => {
    w(<BilingualEmailContent originalText="Hello" detectedLanguage="en" messageId="m1" />);
    expect(screen.getByText('🇬🇧')).toBeInTheDocument();
    expect(screen.getByText('English détecté')).toBeInTheDocument();
  });

  it('shows translate button for non-French language without translation', () => {
    w(<BilingualEmailContent originalText="Hello" detectedLanguage="en" messageId="m1" />);
    expect(screen.getByText('Traduire en français')).toBeInTheDocument();
  });

  it('does not show translate button for French', () => {
    w(<BilingualEmailContent originalText="Bonjour" detectedLanguage="fr" messageId="m1" />);
    expect(screen.queryByText('Traduire en français')).not.toBeInTheDocument();
  });

  it('renders side-by-side view when translation provided', () => {
    w(<BilingualEmailContent originalText="Hello" translationText="Bonjour" detectedLanguage="en" messageId="m1" />);
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('🇫🇷 Français')).toBeInTheDocument();
    expect(screen.getByText('Côte à côte')).toBeInTheDocument();
  });

  it('renders unknown language with globe', () => {
    w(<BilingualEmailContent originalText="Test" detectedLanguage="sw" messageId="m1" />);
    expect(screen.getByText('🌐')).toBeInTheDocument();
    expect(screen.getByText('SW détecté')).toBeInTheDocument();
  });
});
