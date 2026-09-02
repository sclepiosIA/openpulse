import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

const { getScenario, setScenario, propsLog } = (vi.hoisted(() => {
  type ContainerProps = { etablissementId: string }
  type Scenario = { type: 'loading' } | { type: 'success'; label: string } | { type: 'error'; message: string }

  let scenario: Scenario = { type: 'loading' }
  const setScenario = (s: Scenario) => { scenario = s }
  const getScenario = () => scenario

  const propsLog: { last: ContainerProps | null } = { last: null }

  return { getScenario, setScenario, propsLog }
}) as {
  getScenario: () => { type: 'loading' } | { type: 'success'; label: string } | { type: 'error'; message: string }
  setScenario: (s: { type: 'loading' } | { type: 'success'; label: string } | { type: 'error'; message: string }) => void
  propsLog: { last: { etablissementId: string } | null }
})

vi.mock('@/components/etablissement-gantt/EtablissementGanttContainer', () => {
  return {
    EtablissementGanttContainer: (props: { etablissementId: string }) => {
      propsLog.last = props
      const s = getScenario()
      if (s.type === 'loading') {
        return React.createElement('div', { 'data-testid': 'gantt-loading' }, 'Chargement en cours')
      }
      if (s.type === 'success') {
        return React.createElement('div', { 'data-testid': 'gantt-success' }, `Gantt:${props.etablissementId}:${s.label}`)
      }
      return React.createElement('div', { 'data-testid': 'gantt-error' }, s.message)
    },
  }
})

import { EtablissementGantt } from './EtablissementGantt'

describe('EtablissementGantt', () => {
  it('affiche l’état de chargement via le container mocké', () => {
    setScenario({ type: 'loading' })
    render(<EtablissementGantt etablissementId="etab-1" />)
    expect(screen.getByTestId('gantt-loading')).toBeInTheDocument()
    expect(propsLog.last).not.toBeNull()
    expect(propsLog.last?.etablissementId).toBe('etab-1')
  })

  it('affiche le succès et transmet correctement etablissementId', () => {
    setScenario({ type: 'success', label: 'OK' })
    render(<EtablissementGantt etablissementId="etab-42" />)
    const el = screen.getByTestId('gantt-success')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('Gantt:etab-42:OK')
    expect(propsLog.last).not.toBeNull()
    expect(propsLog.last?.etablissementId).toBe('etab-42')
  })

  it('affiche l’erreur quand le container renvoie une erreur', () => {
    setScenario({ type: 'error', message: 'Chargement impossible' })
    render(<EtablissementGantt etablissementId="etab-err" />)
    const el = screen.getByTestId('gantt-error')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('Chargement impossible')
  })
})