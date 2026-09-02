import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactElement } from 'react'

// Mocks for internal dependencies (stable hoisted values)
const { ROWS, mockFrom } = vi.hoisted(() => {
  const ROWS = [{ id: '1', nom: 'Test ETB' }]
  const mockFrom = vi.fn(() => ({
    // chainable, thenable builder mock
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                then: (cb: (arg: any) => void) => cb({ data: ROWS }),
              })),
            })),
          })),
        })),
      })),
    })),
    single: vi.fn(() => Promise.resolve({ data: ROWS[0] })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: ROWS[0] })),
  }))
  return { ROWS, mockFrom }
})

// Supabase client mock (builder chainable)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom }
}))

// Mock hooks / contexts that may be imported by the module
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  })),
}))

// Mocks for internal UI components to keep DOM light
vi.mock('@/components/ui/button', () => ({
  Button: (props: any) =>
    React.createElement('button', { onClick: props.onClick }, props.children ?? 'Button'),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: any) => React.createElement('span', props, props.children ?? 'Badge'),
}))

vi.mock('@/components/pipeline/KanbanBoard', () => ({
  KanbanBoard: () => React.createElement('div', {}, 'KanbanBoard'),
}))

vi.mock('@/components/etablissement/EtablissementInfo', () => ({
  EtablissementInfo: (props: any) =>
    React.createElement('div', {}, 'EtablissementInfoMock'),
}))

vi.mock('@/components/etablissement/EtablissementTasks', () => ({
  EtablissementTasks: (props: any) => React.createElement('div', {}, 'EtablissementTasksMock'),
}))

vi.mock('@/components/etablissement/EtablissementContacts', () => ({
  EtablissementContacts: (props: any) => React.createElement('div', {}, 'EtablissementContactsMock'),
}))

vi.mock('@/components/etablissement/EtablissementTeam', () => ({
  EtablissementTeam: (props: any) => React.createElement('div', {}, 'EtablissementTeamMock'),
}))

vi.mock('@/components/etablissement/EtablissementDocuments', () => ({
  EtablissementDocuments: (props: any) => React.createElement('div', {}, 'EtablissementDocumentsMock'),
}))

vi.mock('@/components/etablissement/EtablissementGantt', () => ({
  EtablissementGantt: (props: any) => React.createElement('div', {}, 'EtablissementGanttMock'),
}))

vi.mock('@/components/calendrier/CalendarAgendaView', () => ({
  CalendarAgendaView: (props: any) => React.createElement('div', {}, 'CalendarAgendaViewMock'),
}))

vi.mock('@/components/etablissement/EtablissementEmailsTab', () => ({
  EtablissementEmailsTab: (props: any) => React.createElement('div', {}, 'EtablissementEmailsTabMock'),
}))

vi.mock('@/components/portail-client/EtablissementPortalTab', () => ({
  EtablissementPortalTab: (props: any) => React.createElement('div', {}, 'EtablissementPortalTabMock'),
}))

vi.mock('@/components/etablissement/CustomerActivitiesTimelineV2', () => ({
  CustomerActivitiesTimelineV2: (props: any) => React.createElement('div', {}, 'CustomerActivitiesTimelineV2Mock'),
}))

vi.mock('@/components/etablissement/CommunicationAISynthesis', () => ({
  CommunicationAISynthesis: (props: any) =>
    React.createElement('div', {}, 'CommunicationAISynthesisMock'),
}))

vi.mock('@/components/cti/CallHistoryTab', () => ({
  CallHistoryTab: (props: any) => React.createElement('div', {}, 'CallHistoryTabMock'),
}))

vi.mock('@/components/scoring/BehavioralScoreCard', () => ({
  BehavioralScoreCard: (props: any) => React.createElement('div', {}, 'BehavioralScoreCardMock'),
}))

vi.mock('@/components/scoring/BehavioralEventsTimeline', () => ({
  BehavioralEventsTimeline: (props: any) => React.createElement('div', {}, 'BehavioralEventsTimelineMock'),
}))

vi.mock('@/components/scoring/ScoreEvolutionChart', () => ({
  ScoreEvolutionChart: (props: any) => React.createElement('div', {}, 'ScoreEvolutionChartMock'),
}))

vi.mock('@/components/scoring/AttributionFunnel', () => ({
  AttributionFunnel: (props: any) => React.createElement('div', {}, 'AttributionFunnelMock'),
}))

vi.mock('@/components/etablissement/StatsIframeViewer', () => ({
  StatsIframeViewer: (props: any) => React.createElement('div', {}, 'StatsIframeViewerMock'),
}))

vi.mock('./EtablissementCsmTabs', () => ({
  EtablissementCsmTabs: (props: any) => React.createElement('div', {}, 'EtablissementCsmTabsMock'),
}))

// Import the component under test
import { EtablissementDetailTabContent } from './EtablissementDetailTabContent'

describe('EtablissementDetailTabContent', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders the infos tab with title and Modifier button', () => {
    const etablissement = {
      statut: 'Production',
      nom: 'Test ETB',
      commercial: [],
      chef_projet: [],
      csm: [],
      stats_utilisation_url: '',
      stats_urgences_url: '',
    }

    const onEditOpen = vi.fn()

    const element: ReactElement = (
      <EtablissementDetailTabContent
        activeTab="infos"
        uiActiveTab="infos"
        etablissement={etablissement}
        id="etab-1"
        phaseFilter={null}
        taches={undefined}
        onTaskClick={vi.fn()}
        onEditOpen={onEditOpen}
      />
    )

    render(element)

    expect(screen.getByText("Informations de l'établissement")).toBeInTheDocument()
    expect(screen.getByText('Modifier')).toBeInTheDocument()
  })

  it('renders the contacts tab placeholder', () => {
    const etablissement = {
      statut: 'Production',
      nom: 'Test ETB',
      commercial: [],
      chef_projet: [],
      csm: [],
      stats_utilisation_url: '',
      stats_urgences_url: '',
    }

    const element: ReactElement = (
      <EtablissementDetailTabContent
        activeTab="contacts"
        uiActiveTab="contacts"
        etablissement={etablissement}
        id="etab-2"
        phaseFilter={null}
        taches={undefined}
        onTaskClick={vi.fn()}
        onEditOpen={vi.fn()}
      />
    )

    render(element)

    expect(screen.getByText('EtablissementContactsMock')).toBeInTheDocument()
  })

  it('returns null for unknown tab', () => {
    const etablissement = {
      statut: 'Production',
      nom: 'Test ETB',
      commercial: [],
      chef_projet: [],
      csm: [],
      stats_utilisation_url: '',
      stats_urgences_url: '',
    }

    const element: ReactElement = (
      <EtablissementDetailTabContent
        activeTab="unknown"
        uiActiveTab="unknown"
        etablissement={etablissement}
        id="etab-3"
        phaseFilter={null}
        taches={undefined}
        onTaskClick={vi.fn()}
        onEditOpen={vi.fn()}
      />
    )

    const { container } = render(element)
    // when default => null, container should be empty
    expect(container).toBeEmptyDOMElement()
  })
})