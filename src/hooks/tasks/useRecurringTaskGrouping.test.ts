/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { groupRecurringTasks, useRecurringTaskGrouping } from './useRecurringTaskGrouping'

const { TASKS_BASE, TASKS_WITH_NULL_RULE, UNRELATED_TASKS } = vi.hoisted(() => {
  const TASKS_BASE = [
    {
      id: 't-parent-1',
      title: 'Parent recurring',
      recurrence_rule: 'FREQ=WEEKLY',
      date_debut: '2025-01-10T00:00:00.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 't-occ-1',
      _isRecurrenceOccurrence: true,
      _parentTaskId: 't-parent-1',
      title: 'Occurrence 1',
      date_debut: '2025-01-17T00:00:00.000Z',
      created_at: '2025-01-02T00:00:00.000Z',
    },
    {
      id: 't-occ-2',
      _isRecurrenceOccurrence: true,
      _parentTaskId: 't-parent-1',
      title: 'Occurrence 2',
      date_debut: '2025-01-12T00:00:00.000Z',
      created_at: '2025-01-03T00:00:00.000Z',
    },
    {
      id: 't-single-1',
      title: 'Non recurring',
      date_debut: '2025-02-01T00:00:00.000Z',
      created_at: '2025-01-04T00:00:00.000Z',
    },
    {
      id: 't-occ-orphan',
      _isRecurrenceOccurrence: true,
      _parentTaskId: 't-missing-parent',
      title: 'Orphan occurrence',
      date_debut: '2025-03-01T00:00:00.000Z',
      created_at: '2025-01-05T00:00:00.000Z',
    },
  ] as const

  const TASKS_WITH_NULL_RULE = [
    {
      id: 't-x',
      title: 'Task',
      date_debut: '2025-01-01T00:00:00.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      recurrence_rule: null,
    },
  ] as const

  const UNRELATED_TASKS = [
    { id: 't-a', title: 'A', created_at: '2025-01-10T00:00:00.000Z' },
    { id: 't-b', title: 'B', created_at: '2025-01-11T00:00:00.000Z' },
  ] as const

  return { TASKS_BASE, TASKS_WITH_NULL_RULE, UNRELATED_TASKS }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const client = createQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return Wrapper
}

describe('groupRecurringTasks', () => {
  it('groups occurrences with their recurring parent, sorts occurrences by date_debut/created_at, filters orphan occurrences', () => {
    const result = groupRecurringTasks([...TASKS_BASE])

    expect(result).toHaveLength(2)

    const recurringGroup = result.find((g) => g.parentTask && g.parentTask.id === 't-parent-1')
    const singleGroup = result.find((g) => g.parentTask && g.parentTask.id === 't-single-1')

    expect(recurringGroup).toBeTruthy()
    expect(singleGroup).toBeTruthy()

    if (!recurringGroup || !singleGroup) throw new Error('Expected groups missing')

    expect(recurringGroup.isRecurring).toBe(true)
    expect(recurringGroup.parentTask.title).toBe('Parent recurring')
    expect(recurringGroup.occurrences.map((t) => t.id)).toEqual(['t-parent-1', 't-occ-2', 't-occ-1'])

    expect(singleGroup.isRecurring).toBe(false)
    expect(singleGroup.occurrences).toHaveLength(1)
    expect(singleGroup.occurrences[0].id).toBe('t-single-1')

    const allIds = result.flatMap((g) => g.occurrences.map((t) => t.id))
    expect(allIds.includes('t-occ-orphan')).toBe(false)
  })

  it('handles recurring task arriving after occurrences by setting parentTask and ensuring it is kept', () => {
    const tasks = [
      {
        id: 'o1',
        _isRecurrenceOccurrence: true,
        _parentTaskId: 'p1',
        date_debut: '2025-01-02T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'o2',
        _isRecurrenceOccurrence: true,
        _parentTaskId: 'p1',
        date_debut: '2025-01-03T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'p1',
        recurrence_rule: 'FREQ=DAILY',
        date_debut: '2025-01-01T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
      },
    ]

    const result = groupRecurringTasks(tasks)
    expect(result).toHaveLength(1)
    expect(result[0].isRecurring).toBe(true)
    expect(result[0].parentTask.id).toBe('p1')
    expect(result[0].occurrences.map((t) => t.id)).toEqual(['p1', 'o1', 'o2'])
  })
})

describe('useRecurringTaskGrouping', () => {
  it('loading -> success: returns empty array when tasks are initially empty then groups tasks after rerender', () => {
    const wrapper = createWrapper()

    const { result, rerender } = renderHook(({ tasks }: { tasks: unknown[] }) => useRecurringTaskGrouping(tasks), {
      wrapper,
      initialProps: { tasks: [] },
    })

    expect(result.current).toEqual([])

    rerender({ tasks: [...TASKS_BASE] })
    expect(result.current).toHaveLength(2)

    const recurringGroup = result.current.find((g) => g.parentTask && g.parentTask.id === 't-parent-1')
    expect(recurringGroup).toBeTruthy()
    if (!recurringGroup) throw new Error('Expected recurringGroup')
    expect(recurringGroup.isRecurring).toBe(true)
    expect(recurringGroup.occurrences.map((t) => t.id)).toEqual(['t-parent-1', 't-occ-2', 't-occ-1'])
  })

  it('error path: throws when tasks is not iterable (invalid upstream data)', () => {
    const wrapper = createWrapper()

    expect(() => {
      renderHook(() => useRecurringTaskGrouping((null as unknown) as unknown[]), { wrapper })
    }).toThrow()
  })

  it('returns non-recurring groups for unrelated tasks', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRecurringTaskGrouping([...UNRELATED_TASKS]), { wrapper })

    expect(result.current).toHaveLength(2)

    const ids = result.current.map((g) => g.parentTask.id).sort()
    expect(ids).toEqual(['t-a', 't-b'])

    for (const g of result.current) {
      expect(g.isRecurring).toBe(false)
      expect(g.occurrences).toHaveLength(1)
      expect(g.occurrences[0].id).toBe(g.parentTask.id)
    }
  })

  it('treats tasks with recurrence_rule null as non-recurring', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRecurringTaskGrouping([...TASKS_WITH_NULL_RULE]), { wrapper })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].isRecurring).toBe(false)
    expect(result.current[0].parentTask.id).toBe('t-x')
  })
})