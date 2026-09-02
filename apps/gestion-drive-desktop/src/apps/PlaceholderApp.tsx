// Module PWA Gestion embarqué : on ne réimplémente pas Mail/Pulse/Todo/Documents.
// La vraie PWA Gestion est affichée dans le shell desktop via iframe/webview HTML.
// Le desktop ajoute autour : sidebar, tray, notifications, sync Drive en arrière-plan.

import { useState } from "react";
import type { AppDefinition } from "./registry";
import { gestionWebUrl, openInGestionWeb } from "../api/desktopApi";

export default function PlaceholderApp({ app }: { app: AppDefinition }) {
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  if (!app.webPath) return null;

  const url = gestionWebUrl(app.webPath);

  async function onOpenWeb() {
    if (!app.webPath) return;
    setError(null);
    try {
      await openInGestionWeb(app.webPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="pwa-module" aria-label={`${app.label} intégré`}>
      <header className="pwa-toolbar">
        <div className="pwa-title-block">
          <span className="pwa-icon" aria-hidden="true">{app.icon}</span>
          <div>
            <h1>{app.label}</h1>
            <p>{app.description}</p>
          </div>
        </div>
        <div className="pwa-actions">
          <button type="button" className="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Recharger
          </button>
          <button type="button" className="secondary" onClick={onOpenWeb}>
            Ouvrir dans Gestion web
          </button>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <iframe
        key={reloadKey}
        className="pwa-frame"
        title={`${app.label} — Gestion`}
        src={url}
        allow="clipboard-read; clipboard-write; camera; microphone; fullscreen"
      />
    </section>
  );
}
