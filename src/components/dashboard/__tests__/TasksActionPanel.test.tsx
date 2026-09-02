import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TasksActionPanel } from '../TasksActionPanel'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const urgentTasks = [
  {
    id: 't1',
    titre: 'Tâche urgente 1',
    statut: 'en_cours',
    echeance: '2026-03-10',
    etablissement: { nom: 'CHU Lyon' },
  },
]

const myTasks = [
  {
    id: 't2',
    titre: 'Ma tâche',
    statut: 'a_faire',
    echeance: '2026-03-15',
    etablissement: { nom: 'CHU Bordeaux' },
  },
]

async function clickTab(name: RegExp) {
  const tablist = screen.getByRole('tablist')
  const tab = within(tablist)
    .getAllByRole('tab')
    .find((t) => name.test(t.textContent ?? ''))
  if (!tab) throw new Error(`Tab matching ${name} not found`)
  await userEvent.click(tab)
}

describe('TasksActionPanel', () => {
  it('renders urgent tasks', () => {
    wrap(
      <TasksActionPanel
        urgentTasks={urgentTasks}
        myTasks={myTasks}
        allTasks={[...urgentTasks, ...myTasks]}
        myTasksProgress={50}
        globalProgress={60}
      />
    )
    expect(screen.getByText('Tâche urgente 1')).toBeInTheDocument()
  })

  it('renders progress indicators', async () => {
    wrap(
      <TasksActionPanel
        urgentTasks={[]}
        myTasks={[]}
        allTasks={[]}
        myTasksProgress={75}
        globalProgress={60}
      />
    )
    // Le progress 75% est dans l'onglet "Mes tâches" — on l'active
    await clickTab(/Mes tâches/i)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('renders empty state when no tasks', async () => {
    wrap(
      <TasksActionPanel
        urgentTasks={[]}
        myTasks={[]}
        allTasks={[]}
        myTasksProgress={0}
        globalProgress={0}
      />
    )
    // L'état vide de l'onglet "Toutes" contient "Aucune tâche"
    await clickTab(/Toutes/i)
    expect(screen.getByText(/Aucune tâche/i)).toBeInTheDocument()
  })

  it('renders etablissement name for tasks', () => {
    wrap(
      <TasksActionPanel
        urgentTasks={urgentTasks}
        myTasks={[]}
        allTasks={urgentTasks}
        myTasksProgress={0}
        globalProgress={0}
      />
    )
    // L'onglet "Urgentes" est actif par défaut, le nom établissement y est visible
    // Le <p> contient "CHU Lyon • il y a X" => chercher avec regex
    expect(screen.getByText(/CHU Lyon/)).toBeInTheDocument()
  })
})
