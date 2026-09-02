import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeToggle } from '@/components/ThemeToggle'

// Mock useTheme hook
vi.mock('@/hooks/shared/useTheme', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn()
  }))
}))

describe('ThemeToggle', () => {
  it('renders toggle button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})