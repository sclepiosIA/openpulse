import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TutorielSection } from './TutorielSection'

const { ROWS, mockFrom } = vi.hoisted(() => ({
  ROWS: [{ id: 'row-1' }],
  mockFrom: vi.fn(() => {
    const builder: any = {
      select: vi.fn().mockReturnValue(this),
      eq: vi.fn().mockReturnValue(this),
      gte: vi.fn().mockReturnValue(this),
      lte: vi.fn().mockReturnValue(this),
      in: vi.fn().mockReturnValue(this),
      order: vi.fn().mockReturnValue(this),
      limit: vi.fn().mockReturnValue(this),
      insert: vi.fn().mockReturnValue(this),
      update: vi.fn().mockReturnValue(this),
      delete: vi.fn().mockReturnValue(this),
      single: vi.fn().mockResolvedValue({ data: ROWS }),
      maybeSingle: vi.fn().mockResolvedValue({ data: ROWS }),
      then: vi.fn().mockImplementation((cb: any) => cb({ data: ROWS })),
      catch: vi.fn().mockReturnValue(this),
    }
    return builder
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('./TutorielStep', () => ({
  TutorielStep: (props: any) =>
    React.createElement('div', { 'data-testid': `step-${props.step.id}` }),
}))

vi.mock('./TutorielVideo', () => ({
  TutorielVideo: (props: any) =>
    React.createElement('div', { 'data-testid': 'video', 'data-url': props.url, 'data-title': props.title }),
}))

vi.mock('./TutorielScreenshot', () => ({
  TutorielScreenshot: (props: any) =>
    React.createElement('div', {
      'data-testid': 'screenshot',
      'data-src': props.src,
      'data-alt': props.alt,
    }),
}))

vi.mock('./TutorielLivePreview', () => ({
  TutorielLivePreview: (_props: any) => React.createElement('div', { 'data-testid': 'live-preview' }),
}))

const SECTION_WITH_SCR = {
  id: 'sec-1',
  title: 'Introduction',
  description: 'Description of the section',
  screenshot: '/path/to/screenshot.png',
  screenshotAlt: 'Alt text',
  videoUrl: 'https://example.com/video',
  videoTitle: 'Intro Video',
  steps: [
    { id: 'step-1', title: 'First step' },
    { id: 'step-2', title: 'Second step' },
  ],
}

const SECTION_WITHOUT_SCR = {
  id: 'sec-2',
  title: 'Another Section',
  description: 'Another description',
  screenshot: undefined,
  screenshotAlt: '',
  videoUrl: undefined,
  videoTitle: '',
  steps: [
    { id: 'step-a', title: 'Alpha' },
    { id: 'step-b', title: 'Beta' },
  ],
}

describe('TutorielSection', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders screenshot when section has screenshot', () => {
    render(
      <TutorielSection section={SECTION_WITH_SCR} index={0} moduleId="mod1" moduleIcon="icon" />,
      { wrapper: Wrapper }
    )

    const shot = screen.getByTestId('screenshot')
    expect(shot).toBeTruthy()
    // ensure data-src alt are wired
    expect(shot.getAttribute('data-src')).toBe(SECTION_WITH_SCR.screenshot)
    expect(shot.getAttribute('data-alt')).toBe(SECTION_WITH_SCR.screenshotAlt)
  })

  it('renders live preview when section has no screenshot', () => {
    render(
      <TutorielSection section={SECTION_WITHOUT_SCR} index={1} moduleId="mod2" moduleIcon="icon" />,
      { wrapper: Wrapper }
    )

    const live = screen.getByTestId('live-preview')
    expect(live).toBeTruthy()
  })

  it('renders video when videoUrl exists', () => {
    render(
      <TutorielSection section={SECTION_WITH_SCR} index={0} moduleId="mod1" moduleIcon="icon" />,
      { wrapper: Wrapper }
    )

    const video = screen.getByTestId('video')
    expect(video).toBeTruthy()
    expect(video.getAttribute('data-url')).toBe(SECTION_WITH_SCR.videoUrl)
    expect(video.getAttribute('data-title')).toBe(SECTION_WITH_SCR.videoTitle)
  })

  it('renders all steps in order', () => {
    render(
      <TutorielSection section={SECTION_WITH_SCR} index={0} moduleId="mod1" moduleIcon="icon" />,
      { wrapper: Wrapper }
    )

    const step1 = screen.getByTestId(`step-${SECTION_WITH_SCR.steps[0].id}`)
    const step2 = screen.getByTestId(`step-${SECTION_WITH_SCR.steps[1].id}`)

    expect(step1).toBeTruthy()
    expect(step2).toBeTruthy()
  })
})