import { describe, it, expect, vi } from 'vitest';
import { getClickableRowProps } from '../shared/useSmartNavigation';

describe('getClickableRowProps', () => {
  it('returns onClick, role, tabIndex, and onKeyDown', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/test');
    expect(props.role).toBe('link');
    expect(props.tabIndex).toBe(0);
    expect(typeof props.onClick).toBe('function');
    expect(typeof props.onKeyDown).toBe('function');
  });

  it('onClick navigates normally without meta key', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/test');
    props.onClick({ metaKey: false, ctrlKey: false, preventDefault: vi.fn() } as any);
    expect(navigate).toHaveBeenCalledWith('/test');
  });

  it('onClick opens new tab with meta key', () => {
    const navigate = vi.fn();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = getClickableRowProps(navigate, '/test');
    const preventDefault = vi.fn();
    props.onClick({ metaKey: true, ctrlKey: false, preventDefault } as any);
    expect(windowOpen).toHaveBeenCalledWith('/test', '_blank');
    expect(navigate).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  it('onClick opens new tab with ctrl key', () => {
    const navigate = vi.fn();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = getClickableRowProps(navigate, '/page');
    const preventDefault = vi.fn();
    props.onClick({ metaKey: false, ctrlKey: true, preventDefault } as any);
    expect(windowOpen).toHaveBeenCalledWith('/page', '_blank');
    windowOpen.mockRestore();
  });

  it('onKeyDown navigates on Enter', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/enter');
    props.onKeyDown({ key: 'Enter' } as any);
    expect(navigate).toHaveBeenCalledWith('/enter');
  });

  it('onKeyDown does nothing on other keys', () => {
    const navigate = vi.fn();
    const props = getClickableRowProps(navigate, '/test');
    props.onKeyDown({ key: 'Escape' } as any);
    expect(navigate).not.toHaveBeenCalled();
  });
});
