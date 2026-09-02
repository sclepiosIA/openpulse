import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TresoreriePagination } from '@/components/tresorerie/TresoreriePagination';

describe('TresoreriePagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('should render item range', () => {
    render(React.createElement(TresoreriePagination, defaultProps));
    expect(screen.getByText(/1-10 sur 50/)).toBeInTheDocument();
  });

  it('should render page size selector', () => {
    render(React.createElement(TresoreriePagination, defaultProps));
    expect(screen.getByText('par page')).toBeInTheDocument();
  });

  it('should render pagination links for multiple pages', () => {
    render(React.createElement(TresoreriePagination, defaultProps));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should return null for zero items', () => {
    const { container } = render(React.createElement(TresoreriePagination, {
      ...defaultProps,
      totalItems: 0,
    }));
    expect(container.firstChild).toBeNull();
  });

  it('should not show pagination for single page', () => {
    render(React.createElement(TresoreriePagination, {
      ...defaultProps,
      totalPages: 1,
      totalItems: 5,
    }));
    expect(screen.getByText(/1-5 sur 5/)).toBeInTheDocument();
    // No page numbers should be shown
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('should show ellipsis for many pages', () => {
    render(React.createElement(TresoreriePagination, {
      ...defaultProps,
      currentPage: 5,
      totalPages: 20,
      totalItems: 200,
    }));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should show correct range for middle page', () => {
    render(React.createElement(TresoreriePagination, {
      ...defaultProps,
      currentPage: 3,
      totalItems: 50,
    }));
    expect(screen.getByText(/21-30 sur 50/)).toBeInTheDocument();
  });
});
