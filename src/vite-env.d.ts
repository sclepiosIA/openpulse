/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  interface ServiceWorkerGlobalScope extends EventTarget {
    __WB_MANIFEST: any;
    skipWaiting(): void;
    clients: Clients;
    registration: ServiceWorkerRegistration;
  }
  
  interface ExtendableEvent extends Event {
    waitUntil(promise: Promise<any>): void;
  }
  
  interface PushEvent extends ExtendableEvent {
    data?: PushMessageData;
  }
  
  interface ExtendableMessageEvent extends ExtendableEvent {
    data: any;
  }

  interface Window {
    Sentry?: {
      withScope: (callback: (scope: any) => void) => void;
      captureException: (error: Error) => void;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED?: string;
    readonly VITE_AUTHENTIK_SSO_ENABLED?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
