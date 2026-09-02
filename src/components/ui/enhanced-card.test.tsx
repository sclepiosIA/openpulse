import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardContent, EnhancedCardFooter } from './enhanced-card';
import '@testing-library/jest-dom';

const { joinStable } = vi.hoisted(() => ({
  joinStable: (parts: any[]) => parts.join(' ')
}));

// Mock internal utils with stable reference
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args: any[]) => {
    const flatten = (v: any) => (Array.isArray(v) ? v.flat(Infinity) : v);
    const flat = args.flatMap(flatten).filter((v) => v != null && v !== false);
    return joinStable(flat);
  })
}));

type WrapperProps = { children: React.ReactNode };

function Wrapper({ children }: WrapperProps) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('EnhancedCard component', () => {
  afterEach(() => {
    // ensure mocks reset between tests
    vi.clearAllMocks();
  });

  it('renders with default styling and left accent border', () => {
    const { getByTestId } = render(
      <Wrapper>
        <EnhancedCard data-testid="root" accentColor="blue" accentPosition="left" hoverable={true} glowOnHover={true}>
          Content
        </EnhancedCard>
      </Wrapper>
    );

    const root = getByTestId('root');
    expect(root).toBeInTheDocument();
    // Base styles
    expect(root).toHaveClass('rounded-xl');
    expect(root).toHaveClass('bg-card');
    expect(root).toHaveClass('text-card-foreground');
    expect(root).toHaveClass('border');
    expect(root).toHaveClass('border-border/50');
    // Accent left
    expect(root).toHaveClass('border-l-4');
    expect(root).toHaveClass('border-l-primary');
    // Hover and glow
    expect(root).toHaveClass('hover:-translate-y-1');
    expect(root).toHaveClass('hover:shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.15)]');
  });

  it('renders with top accent border when accentPosition is top', () => {
    const { getByTestId } = render(
      <Wrapper>
        <EnhancedCard data-testid="root-top" accentColor="blue" accentPosition="top" hoverable={false}>
          TopContent
        </EnhancedCard>
      </Wrapper>
    );

    const root = getByTestId('root-top');
    expect(root).toBeInTheDocument();
    expect(root).toHaveClass('border-t-4');
    expect(root).toHaveClass('border-t-primary');
    // Should not have left border width when top
    expect(root).not.toHaveClass('border-l-4');
  });

  it('renders without accent borders when accentPosition is none', () => {
    const { getByTestId } = render(
      <Wrapper>
        <EnhancedCard data-testid="root-none" accentColor="blue" accentPosition="none">
          NoAccent
        </EnhancedCard>
      </Wrapper>
    );

    const root = getByTestId('root-none');
    expect(root).toBeInTheDocument();
    expect(root).not.toHaveClass('border-l-4');
    expect(root).not.toHaveClass('border-t-4');
  });

  it('renders header, title and content sections correctly', () => {
    const { getByTestId, getByText } = render(
      <Wrapper>
        <EnhancedCard data-testid="root" accentColor="blue" accentPosition="left">
          <EnhancedCardHeader data-testid="hdr">
            <EnhancedCardTitle data-testid="title">Title</EnhancedCardTitle>
          </EnhancedCardHeader>
          <EnhancedCardContent data-testid="content">Some content</EnhancedCardContent>
          <EnhancedCardFooter data-testid="footer">Footer</EnhancedCardFooter>
        </EnhancedCard>
      </Wrapper>
    );

    expect(getByTestId('root')).toBeInTheDocument();
    expect(getByTestId('hdr')).toBeInTheDocument();
    expect(getByTestId('title')).toBeInTheDocument();
    expect(getByTestId('content')).toBeInTheDocument();
    expect(getByTestId('footer')).toBeInTheDocument();
    expect(getByText('Title')).toBeInTheDocument();
  });

  it('applies a custom className when provided', () => {
    const { getByTestId } = render(
      <Wrapper>
        <EnhancedCard data-testid="root-custom" className="custom-class" accentColor="blue" accentPosition="left">
          Custom class
        </EnhancedCard>
      </Wrapper>
    );

    const root = getByTestId('root-custom');
    expect(root).toBeInTheDocument();
    expect(root).toHaveClass('custom-class');
  });
});