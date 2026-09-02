import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { EnrichedProductionCard } from './EnrichedProductionCard';

const {
  navigateMock,
  calculateMock,
  formatCurrencyMock,
  formatDateFrMock,
  getMonthsInProductionMock,
  getRenewalInfoMock,
  sanitizeEmailSubjectMock,
  formatDistanceToNowMock,
  onSelectionChangeMock
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  calculateMock: vi.fn(() => 12345),
  formatCurrencyMock: vi.fn((v: number) => `€${v.toLocaleString('fr-FR')}`),
  formatDateFrMock: vi.fn((d: string) => `formatted:${String(d)}`),
  getMonthsInProductionMock: vi.fn(() => 12),
  getRenewalInfoMock: vi.fn(() => null),
  sanitizeEmailSubjectMock: vi.fn((s: string) => `sanitized:${s}`),
  formatDistanceToNowMock: vi.fn(() => 'il y a 1 jour'),
  onSelectionChangeMock: vi.fn()
}));

// React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock
}));

// UI primitives
vi.mock('@/components/ui/card', () => {
  return {
    Card: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('div', { ...rest, 'data-testid': 'card' }, children);
    },
    CardContent: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('div', { ...rest, 'data-testid': 'card-content' }, children);
    }
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => {
    const { children, ...rest } = props;
    return React.createElement('button', { ...rest, 'data-testid': 'button' }, children);
  }
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: any) => {
    const { checked = false, onCheckedChange, className } = props;
    return React.createElement(
      'button',
      {
        'data-testid': 'mock-checkbox',
        className,
        onClick: () => {
          const next = !checked;
          onCheckedChange?.(next);
        },
        'aria-checked': !!checked
      },
      checked ? 'checked' : 'unchecked'
    );
  }
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: any) => React.createElement('div', { 'data-testid': 'dropdown-menu' }, props.children),
  DropdownMenuContent: (props: any) => React.createElement('div', { 'data-testid': 'dropdown-content' }, props.children),
  DropdownMenuItem: (props: any) => React.createElement('div', { role: 'menuitem', ...props }, props.children),
  DropdownMenuTrigger: (props: any) => React.createElement('span', { 'data-testid': 'dropdown-trigger' }, props.children)
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: (props: any) => React.createElement(React.Fragment, null, props.children)
}));

// Icons
vi.mock('lucide-react', () => {
  const Icon = ({ 'data-name': name, ...p }: any) => React.createElement('span', { 'data-icon': name || 'icon', ...p }, null);
  return {
    MapPin: (p: any) => Icon({ ...p, 'data-name': 'MapPin' }),
    Calendar: (p: any) => Icon({ ...p, 'data-name': 'Calendar' }),
    MoreVertical: (p: any) => Icon({ ...p, 'data-name': 'MoreVertical' }),
    Users: (p: any) => Icon({ ...p, 'data-name': 'Users' }),
    AlertTriangle: (p: any) => Icon({ ...p, 'data-name': 'AlertTriangle' }),
    Mail: (p: any) => Icon({ ...p, 'data-name': 'Mail' }),
    Star: (p: any) => Icon({ ...p, 'data-name': 'Star' }),
    TrendingUp: (p: any) => Icon({ ...p, 'data-name': 'TrendingUp' }),
    TrendingDown: (p: any) => Icon({ ...p, 'data-name': 'TrendingDown' }),
    Minus: (p: any) => Icon({ ...p, 'data-name': 'Minus' })
  };
});

// Other internal components
vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: (props: any) =>
    React.createElement('div', { 'data-testid': 'entity-avatar' }, `avatar:${props.name || ''}`)
}));

vi.mock('@/components/csm/WeatherIcon', () => ({
  WeatherIcon: (props: any) => React.createElement('div', { 'data-testid': 'weather-icon' }, `weather:${props.weather || ''}`)
}));

// Utilities and libs used by the component
vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (...args: any[]) => {
    return calculateMock(...args);
  }
}));

vi.mock('@/lib/productionUtils', () => ({
  formatCurrency: (v: number) => formatCurrencyMock(v),
  formatDateFr: (d: string) => formatDateFrMock(d),
  getMonthsInProduction: (d: string) => getMonthsInProductionMock(d),
  getRenewalInfo: (d: string | undefined) => getRenewalInfoMock(d)
}));

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: (s: string) => sanitizeEmailSubjectMock(s)
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: (d: Date, opts: any) => formatDistanceToNowMock(d, opts),
  fr: {}
}));

