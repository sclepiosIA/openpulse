// Type declarations for workbox modules (injected by vite-plugin-pwa at build time)
declare module 'workbox-precaching' {
  export function precacheAndRoute(entries: Array<string | { url: string; revision: string | null }>): void;
  export function cleanupOutdatedCaches(): void;
}

declare module 'workbox-routing' {
  export function registerRoute(
    capture: ((options: { url: URL; request: Request; event?: FetchEvent }) => boolean) | RegExp | string,
    handler: any
  ): void;
}

declare module 'workbox-strategies' {
  interface StrategyOptions {
    cacheName?: string;
    plugins?: any[];
    networkTimeoutSeconds?: number;
  }
  export class NetworkFirst {
    constructor(options?: StrategyOptions);
  }
  export class CacheFirst {
    constructor(options?: StrategyOptions);
  }
  export class NetworkOnly {
    constructor(options?: StrategyOptions);
  }
  export class StaleWhileRevalidate {
    constructor(options?: StrategyOptions);
  }
}

declare module 'workbox-expiration' {
  export class ExpirationPlugin {
    constructor(options?: { maxEntries?: number; maxAgeSeconds?: number });
  }
}

declare module 'workbox-cacheable-response' {
  export class CacheableResponsePlugin {
    constructor(options?: { statuses?: number[] });
  }
}
