import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import HealthCheck from '@/pages/HealthCheck';

describe('HealthCheck', () => {
  it('should render OK status', () => {
    render(React.createElement(HealthCheck));
    expect(screen.getByText('OK – UI rendue')).toBeInTheDocument();
  });

  it('should show React status message', () => {
    render(React.createElement(HealthCheck));
    expect(screen.getByText('React fonctionne, router actif, rendu OK')).toBeInTheDocument();
  });

  it('should show timestamp', () => {
    render(React.createElement(HealthCheck));
    expect(screen.getByText(/Timestamp:/)).toBeInTheDocument();
  });

  it('should show current route', () => {
    render(React.createElement(HealthCheck));
    expect(screen.getByText(/Route:/)).toBeInTheDocument();
  });
});
