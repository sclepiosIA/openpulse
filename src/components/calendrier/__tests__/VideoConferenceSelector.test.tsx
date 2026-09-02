import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoConferenceSelector } from '../VideoConferenceSelector';

vi.mock('@/hooks/auth/useOAuthConnections', () => ({
  useCreateGoogleMeetLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateNextcloudTalkLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('VideoConferenceSelector', () => {
  it('renders label', () => {
    render(<VideoConferenceSelector value="" onChange={vi.fn()} eventTitle="Test" />);
    expect(screen.getByText('Visioconférence')).toBeInTheDocument();
  });

  it('renders provider selector with default value', () => {
    render(<VideoConferenceSelector value="" onChange={vi.fn()} eventTitle="Test" />);
    expect(screen.getByText('Aucune')).toBeInTheDocument();
  });

  it('renders combobox', () => {
    render(<VideoConferenceSelector value="" onChange={vi.fn()} eventTitle="Test" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
