import { describe, expect, it } from 'vitest'
import { shouldNotifyTodo } from './useTodoDesktopNotifications'

describe('shouldNotifyTodo', () => {
  it('notifie uniquement une tâche assignée au profil par un tiers', () => {
    expect(shouldNotifyTodo({ assigned_to: 'me', user_id: 'other' }, 'me')).toBe(true)
    expect(shouldNotifyTodo({ assigned_to: 'other', user_id: 'other' }, 'me')).toBe(false)
    expect(shouldNotifyTodo({ assigned_to: 'me', user_id: 'me' }, 'me')).toBe(false)
  })
})
