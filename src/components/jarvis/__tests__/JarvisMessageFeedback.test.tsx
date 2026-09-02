import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { JarvisMessageFeedback } from '../JarvisMessageFeedback';

describe('JarvisMessageFeedback', () => {
  it('renders feedback buttons', () => {
    const { container } = render(<JarvisMessageFeedback messageId="m1" />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onFeedback on thumbs up', () => {
    const onFeedback = vi.fn();
    const { container } = render(
      <JarvisMessageFeedback messageId="m1" onFeedback={onFeedback} />
    );
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]); // thumbs up
    expect(onFeedback).toHaveBeenCalledWith('m1', 'positive');
  });
});
