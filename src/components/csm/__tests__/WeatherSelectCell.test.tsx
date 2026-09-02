import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeatherSelectCell } from '../WeatherSelectCell';
import { WEATHER_CONFIG } from '@/components/csm/WeatherIcon';

// jsdom does not implement PointerEvent APIs that Radix Select relies on.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
});

describe('WeatherSelectCell', () => {
  it('renders trigger with current value label', () => {
    render(<WeatherSelectCell value="sunny" onSave={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain(WEATHER_CONFIG.sunny.label);
  });

  it('reflects a different initial value on the trigger', () => {
    render(<WeatherSelectCell value="stormy" onSave={vi.fn()} />);
    expect(screen.getByRole('combobox').textContent).toContain(WEATHER_CONFIG.stormy.label);
  });

  it('exposes every WEATHER_CONFIG entry once opened via keyboard', async () => {
    const user = userEvent.setup();
    render(<WeatherSelectCell value="cloudy" onSave={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{Enter}');
    const options = await screen.findAllByRole('option');
    expect(options.length).toBe(Object.keys(WEATHER_CONFIG).length);
  });
});
