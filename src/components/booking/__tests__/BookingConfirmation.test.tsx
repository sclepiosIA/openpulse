import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import type { BookingType, BookingFormData } from '@/types/booking';

describe('BookingConfirmation', () => {
  const bookingType = {
    id: 'bt1',
    name: 'Démo produit',
    duration_minutes: 30,
    color: '#3b82f6',
    category: 'demo',
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    description: null,
    location_type: null,
    requires_approval: false,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_hours: 0,
    max_future_days: 30,
    video_provider: null,
    created_by: null,
  } as unknown as BookingType;

  const selectedSlot = {
    start: '2026-03-15T10:00:00',
    end: '2026-03-15T10:30:00',
  };

  const formData: BookingFormData = {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    notes: 'Test notes',
  };

  it('should render success message', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText('Réservation confirmée !')).toBeInTheDocument();
  });

  it('should display email confirmation text', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    const emails = screen.getAllByText('jean@example.com');
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });

  it('should display booking type name', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText('Démo produit')).toBeInTheDocument();
  });

  it('should display participant name', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('should display host name when provided', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} hostName="Dr. Martin" />);
    expect(screen.getByText('avec Dr. Martin')).toBeInTheDocument();
  });

  it('should display time slot', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText('10:00 - 10:30')).toBeInTheDocument();
  });

  it('should render calendar add buttons', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByText('.ics')).toBeInTheDocument();
  });

  it('should render reminder notice', () => {
    render(<BookingConfirmation bookingType={bookingType} selectedSlot={selectedSlot} formData={formData} />);
    expect(screen.getByText(/rappel vous sera envoyé/)).toBeInTheDocument();
  });
});
