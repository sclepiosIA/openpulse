import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MessageReadReceipt } from '../MessageReadReceipt';

describe('MessageReadReceipt', () => {
  it('renders sending state', () => {
    const { container } = render(<MessageReadReceipt status="sending" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders sent state', () => {
    const { container } = render(<MessageReadReceipt status="sent" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders delivered state', () => {
    const { container } = render(<MessageReadReceipt status="delivered" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders read state', () => {
    const { container } = render(<MessageReadReceipt status="read" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders group chat read count', () => {
    const { container } = render(
      <MessageReadReceipt status="read" isGroupChat readByCount={3} totalRecipients={5} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<MessageReadReceipt status="sent" className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });
});
