import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TableSkeleton, CardSkeleton, StatsSkeleton, FormSkeleton } from '@/components/shared/LoadingStates';

describe('LoadingStates', () => {
  describe('TableSkeleton', () => {
    it('should render default 5 rows x 6 columns', () => {
      const { container } = render(<TableSkeleton />);
      const rows = container.querySelectorAll('.space-y-3 > div');
      expect(rows.length).toBe(5);
    });

    it('should render custom rows and columns', () => {
      const { container } = render(<TableSkeleton rows={3} columns={4} />);
      const rows = container.querySelectorAll('.space-y-3 > div');
      expect(rows.length).toBe(3);
    });
  });

  describe('CardSkeleton', () => {
    it('should render skeleton card', () => {
      const { container } = render(<CardSkeleton />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('StatsSkeleton', () => {
    it('should render 4 card skeletons by default', () => {
      const { container } = render(<StatsSkeleton />);
      const cards = container.querySelectorAll('.grid > *');
      expect(cards.length).toBe(4);
    });

    it('should render custom count', () => {
      const { container } = render(<StatsSkeleton count={2} />);
      const cards = container.querySelectorAll('.grid > *');
      expect(cards.length).toBe(2);
    });
  });

  describe('FormSkeleton', () => {
    it('should render 4 form fields', () => {
      const { container } = render(<FormSkeleton />);
      const fields = container.querySelectorAll('.space-y-4 > div');
      expect(fields.length).toBe(4);
    });
  });
});
