import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedGrid } from '../virtualized-grid';

describe('VirtualizedGrid', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    name: `Item ${i}`,
  }));

  const renderItem = (item: { id: string; name: string }) => (
    <div data-testid={`item-${item.id}`}>{item.name}</div>
  );

  describe('Rendering', () => {
    it('should render items', () => {
      render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          virtualizationThreshold={50}
        />
      );
      
      // With less than threshold, all items should render
      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 9')).toBeInTheDocument();
    });

    it('should use simple grid for small datasets', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 20)}
          renderItem={renderItem}
          virtualizationThreshold={50}
          columns={3}
        />
      );
      
      // Should not have virtualization wrapper
      expect(container.querySelector('[style*="position: relative"]')).toBeNull();
    });

    it('should use virtualized rendering for large datasets', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems}
          renderItem={renderItem}
          virtualizationThreshold={50}
          columns={3}
        />
      );
      
      // Should have virtualization container
      expect(container.querySelector('.overflow-auto')).toBeInTheDocument();
    });
  });

  describe('Grid Columns', () => {
    it('should apply correct column classes for 1 column', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          columns={1}
          virtualizationThreshold={50}
        />
      );
      
      expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    });

    it('should apply correct column classes for 3 columns', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          columns={3}
          virtualizationThreshold={50}
        />
      );
      
      expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
    });

    it('should apply correct column classes for 4 columns', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          columns={4}
          virtualizationThreshold={50}
        />
      );
      
      expect(container.querySelector('.xl\\:grid-cols-4')).toBeInTheDocument();
    });
  });

  describe('Key Extraction', () => {
    it('should use custom key extractor when provided', () => {
      const getItemKey = vi.fn((item: { id: string }) => item.id);
      
      render(
        <VirtualizedGrid
          items={mockItems.slice(0, 5)}
          renderItem={renderItem}
          getItemKey={getItemKey}
          virtualizationThreshold={50}
        />
      );
      
      expect(getItemKey).toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          className="custom-class"
          virtualizationThreshold={50}
        />
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should apply custom gap', () => {
      const { container } = render(
        <VirtualizedGrid
          items={mockItems.slice(0, 10)}
          renderItem={renderItem}
          gap={24}
          virtualizationThreshold={50}
        />
      );
      
      const grid = container.querySelector('.grid');
      expect(grid).toHaveStyle({ gap: '24px' });
    });
  });

  describe('Empty State', () => {
    it('should handle empty items array', () => {
      const { container } = render(
        <VirtualizedGrid
          items={[]}
          renderItem={renderItem}
          virtualizationThreshold={50}
        />
      );
      
      // Should render empty grid
      expect(container.querySelector('.grid')).toBeInTheDocument();
    });
  });
});
