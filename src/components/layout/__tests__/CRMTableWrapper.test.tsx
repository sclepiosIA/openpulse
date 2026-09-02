import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CRMTableWrapper } from '../CRMTableWrapper';

describe('CRMTableWrapper', () => {
  it('renders children in card by default', () => {
    render(<CRMTableWrapper><table><tbody><tr><td>Cell</td></tr></tbody></table></CRMTableWrapper>);
    expect(screen.getByText('Cell')).toBeInTheDocument();
  });

  it('renders without card when withCard=false', () => {
    const { container } = render(
      <CRMTableWrapper withCard={false}><div>Content</div></CRMTableWrapper>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(container.querySelector('.overflow-hidden')).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CRMTableWrapper className="custom-cls"><div>Test</div></CRMTableWrapper>
    );
    expect(container.querySelector('.custom-cls')).toBeInTheDocument();
  });
});