describe('EnrichedProductionCard - smoke and interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculateMock.mockReturnValue(12345);
    formatCurrencyMock.mockImplementation((v: number) => `€${v.toLocaleString('fr-FR')}`);
    getMonthsInProductionMock.mockReturnValue(12);
    getRenewalInfoMock.mockReturnValue(null);
    formatDateFrMock.mockImplementation((d: string) => `formatted:${String(d)}`);
    sanitizeEmailSubjectMock.mockImplementation((s: string) => `sanitized:${s}`);
    formatDistanceToNowMock.mockReturnValue('il y a 1 jour');
  });

  const baseEtab = {
    id: 'etab-1',
    nom: 'Etablissement 1',
    type: 'Clinique',
    ville: 'Paris',
    region: 'Ile-de-France',
    date_go_live: '2022-01-01',
    logo_url: null
  } as any;

  it('renders key info and navigates on card click', async () => {
    render(React.createElement(EnrichedProductionCard, { etablissement: baseEtab }));

    // Name and type exist
    expect(screen.getByText('Etablissement 1')).toBeTruthy();
    expect(screen.getByText('Clinique')).toBeTruthy();

    // Months in production is computed via getMonthsInProductionMock
    expect(getMonthsInProductionMock).toHaveBeenCalledWith('2022-01-01');
    expect(screen.getByText('12 mois')).toBeTruthy();

    // Revenue calculation and formatting were invoked
    expect(calculateMock).toHaveBeenCalledWith(baseEtab);
    expect(formatCurrencyMock).toHaveBeenCalledWith(12345);

    // Card is clickable and navigates to the etablissement route on click
    const card = screen.getByRole('button', { name: /Ouvrir la fiche établissement Etablissement 1/i });
    expect(card).toBeTruthy();

    await act(async () => {
      fireEvent.click(card);
    });

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/etab-1');
  });

  it('renders santeData metrics and satisfaction, and checkbox triggers selection callback', async () => {
    const santeData = {
      taux_utilisation: 45,
      taux_utilisation_trend: 'up',
      taux_uhcd: 20,
      taux_uhcd_trend: 'down'
    } as any;

    render(
      React.createElement(EnrichedProductionCard, {
        etablissement: baseEtab,
        santeData,
        satisfaction: 87,
        isSelected: false,
        onSelectionChange: onSelectionChangeMock
      })
    );

    // Utilisation, UHCD and Satisfaction displayed as percentages
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByText('87%')).toBeTruthy();

    // Checkbox exists and clicking it should call onSelectionChange with id and true
    const checkbox = screen.getByTestId('mock-checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(onSelectionChangeMock).toHaveBeenCalledTimes(1);
    expect(onSelectionChangeMock).toHaveBeenCalledWith('etab-1', true);
  });

  it('shows last email when provided and clicking it navigates to email thread', async () => {
    const lastEmail = {
      id: 'msg-1',
      subject: 'Subject here',
      last_message_date: new Date().toISOString(),
      ai_generated_title: 'AI Title'
    };

    render(React.createElement(EnrichedProductionCard, { etablissement: baseEtab, lastEmail }));

    // sanitizeEmailSubject should be called and its result rendered
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('AI Title');
    expect(screen.getByText('sanitized:AI Title')).toBeTruthy();

    const emailText = screen.getByText('sanitized:AI Title');
    await act(async () => {
      fireEvent.click(emailText);
    });

    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=msg-1');
  });

  it('displays "Aucun email associé" when there is no lastEmail', () => {
    render(React.createElement(EnrichedProductionCard, { etablissement: baseEtab, lastEmail: undefined }));

    expect(screen.getByText(/Aucun email associé/i)).toBeTruthy();
  });

  it('renders urgent billing end date with J-x indicator and calls formatDateFr', () => {
    // billingEndDate two days from now to trigger urgent indicator
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const target = new Date(Date.now() + twoDaysMs).toISOString();

    render(React.createElement(EnrichedProductionCard, { etablissement: baseEtab, billingEndDate: target }));

    // Should show the billing label and call formatDateFr with the provided date
    expect(screen.getByText(/Fin période factu/i)).toBeTruthy();
    expect(formatDateFrMock).toHaveBeenCalledWith(target);

    // There should be an urgency indicator text like "J-2" or "Aujourd'hui" depending on timing;
    // ensure at least one of the expected patterns exists
    const found = screen.queryByText((content: string) => /J-\d+|Aujourd'hui/.test(content));
    expect(found).toBeTruthy();
  });
});