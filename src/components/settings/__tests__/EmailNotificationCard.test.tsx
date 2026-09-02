import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailNotificationCard } from '../EmailNotificationCard';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('EmailNotificationCard', () => {
  it('renders title', () => {
    render(<MemoryRouter><EmailNotificationCard /></MemoryRouter>);
    expect(screen.getByText('Notifications Email')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<MemoryRouter><EmailNotificationCard /></MemoryRouter>);
    expect(screen.getByText('Sons, alertes bureau et fréquence')).toBeInTheDocument();
  });

  it('navigates on click', () => {
    render(<MemoryRouter><EmailNotificationCard /></MemoryRouter>);
    fireEvent.click(screen.getByText('Notifications Email').closest('[class*="cursor-pointer"]')!);
    expect(navigate).toHaveBeenCalledWith('/profil?tab=notifications');
  });
});
