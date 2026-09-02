import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SafeShell from '../SafeShell';

describe('SafeShell page', () => {
  it('renders safe shell content', () => {
    render(
      <MemoryRouter>
        <SafeShell />
      </MemoryRouter>
    );
    expect(screen.getByText(/Safe Shell/i)).toBeInTheDocument();
  });

  it('renders online status', () => {
    render(
      <MemoryRouter>
        <SafeShell />
      </MemoryRouter>
    );
    expect(screen.getByText(/En ligne|Hors ligne/i)).toBeInTheDocument();
  });
});
