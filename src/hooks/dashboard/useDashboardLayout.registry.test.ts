import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import * as registry from './useDashboardLayout.registry'

describe('useDashboardLayout.registry', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
  }

  it('expose un registre cohérent avec des widgets métier clés', () => {
    const { result } = renderHook(() => registry, {
      wrapper: createWrapper(),
    })

    const { WIDGET_REGISTRY } = result.current

    expect(WIDGET_REGISTRY.pipeline_stats.label).toBe('Pipeline')
    expect(WIDGET_REGISTRY.pipeline_stats.category).toBe('crm')
    expect(WIDGET_REGISTRY.revenue_chart.availableSizes).toEqual(['L'])
    expect(WIDGET_REGISTRY.revenue_chart.allowedSizes).toEqual(['L'])
    expect(WIDGET_REGISTRY.agenda_widget.configurable).toBe(true)
    expect(WIDGET_REGISTRY.notes.description).toContain('notes personnelles')
    expect(WIDGET_REGISTRY.jarvis_assistant.label).toBe('Jarvis')
    expect(WIDGET_REGISTRY.follow_up_relances.category).toBe('crm')
    expect(WIDGET_REGISTRY.hero_metrics.defaultSize).toBe('L')
  })

  it('expose des templates dashboard avec la composition attendue', () => {
    const { result } = renderHook(() => registry, {
      wrapper: createWrapper(),
    })

    const { DASHBOARD_TEMPLATES, WIDGET_REGISTRY } = result.current

    expect(DASHBOARD_TEMPLATES.compact.name).toBe('Compact')
    expect(DASHBOARD_TEMPLATES.compact.widgets).toEqual([
      'agenda_widget',
      'email_inbox_widget',
      'notes_widget',
    ])

    expect(DASHBOARD_TEMPLATES.strategic.widgets).toContain('mrr_dashboard')
    expect(DASHBOARD_TEMPLATES.strategic.widgets).toContain('ai_insights')
    expect(DASHBOARD_TEMPLATES.operational.widgets).toEqual([
      'tasks_panel',
      'agenda_widget',
      'pulse_widget',
      'email_inbox_widget',
    ])

    expect(DASHBOARD_TEMPLATES.complete.widgets.length).toBe(Object.keys(WIDGET_REGISTRY).length)
    expect(new Set(DASHBOARD_TEMPLATES.complete.widgets).size).toBe(
      DASHBOARD_TEMPLATES.complete.widgets.length
    )
    expect(DASHBOARD_TEMPLATES.complete.widgets).toContain('global_activity_feed')
    expect(DASHBOARD_TEMPLATES.complete.widgets).toContain('treasury_summary')
  })

  it('expose un layout par défaut utilisable et ordonné', () => {
    const { result } = renderHook(() => registry, {
      wrapper: createWrapper(),
    })

    const { DEFAULT_LAYOUT } = result.current

    expect(DEFAULT_LAYOUT.columns).toBe(2)
    expect(DEFAULT_LAYOUT.theme).toBe('comfortable')
    expect(DEFAULT_LAYOUT.widgets).toHaveLength(6)
    expect(DEFAULT_LAYOUT.widgets.map((w) => w.id)).toEqual([
      'tasks_panel',
      'email_intel',
      'agenda_widget',
      'pulse_widget',
      'email_inbox_widget',
      'notes_widget',
    ])
    expect(DEFAULT_LAYOUT.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(DEFAULT_LAYOUT.widgets.every((w) => w.visible)).toBe(true)
    expect(DEFAULT_LAYOUT.widgets[0].size).toBe('L')
    expect(DEFAULT_LAYOUT.widgets[2].size).toBe('S')
  })

  it('expose des layouts legacy avec des cas métier distincts', () => {
    const { result } = renderHook(() => registry, {
      wrapper: createWrapper(),
    })

    const { LAYOUT_TEMPLATES } = result.current

    expect(LAYOUT_TEMPLATES.commercial.columns).toBe(3)
    expect(LAYOUT_TEMPLATES.commercial.theme).toBe('comfortable')
    expect(LAYOUT_TEMPLATES.commercial.widgets.map((w) => w.id)).toContain('ai_insights')
    expect(LAYOUT_TEMPLATES.commercial.widgets[0]).toMatchObject({
      id: 'pipeline_stats',
      visible: true,
      order: 0,
      size: 'L',
    })

    expect(LAYOUT_TEMPLATES.operations.widgets.map((w) => w.id)).toEqual([
      'recent_tasks',
      'upcoming_events',
      'pending_actions',
      'support_tickets',
      'onboarding_progress',
      'email_summary',
    ])

    expect(LAYOUT_TEMPLATES.finance.widgets.map((w) => w.id)).toContain('treasury_summary')
    expect(LAYOUT_TEMPLATES.finance.widgets.map((w) => w.id)).toContain('alerts')
    expect(LAYOUT_TEMPLATES.finance.widgets.find((w) => w.id === 'alerts')).toMatchObject({
      size: 'S',
      visible: true,
    })
  })
})
