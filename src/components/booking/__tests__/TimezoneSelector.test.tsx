import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimezoneSelector, getDetectedTimezone } from '@/components/booking/TimezoneSelector';

describe('TimezoneSelector', () => {
  it('should render with selected timezone label', () => {
    render(<TimezoneSelector value="Europe/Paris" onChange={vi.fn()} />);
    expect(screen.getByText('Paris (CET/CEST)')).toBeInTheDocument();
  });

  it('should render compact mode', () => {
    render(<TimezoneSelector value="Europe/Paris" onChange={vi.fn()} compact />);
    expect(screen.getByText('Paris (CET/CEST)')).toBeInTheDocument();
  });

  it('should render fallback for unknown timezone', () => {
    render(<TimezoneSelector value="Pacific/Fiji" onChange={vi.fn()} compact />);
    expect(screen.getByText('Fiji')).toBeInTheDocument();
  });
});

describe('getDetectedTimezone', () => {
  it('should return a string timezone', () => {
    const tz = getDetectedTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});
