import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LazyImage } from '../lazy-image';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();

beforeEach(() => {
  mockIntersectionObserver.mockImplementation((callback: IntersectionObserverCallback) => {
    // Immediately trigger intersection
    setTimeout(() => {
      callback(
        [{ isIntersecting: true, target: document.createElement('div') }] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    }, 0);
    
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: vi.fn(),
    };
  });
  
  vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LazyImage', () => {
  describe('Rendering', () => {
    it('should render with src and alt', async () => {
      render(<LazyImage src="/test-image.jpg" alt="Test image" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveAttribute('src', '/test-image.jpg');
        expect(img).toHaveAttribute('alt', 'Test image');
      });
    });

    it('should show placeholder before intersection', () => {
      // Override to not trigger intersection
      mockIntersectionObserver.mockImplementation(() => ({
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: vi.fn(),
      }));
      
      const { container } = render(<LazyImage src="/test.jpg" alt="Test" />);
      
      // Should show placeholder (animate-pulse skeleton)
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <LazyImage src="/test.jpg" alt="Test" className="custom-class" />
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Intersection Observer', () => {
    it('should observe element on mount', () => {
      render(<LazyImage src="/test.jpg" alt="Test" />);
      
      expect(mockObserve).toHaveBeenCalled();
    });

    it('should disconnect on unmount', () => {
      const { unmount } = render(<LazyImage src="/test.jpg" alt="Test" />);
      
      unmount();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should use custom rootMargin', () => {
      render(<LazyImage src="/test.jpg" alt="Test" rootMargin="200px" />);
      
      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { rootMargin: '200px' }
      );
    });
  });

  describe('Loading States', () => {
    it('should transition opacity on load', async () => {
      render(<LazyImage src="/test.jpg" alt="Test" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        // Before load, opacity should be 0
        expect(img).toHaveClass('opacity-0');
      });
    });

    it('should set opacity-100 after load', async () => {
      render(<LazyImage src="/test.jpg" alt="Test" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        fireEvent.load(img);
      });
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveClass('opacity-100');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show fallback on error', async () => {
      render(
        <LazyImage 
          src="/broken.jpg" 
          alt="Test" 
          fallback={<div data-testid="fallback">Error</div>}
        />
      );
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        fireEvent.error(img);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });
    });

    it('should show default fallback when no custom provided', async () => {
      const { container } = render(<LazyImage src="/broken.jpg" alt="Test" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        fireEvent.error(img);
      });
      
      await waitFor(() => {
        // Default fallback is bg-muted placeholder
        expect(container.querySelector('.bg-muted')).toBeInTheDocument();
      });
    });
  });

  describe('Blur Placeholder', () => {
    it('should render blur placeholder when provided', async () => {
      const { container } = render(
        <LazyImage 
          src="/test.jpg" 
          alt="Test" 
          blurDataUrl="data:image/png;base64,..." 
        />
      );
      
      // Should have blur placeholder image
      const blurImg = container.querySelector('img[aria-hidden="true"]');
      expect(blurImg).toHaveAttribute('src', 'data:image/png;base64,...');
    });
  });

  describe('Native Lazy Loading', () => {
    it('should have loading="lazy" attribute', async () => {
      render(<LazyImage src="/test.jpg" alt="Test" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('should have decoding="async" attribute', async () => {
      render(<LazyImage src="/test.jpg" alt="Test" />);
      
      await waitFor(() => {
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveAttribute('decoding', 'async');
      });
    });
  });
});
