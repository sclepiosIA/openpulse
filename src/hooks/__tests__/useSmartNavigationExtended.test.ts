import { describe, it, expect, vi } from 'vitest';
import { getClickableRowProps } from '../shared/useSmartNavigation';

describe('getClickableRowProps', () => {
  it('returns onClick, role, tabIndex, onKeyDown', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/test');
    expect(typeof props.onClick).toBe('function');
    expect(props.role).toBe('link');
    expect(props.tabIndex).toBe(0);
    expect(typeof props.onKeyDown).toBe('function');
  });

  it('onClick navigates normally', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/page');
    const event = { metaKey: false, ctrlKey: false, preventDefault: vi.fn() } as any;
    props.onClick(event);
    expect(navigate).toHaveBeenCalledWith('/page');
  });

  it('onClick with metaKey opens new tab', () => {
    const navigate = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = getClickableRowProps(navigate, '/page');
    const event = { metaKey: true, ctrlKey: false, preventDefault: vi.fn() } as any;
    props.onClick(event);
    expect(openSpy).toHaveBeenCalledWith('/page', '_blank');
    expect(navigate).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('onClick with ctrlKey opens new tab', () => {
    const navigate = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = getClickableRowProps(navigate, '/page');
    const event = { metaKey: false, ctrlKey: true, preventDefault: vi.fn() } as any;
    props.onClick(event);
    expect(openSpy).toHaveBeenCalledWith('/page', '_blank');
    openSpy.mockRestore();
  });

  it('onKeyDown Enter navigates', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/dest');
    props.onKeyDown({ key: 'Enter' } as any);
    expect(navigate).toHaveBeenCalledWith('/dest');
  });

  it('onKeyDown non-Enter does nothing', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/dest');
    props.onKeyDown({ key: 'Space' } as any);
    expect(navigate).not.toHaveBeenCalled();
  });
});
