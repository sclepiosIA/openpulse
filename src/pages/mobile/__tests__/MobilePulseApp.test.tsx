import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversations: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  usePulseMessagesRealtime: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/pulse/usePulsePresence', () => ({
  usePulsePresence: () => ({ onlineUsers: [], isLoading: false }),
}));
vi.mock('@/hooks/presence/useGlobalUserPresence', () => ({
  useGlobalUserPresence: () => ({}),
}));
vi.mock('@/components/pulse/ConversationList', () => ({
  ConversationList: () => <div data-testid="conv-list" />,
}));
vi.mock('@/components/pulse/ConversationDetail', () => ({
  ConversationDetail: () => <div />,
}));
vi.mock('@/components/pulse/CreateConversationDialog', () => ({
  CreateConversationDialog: () => null,
}));
vi.mock('@/components/pulse/SearchDialog', () => ({
  SearchDialog: () => null,
}));
vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}));
vi.mock('@/components/pulse/PulseMobileHeader', () => ({
  PulseMobileHeader: () => <div />,
}));

import MobilePulseApp from '../MobilePulseApp';

describe('MobilePulseApp', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter><MobilePulseApp /></MemoryRouter>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
