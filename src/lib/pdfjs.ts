/**
 * Centralized PDF.js worker configuration
 * This ensures a single consistent worker version across all components.
 */
import { pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// IMPORTANT:
// - The worker MUST match the PDF.js API version used by react-pdf.
// - We add a cache-busting query param tied to pdfjs.version to avoid stale SW/browser caches.
const version = pdfjs.version;
const versionedWorkerSrc = workerSrc.includes("?")
  ? `${workerSrc}&v=${encodeURIComponent(version)}`
  : `${workerSrc}?v=${encodeURIComponent(version)}`;

pdfjs.GlobalWorkerOptions.workerSrc = versionedWorkerSrc;

// Log version info in development to help debug version mismatches
if (import.meta.env.DEV) {
  console.info("[pdfjs] Configured", {
    apiVersion: pdfjs.version,
    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
  });
}

export { pdfjs };
