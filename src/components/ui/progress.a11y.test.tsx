import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Progress } from './progress';

describe('Progress a11y', () => {
  it('exposes a default aria-label when none is provided', () => {
    render(<Progress value={40} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Progression');
  });

  it('respects a custom aria-label', () => {
    render(<Progress value={20} aria-label="Import en cours" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Import en cours');
  });

  it('respects aria-labelledby without adding aria-label', () => {
    render(
      <>
        <span id="lbl">Envoi</span>
        <Progress value={10} aria-labelledby="lbl" />
      </>
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-labelledby', 'lbl');
    expect(bar).not.toHaveAttribute('aria-label');
  });
});
