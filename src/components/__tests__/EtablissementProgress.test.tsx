import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EtablissementProgress } from '@/components/etablissement/EtablissementProgress'

describe('EtablissementProgress', () => {
  it('renders progress with correct percentage', () => {
    render(<EtablissementProgress progression={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders 0% when progression is null', () => {
    render(<EtablissementProgress progression={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})