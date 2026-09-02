/**
 * Global type declarations for third-party libraries and browser APIs
 */

// Sentry types are loaded lazily via monitoring.ts

// Workbox manifest declaration (injected at build time)
declare const __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;

// Workbox install event type
export interface WorkboxInstallEvent extends Event {
  isUpdate?: boolean;
}

// Sentry global types
export interface WindowWithSentry extends Window {
  Sentry?: {
    withScope: (callback: (scope: any) => void) => void;
    captureException: (error: Error | unknown) => string;
    captureMessage: (message: string) => string;
    setUser: (user: { id?: string; email?: string; username?: string } | null) => void;
    setTag: (key: string, value: string) => void;
    setContext: (name: string, context: Record<string, unknown> | null) => void;
    addBreadcrumb: (breadcrumb: {
      message?: string;
      category?: string;
      level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
      data?: Record<string, unknown>;
    }) => void;
  };
}

// jsPDF with autoTable plugin types
export interface AutoTableResult {
  finalY: number;
  pageNumber: number;
  pageCount: number;
}

export interface jsPDFWithAutoTable {
  lastAutoTable: AutoTableResult;
  autoTable: (options: AutoTableOptions) => void;
}

export interface AutoTableOptions {
  startY?: number;
  head?: (string | number)[][];
  body?: (string | number | null | undefined)[][];
  foot?: (string | number)[][];
  styles?: {
    fontSize?: number;
    cellPadding?: number;
    halign?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    fillColor?: string | number[];
    textColor?: string | number[];
    fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  };
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  footStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
  columnStyles?: Record<number | string, Record<string, unknown>>;
  theme?: 'striped' | 'grid' | 'plain';
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  tableWidth?: 'auto' | 'wrap' | number;
  showHead?: 'everyPage' | 'firstPage' | 'never';
  showFoot?: 'everyPage' | 'lastPage' | 'never';
  tableLineColor?: string | number[];
  tableLineWidth?: number;
}

// Navigator Network Information API
export interface NetworkInformation {
  downlink: number;
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  rtt: number;
  saveData: boolean;
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
}

export interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

// Analytics third-party globals
export interface PlausibleFunction {
  (eventName: string, options?: { props?: Record<string, string | number | boolean | null | undefined> }): void;
  q?: IArguments[];
}

export interface MatomoQueue {
  push: (args: unknown[]) => void;
}

export interface WindowWithAnalytics extends Window {
  plausible?: PlausibleFunction;
  _paq?: MatomoQueue;
}

// OnlyOffice DocsAPI types
export interface DocsAPIEditorConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: {
      edit?: boolean;
      download?: boolean;
      print?: boolean;
    };
  };
  documentType: 'word' | 'cell' | 'slide';
  editorConfig: {
    mode: 'edit' | 'view';
    lang: string;
    user: { id: string; name: string };
    callbackUrl?: string;
    customization?: {
      autosave?: boolean;
      forcesave?: boolean;
      chat?: boolean;
      comments?: boolean;
      compactHeader?: boolean;
      feedback?: boolean;
      help?: boolean;
    };
  };
  token?: string;
  height?: string;
  width?: string;
  events?: {
    onReady?: () => void;
    onError?: (event: { data: unknown }) => void;
    onDocumentStateChange?: (event: { data: boolean }) => void;
    onRequestClose?: () => void;
  };
}

export interface DocsAPIDocEditor {
  destroy: () => void;
  destroyEditor: () => void;
}

export interface DocsAPI {
  DocEditor: new (containerId: string, config: DocsAPIEditorConfig) => DocsAPIDocEditor;
}

// Declare global augmentations
declare global {
  interface Window {
    Sentry?: WindowWithSentry['Sentry'];
    plausible?: PlausibleFunction;
    _paq?: MatomoQueue;
    // OnlyOffice Document Server API
    DocsAPI?: DocsAPI;
    // MSStream detection (IE legacy)
    MSStream?: unknown;
    // Service Worker no-sw flag
    __NO_SW__?: boolean;
  }

  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
    // PWA Badge API
    setAppBadge: (count?: number) => Promise<void>;
    clearAppBadge: () => Promise<void>;
    // iOS PWA standalone detection
    standalone?: boolean;
  }
}

export {};
