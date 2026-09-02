import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherIcon, WeatherLegend } from '../WeatherIcon';

describe('WeatherIcon', () => {
  it('renders sunny icon without label by default', () => {
    const { container } = render(<WeatherIcon weather="sunny" />);
    expect(container.querySelector('.bg-emerald-50')).toBeInTheDocument();
  });

  it('renders label when showLabel is true', () => {
    render(<WeatherIcon weather="sunny" showLabel />);
    expect(screen.getByText('Bon')).toBeInTheDocument();
  });

  it('renders rainy with correct color', () => {
    const { container } = render(<WeatherIcon weather="rainy" showLabel />);
    expect(screen.getByText('Préoccupant')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
  });

  it('renders stormy with critical label', () => {
    render(<WeatherIcon weather="stormy" showLabel />);
    expect(screen.getByText('Critique')).toBeInTheDocument();
  });

  it('renders not-started fallback', () => {
    render(<WeatherIcon weather="not-started" showLabel />);
    expect(screen.getByText('Pas déployé')).toBeInTheDocument();
  });

  it('supports different sizes', () => {
    const { container } = render(<WeatherIcon weather="sunny" size="lg" />);
    expect(container.querySelector('.w-8')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<WeatherIcon weather="sunny" className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });
});

describe('WeatherLegend', () => {
  it('renders all 6 weather types', () => {
    render(<WeatherLegend />);
    expect(screen.getByText('Bon')).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('À surveiller')).toBeInTheDocument();
    expect(screen.getByText('Préoccupant')).toBeInTheDocument();
    expect(screen.getByText('Critique')).toBeInTheDocument();
    expect(screen.getByText('Pas déployé')).toBeInTheDocument();
  });
});
