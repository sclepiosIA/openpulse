// Écran 2 — Choix du dossier local de synchronisation (plan §8.2 étape 2).

import { useState } from "react";
import { pickFolder, setSyncRoot } from "../api/driveClient";
import { useAppStore } from "../state/store";

export default function FolderPickerPage() {
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setScreen = useAppStore((s) => s.setScreen);
  const session = useAppStore((s) => s.session);

  async function onPick() {
    setError(null);
    const picked = await pickFolder();
    if (picked) setFolder(picked);
  }

  async function onContinue() {
    if (!folder) return;
    try {
      await setSyncRoot(folder);
      setScreen("spaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="card">
      <h1>Dossier Gestion Drive</h1>
      <p className="muted">
        Bonjour {session?.display_name ?? ""}. Choisissez le dossier local qui contiendra vos
        fichiers synchronisés.
      </p>
      <div className="folder-picker">
        <button onClick={onPick}>Choisir un dossier…</button>
        <code className="folder-path">{folder ?? "Aucun dossier sélectionné"}</code>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button onClick={onContinue} disabled={!folder}>
          Continuer
        </button>
      </div>
    </section>
  );
}
