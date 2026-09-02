import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useInfraUrls: () => ({ jitsi_url: 'https://meet.jitsi.example.com' }),
}));

import ParametresVisioconference from '../ParametresVisioconference';

describe('ParametresVisioconference page', () => {
  it('renders title', () => {
    render(
      <MemoryRouter>
        <ParametresVisioconference />
      </MemoryRouter>
    );
    expect(screen.getByText('Services de Visioconférence')).toBeInTheDocument();
  });
});
