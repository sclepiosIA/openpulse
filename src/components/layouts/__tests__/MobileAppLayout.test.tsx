import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileAppLayout } from '../MobileAppLayout';
import { Home } from 'lucide-react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('MobileAppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and children', () => {
    render(
      <MobileAppLayout title="Test Page" icon={Home}>
        <div data-testid="content">Content</div>
      </MobileAppLayout>
    );
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('shows back button when showBackButton is true', () => {
    render(
      <MobileAppLayout title="Test" icon={Home} showBackButton>
        <div>Content</div>
      </MobileAppLayout>
    );
    const backButton = screen.getByRole('button');
    expect(backButton).toBeInTheDocument();
  });

  it('navigates back on back button click', () => {
    render(
      <MobileAppLayout title="Test" icon={Home} showBackButton>
        <div>Content</div>
      </MobileAppLayout>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to backPath when provided', () => {
    render(
      <MobileAppLayout title="Test" icon={Home} showBackButton backPath="/home">
        <div>Content</div>
      </MobileAppLayout>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });

  it('calls onBack callback when provided', () => {
    const onBack = vi.fn();
    render(
      <MobileAppLayout title="Test" icon={Home} showBackButton onBack={onBack}>
        <div>Content</div>
      </MobileAppLayout>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('hides header when hideHeader is true', () => {
    render(
      <MobileAppLayout title="Test" icon={Home} hideHeader>
        <div>Content</div>
      </MobileAppLayout>
    );
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('renders header actions', () => {
    render(
      <MobileAppLayout title="Test" icon={Home} headerActions={<button>Action</button>}>
        <div>Content</div>
      </MobileAppLayout>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
