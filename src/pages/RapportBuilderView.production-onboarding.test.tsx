/**
 * P1 CRM fix guard — audit 2026-07-05 :
 *  L'aperçu du template « Production & Onboarding » ouvrait la fiche du bon
 *  rapport mais tous les widgets tombaient en échec car les sources
 *  (`clients_in_production`, `deployment_funnel`, `blocked_accounts`)
 *  n'existaient pas dans `REPORT_SOURCES`. Ce test verrouille :
 *   - qu'on charge le rapport de l'`id` demandé (pas un fallback),
 *   - que ses widgets pointent uniquement sur des sources supportées.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { REPORT_SOURCES } from '@/types/report';

const REQUESTED_ID = '1df54f64-44ec-497d-a4de-06301566d271';

const PROD_ONBOARDING_TEMPLATE = {
  id: REQUESTED_ID,
  nom: 'Production & Onboarding',
  description: 'Suivi déploiement + onboarding',
  is_template: true,
  filters_schema: {},
  layout: [
    { i: 'w1', x: 0, y: 0, w: 4, h: 2 },
    { i: 'w2', x: 4, y: 0, w: 8, h: 4 },
    { i: 'w3', x: 0, y: 4, w: 12, h: 4 },
  ],
  widgets: [
    { id: 'w1', type: 'kpi', title: 'Comptes en production', source: 'etablissements_by_csm', measure: 'count', format: 'number' },
    { id: 'w2', type: 'funnel', title: 'Funnel déploiement', source: 'conversion_funnel', dimension: 'etape', measure: 'count' },
    { id: 'w3', type: 'table', title: 'Tâches en retard', source: 'overdue_tasks', dimension: 'title', measure: 'due_date' },
  ],
} as const;

const { useCustomDashboardMock, useParamsMock, receivedIds } = vi.hoisted(() => ({
  useCustomDashboardMock: vi.fn(),
  useParamsMock: vi.fn(),
  receivedIds: [] as (string | undefined)[],
}));

vi.mock('react-router-dom', () => ({
  useParams: () => useParamsMock(),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/dashboard/useCustomDashboards', () => ({
  useCustomDashboard: (id?: string) => {
    receivedIds.push(id);
    return useCustomDashboardMock(id);
  },
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({ usePageTitle: vi.fn() }));

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return new Proxy({}, {
    get: (_target, prop) => (prop === 'then' ? undefined : Icon),
    has: (_target, prop) => prop !== 'then',
  });
});

vi.mock('@/components/ui/button', () => ({
  Button: (p: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={p.onClick}>{p.children}</button>
  ),
}));

vi.mock('@/components/rapports-builder/ReportGrid', () => ({
  ReportGrid: (props: { widgets: Array<{ id: string; title: string; source: string }> }) => (
    <ul data-testid="widgets">
      {props.widgets.map((w) => (
        <li key={w.id} data-source={w.source}>{w.title}</li>
      ))}
    </ul>
  ),
}));

vi.mock('@/components/rapports-builder/panels/GlobalFiltersBar', () => ({ GlobalFiltersBar: () => null }));
vi.mock('@/components/rapports-builder/ExportMenu', () => ({ ExportMenu: () => null }));
vi.mock('@/components/rapports-builder/ShareDialog', () => ({ ShareDialog: () => null }));
vi.mock('@/components/rapports-builder/ScheduleDialog', () => ({ ScheduleDialog: () => null }));
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: (p: React.PropsWithChildren<{ title?: string }>) => (
    <header><h1>{p.title}</h1>{p.children}</header>
  ),
}));
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => <div>SKELETON</div> }));
vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: (p: React.PropsWithChildren<{ isError?: boolean; error?: Error }>) =>
    p.isError ? <div data-testid="err">{p.error?.message}</div> : <>{p.children}</>,
}));
vi.mock('@/components/common/SectionErrorBoundary', () => ({
  SectionErrorBoundary: (p: React.PropsWithChildren<{}>) => <>{p.children}</>,
}));

import RapportBuilderView from './RapportBuilderView';

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0 } } })}>{ui}</QueryClientProvider>
);

describe('RapportBuilderView — Production & Onboarding (sandbox stable)', () => {
  beforeEach(() => {
    receivedIds.length = 0;
    useCustomDashboardMock.mockReset();
    useParamsMock.mockReset();
  });

  it('charge le rapport correspondant à l\'id de l\'URL (pas de fallback)', () => {
    useParamsMock.mockReturnValue({ id: REQUESTED_ID });
    useCustomDashboardMock.mockReturnValue({
      data: PROD_ONBOARDING_TEMPLATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(wrap(<RapportBuilderView />));

    expect(receivedIds).toContain(REQUESTED_ID);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Production & Onboarding');
  });

  it('affiche une erreur claire quand le rapport n\'existe pas (pas de fallback silencieux)', () => {
    useParamsMock.mockReturnValue({ id: REQUESTED_ID });
    useCustomDashboardMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(wrap(<RapportBuilderView />));
    expect(screen.getByTestId('err').textContent).toMatch(/introuvable/i);
  });

  it('tous les widgets pointent vers une source supportée (aucun widget en échec)', () => {
    useParamsMock.mockReturnValue({ id: REQUESTED_ID });
    useCustomDashboardMock.mockReturnValue({
      data: PROD_ONBOARDING_TEMPLATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(wrap(<RapportBuilderView />));

    const knownSources = new Set(REPORT_SOURCES.map((s) => s.key));
    const items = Array.from(document.querySelectorAll('[data-testid="widgets"] li'));
    expect(items.length).toBe(PROD_ONBOARDING_TEMPLATE.widgets.length);
    for (const li of items) {
      const src = li.getAttribute('data-source') ?? '';
      expect(knownSources.has(src as never), `source inconnue: ${src}`).toBe(true);
    }
  });
});
