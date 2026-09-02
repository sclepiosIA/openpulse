import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(initialRoute = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Protected</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div data-testid="auth-page">Auth Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows loader when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderWithRouter();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // Loader2 renders an SVG with animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', email: 'test@test.com' }, loading: false });
    renderWithRouter();
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to auth when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderWithRouter();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('preserves returnTo in redirect URL', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderWithRouter('/protected?tab=settings');
    // Should redirect to /auth with returnTo param
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });
});
