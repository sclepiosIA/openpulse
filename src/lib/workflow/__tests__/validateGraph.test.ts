import { describe, it, expect } from 'vitest'
import { validateWorkflowGraph, getIssuesForNode } from '../validateGraph'
import type { Node, Edge } from '@xyflow/react'

const trigger = (id = 't1'): Node => ({ id, type: 'trigger', position: { x: 0, y: 0 }, data: {} })
const action = (id: string, action_type?: string, config: Record<string, unknown> = {}): Node => ({
  id, type: 'action', position: { x: 0, y: 0 }, data: { action_type, config },
})
const condition = (id: string, cfg: Record<string, unknown> = {}): Node => ({
  id, type: 'condition', position: { x: 0, y: 0 }, data: { config: cfg },
})
const delay = (id: string, amount?: number): Node => ({
  id, type: 'delay', position: { x: 0, y: 0 }, data: { config: { amount } },
})
const edge = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t })

describe('validateWorkflowGraph', () => {
  it('flags multiple triggers', () => {
    const issues = validateWorkflowGraph([trigger('t1'), trigger('t2')], [])
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].node_id).toBe('t2')
  })

  it('flags orphan nodes', () => {
    const a = action('a1', 'create_task', { titre: 'x' })
    const issues = validateWorkflowGraph([trigger(), a], [])
    expect(issues.some(i => i.node_id === 'a1' && i.message.includes('non connecté'))).toBe(true)
  })

  it('connected actions are not orphan', () => {
    const a = action('a1', 'create_task', { titre: 'x' })
    const issues = validateWorkflowGraph([trigger(), a], [edge('t1', 'a1')])
    expect(issues.filter(i => i.message.includes('non connecté'))).toHaveLength(0)
  })

  it('flags action without action_type', () => {
    const a = action('a1')
    const issues = validateWorkflowGraph([trigger(), a], [edge('t1', 'a1')])
    expect(issues.some(i => i.message.includes('Type d\'action'))).toBe(true)
  })

  it('flags missing required fields', () => {
    const a = action('a1', 'send_email', { to: 'a@b' })
    const issues = validateWorkflowGraph([trigger(), a], [edge('t1', 'a1')])
    expect(issues.some(i => i.message.includes('subject'))).toBe(true)
  })

  it('no missing field issue when complete', () => {
    const a = action('a1', 'send_email', { to: 'a@b', subject: 'hi' })
    const issues = validateWorkflowGraph([trigger(), a], [edge('t1', 'a1')])
    expect(issues.filter(i => i.message.includes('Configuration incomplète'))).toHaveLength(0)
  })

  it('flags condition without field/operator', () => {
    const c = condition('c1', {})
    const issues = validateWorkflowGraph([trigger(), c], [edge('t1', 'c1')])
    expect(issues.some(i => i.message.includes('Condition incomplète'))).toBe(true)
  })

  it('accepts complete condition', () => {
    const c = condition('c1', { field: 'x', operator: 'eq' })
    const issues = validateWorkflowGraph([trigger(), c], [edge('t1', 'c1')])
    expect(issues.filter(i => i.node_id === 'c1')).toHaveLength(0)
  })

  it('flags delay without amount', () => {
    const d = delay('d1', 0)
    const issues = validateWorkflowGraph([trigger(), d], [edge('t1', 'd1')])
    expect(issues.some(i => i.message.includes('Délai'))).toBe(true)
  })

  it('accepts delay with amount', () => {
    const d = delay('d1', 5)
    const issues = validateWorkflowGraph([trigger(), d], [edge('t1', 'd1')])
    expect(issues.filter(i => i.node_id === 'd1')).toHaveLength(0)
  })

  it('getIssuesForNode filters by id', () => {
    const issues = [
      { node_id: 'a', severity: 'error' as const, message: 'm' },
      { node_id: 'b', severity: 'warning' as const, message: 'n' },
    ]
    expect(getIssuesForNode(issues, 'a')).toHaveLength(1)
    expect(getIssuesForNode(issues, 'z')).toHaveLength(0)
  })

  it('no triggers => no error attached to a node', () => {
    const a = action('a1', 'create_task', { titre: 'x' })
    const issues = validateWorkflowGraph([a], [])
    // no specific error about triggers
    expect(issues.every(i => !i.message.toLowerCase().includes('déclencheur') || i.severity === 'warning')).toBe(true)
  })
})
