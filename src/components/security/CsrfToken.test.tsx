import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { CsrfToken, getCsrfToken } from './CsrfToken';

const STORAGE_KEY = 'marque-csrf-token';

function mockGetRandomValues(seed = 0) {
  const implementation: Crypto['getRandomValues'] = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint8Array) {
      for (let index = 0; index < array.length; index += 1) {
        array[index] = (seed + index) % 256;
      }
    }
    return array;
  };

  return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(implementation);
}

function getRenderedInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[name="csrf_token"]');
  if (input === null) {
    throw new Error('Expected csrf hidden input to be rendered');
  }
  return input;
}

function getMetaToken(): HTMLMetaElement {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (meta === null) {
    throw new Error('Expected csrf meta tag to exist');
  }
  return meta;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  document.querySelectorAll('meta[name="csrf-token"]').forEach((meta) => meta.remove());
});

describe('CsrfToken', () => {
  it('renders a hidden csrf input, persists the generated token and synchronizes the meta tag', () => {
    const getRandomValuesMock = mockGetRandomValues();

    const { container } = render(createElement(CsrfToken));

    const input = getRenderedInput(container);
    const token = input.value;
    const meta = getMetaToken();

    expect(input.getAttribute('type')).toBe('hidden');
    expect(input.getAttribute('name')).toBe('csrf_token');
    expect(input.getAttribute('readOnly')).toBe('');
    expect(input.getAttribute('aria-hidden')).toBe('true');

    expect(token).toHaveLength(48);
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(token);
    expect(meta.content).toBe(token);

    expect(getRandomValuesMock).toHaveBeenCalledTimes(1);
    const firstCall = getRandomValuesMock.mock.calls[0];
    expect(firstCall).toHaveLength(1);
    expect(firstCall[0]).toBeInstanceOf(Uint8Array);
    expect(firstCall[0]?.byteLength).toBe(24);
  });

  it('reuses an existing session token without generating a new one', () => {
    const storedToken = 'a'.repeat(48);
    sessionStorage.setItem(STORAGE_KEY, storedToken);
    const getRandomValuesMock = mockGetRandomValues();

    const { container } = render(createElement(CsrfToken));

    const input = getRenderedInput(container);
    const meta = getMetaToken();

    expect(input.value).toBe(storedToken);
    expect(meta.content).toBe(storedToken);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(storedToken);
    expect(getRandomValuesMock).not.toHaveBeenCalled();
  });

  it('getCsrfToken returns the persisted token and keeps the meta tag synchronized', () => {
    const getRandomValuesMock = mockGetRandomValues(17);

    const firstToken = getCsrfToken();
    const secondToken = getCsrfToken();

    expect(firstToken).toHaveLength(48);
    expect(firstToken).toMatch(/^[0-9a-f]+$/);
    expect(secondToken).toBe(firstToken);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(firstToken);
    expect(getMetaToken().content).toBe(firstToken);
    expect(getRandomValuesMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty token when generation fails', () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('crypto unavailable');
    });

    const token = getCsrfToken();

    expect(token).toBe('');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.querySelector('meta[name="csrf-token"]')).toBeNull();

    const { container } = render(createElement(CsrfToken));
    const input = getRenderedInput(container);

    expect(input.value).toBe('');
  });
});