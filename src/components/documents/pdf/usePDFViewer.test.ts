import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { debugErrorMock, onPageChangeMock } = vi.hoisted(() => ({
  debugErrorMock: vi.fn(),
  onPageChangeMock: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

import { usePDFViewer } from './usePDFViewer';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePDFViewer', () => {
  it('initial state, loading -> auto fit width, calculateOptimalScale and resize behavior', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer({ onPageChange: onPageChangeMock }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.viewMode).toBe('single');
    expect(result.current.fitMode).toBe('width');
    expect(result.current.scale).toBe(1);

    const container = document.createElement('div');
    let width = 1000;
    let height = 1000;
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => height });
    await act(async () => {
      result.current.containerRef.current = container;
    });

    await act(async () => {
      result.current.setLoading(false);
    });

    const expectedWidthScale = Math.min((width - 48) / 612, 2);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.scale).toBeCloseTo(expectedWidthScale, 3);
    });

    const calc = result.current.calculateOptimalScale();
    expect(calc).toBeCloseTo(expectedWidthScale, 3);

    width = 600;
    window.dispatchEvent(new Event('resize'));
    const expectedWidthScaleAfterResize = Math.min((width - 48) / 612, 2);
    await waitFor(() => {
      expect(result.current.scale).toBeCloseTo(expectedWidthScaleAfterResize, 3);
    });

    width = 100;
    const minCalc = result.current.calculateOptimalScale();
    expect(minCalc).toBe(0.5);

    width = 10000;
    const maxCalc = result.current.calculateOptimalScale();
    expect(maxCalc).toBe(2);

    await act(async () => {
      result.current.containerRef.current = null;
    });
    expect(result.current.calculateOptimalScale()).toBe(1);
  });

  it('page navigation clamps and triggers onPageChange callback', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer({ onPageChange: onPageChangeMock }), { wrapper });

    await act(async () => {
      result.current.setNumPages(10);
    });
    expect(result.current.numPages).toBe(10);

    await act(async () => {
      result.current.goToPage(5);
    });
    expect(result.current.currentPage).toBe(5);

    await act(async () => {
      result.current.nextPage();
    });
    expect(result.current.currentPage).toBe(6);

    await act(async () => {
      result.current.prevPage();
    });
    expect(result.current.currentPage).toBe(5);

    await act(async () => {
      result.current.goToPage(0);
    });
    expect(result.current.currentPage).toBe(1);

    await act(async () => {
      result.current.goToPage(42);
    });
    expect(result.current.currentPage).toBe(10);

    expect(onPageChangeMock).toHaveBeenCalledWith(5);
    expect(onPageChangeMock).toHaveBeenCalledWith(6);
    expect(onPageChangeMock).toHaveBeenCalledWith(5);
    expect(onPageChangeMock).toHaveBeenCalledWith(1);
    expect(onPageChangeMock).toHaveBeenCalledWith(10);
  });

  it('zoom controls and setScale respect boundaries and set custom fitMode', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    await act(async () => {
      result.current.setScale(2.9);
    });
    expect(result.current.fitMode).toBe('custom');
    expect(result.current.scale).toBe(2.9);

    await act(async () => {
      result.current.zoomIn();
    });
    expect(result.current.scale).toBe(3);

    await act(async () => {
      result.current.zoomIn();
    });
    expect(result.current.scale).toBe(3);

    await act(async () => {
      result.current.setScale(0.6);
    });
    expect(result.current.scale).toBe(0.6);

    await act(async () => {
      result.current.zoomOut();
    });
    expect(result.current.scale).toBe(0.5);

    await act(async () => {
      result.current.zoomOut();
    });
    expect(result.current.scale).toBe(0.5);
  });

  it('fitToWidth and thumbnails toggle affect scale', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    const container = document.createElement('div');
    let width = 1000;
    let height = 1000;
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => height });
    await act(async () => {
      result.current.containerRef.current = container;
      result.current.setLoading(false);
    });

    await act(async () => {
      result.current.fitToWidth();
    });
    const noThumbScale = Math.min((width - 48) / 612, 2);
    expect(result.current.fitMode).toBe('width');
    expect(result.current.scale).toBeCloseTo(noThumbScale, 3);

    await act(async () => {
      result.current.toggleThumbnails();
    });
    await act(async () => {
      result.current.fitToWidth();
    });
    const withThumbScale = Math.min((width - 240) / 612, 2);
    expect(result.current.showThumbnails).toBe(true);
    expect(result.current.scale).toBeCloseTo(withThumbScale, 3);
  });

  it('fitToPage uses container height and width scale minimum', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    const container = document.createElement('div');
    let width = 1000;
    let height = 1000;
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => height });

    await act(async () => {
      result.current.containerRef.current = container;
      result.current.setLoading(false);
    });

    await act(async () => {
      result.current.fitToPage();
    });
    const widthScale = Math.min((width - 48) / 612, 2);
    const heightScale = (height - 48) / 792;
    const expected = Math.min(widthScale, heightScale);
    expect(result.current.fitMode).toBe('page');
    expect(result.current.scale).toBeCloseTo(expected, 3);
  });

  it('toggleViewMode toggles between single and continuous', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    expect(result.current.viewMode).toBe('single');
    await act(async () => {
      result.current.toggleViewMode();
    });
    expect(result.current.viewMode).toBe('continuous');
    await act(async () => {
      result.current.toggleViewMode();
    });
    expect(result.current.viewMode).toBe('single');
  });

  it('fullscreen toggling success path updates isFullscreen and calls document methods', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    const container = document.createElement('div');
    let width = 800;
    let height = 600;
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => height });

    const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(container, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenMock,
    });

    const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreenMock,
    });

    await act(async () => {
      result.current.containerRef.current = container;
    });

    await act(async () => {
      await result.current.toggleFullscreen();
    });
    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: container });
    document.dispatchEvent(new Event('fullscreenchange'));
    await waitFor(() => {
      expect(result.current.isFullscreen).toBe(true);
    });

    await act(async () => {
      await result.current.toggleFullscreen();
    });
    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    document.dispatchEvent(new Event('fullscreenchange'));
    await waitFor(() => {
      expect(result.current.isFullscreen).toBe(false);
    });
  });

  it('fullscreen error path calls debug.error and does not throw', async () => {
    debugErrorMock.mockClear();
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => 800 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => 600 });

    const err = new Error('no fullscreen');
    const requestFullscreenMock = vi.fn().mockRejectedValue(err);
    Object.defineProperty(container, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenMock,
    });

    await act(async () => {
      result.current.containerRef.current = container;
    });

    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(debugErrorMock).toHaveBeenCalled();
    const firstArg = debugErrorMock.mock.calls[0]?.[0];
    const secondArg = debugErrorMock.mock.calls[0]?.[1];
    expect(firstArg).toBe('Fullscreen error:');
    expect(secondArg).toBe(err);
  });

  it('setError allows setting and clearing an error message', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    expect(result.current.error).toBeNull();

    await act(async () => {
      result.current.setError('Something went wrong');
    });
    expect(result.current.error).toBe('Something went wrong');

    await act(async () => {
      result.current.setError(null);
    });
    expect(result.current.error).toBeNull();
  });

  it('setViewMode directly sets the view mode', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    expect(result.current.viewMode).toBe('single');
    await act(async () => {
      result.current.setViewMode('continuous');
    });
    expect(result.current.viewMode).toBe('continuous');
  });

  it('setCurrentPage directly sets current page without clamp (internal state setter)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePDFViewer(), { wrapper });

    await act(async () => {
      result.current.setNumPages(5);
      result.current.setCurrentPage(3);
    });
    expect(result.current.currentPage).toBe(3);
  });
});