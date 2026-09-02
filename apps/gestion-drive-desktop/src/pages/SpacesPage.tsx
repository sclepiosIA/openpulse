// Écran 3 — Choix des espaces à synchroniser.
// Les espaces web_only (DPO restreint…) sont affichés mais non sélectionnables.

import { useCallback, useEffect, useState } from "react";
import {
  isConfirmedSessionRevocation,
  listSpaces,
  MOCK_SPACES,
  runPullSync,
  selectSpaces,
} from "../api/driveClient";
import { isSpaceSyncable } from "../api/types";
import { useAppStore } from "../state/store";
import SpaceBadge from "../components/SpaceBadge";

const SPACES_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Chargement des espaces trop long. Vérifiez la connexion puis réessayez.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const spaces = useAppStore((s) => s.spaces);
  const setSpaces = useAppStore((s) => s.setSpaces);
  const selected = useAppStore((s) => s.selectedSpaceIds);
  const setSelectedSpaceIds = useAppStore((s) => s.setSelectedSpaceIds);
  const toggleSpace = useAppStore((s) => s.toggleSpace);
  const setScreen = useAppStore((s) => s.setScreen);
  const reset = useAppStore((s) => s.reset);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUsingLocalFallback(false);
    try {
      const remoteSpaces = await withTimeout(listSpaces(), SPACES_TIMEOUT_MS);
      setSpaces(remoteSpaces);
      const syncableIds = remoteSpaces.filter(isSpaceSyncable).map((space) => space.id);
      if (syncableIds.length > 0) {
        setSelectedSpaceIds(syncableIds);
        await selectSpaces(syncableIds);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isConfirmedSessionRevocation(message)) {
        reset();
        setError('Session révoquée : reconnectez-vous à Gestion Drive.');
        setSpaces([]);
        setUsingLocalFallback(false);
        setScreen('login');
        return;
      }
      setError(message);
      setSpaces(MOCK_SPACES);
      setUsingLocalFallback(true);
    } finally {
      setLoading(false);
    }
  }, [reset, setScreen, setSelectedSpaceIds, setSpaces]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  async function onContinue() {
    try {
      await selectSpaces(selected);
      // Premier lot pull sync : lance immédiatement tree → changes →
      // téléchargements. Non bloquant : la page Statut suit la progression.
      runPullSync().catch(console.error);
      setScreen("status");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const syncableSelected = selected.filter((id) =>
    spaces.some((s) => s.id === id && isSpaceSyncable(s)),
  );

  return (
    <section className="card">
      <h1>Espaces à synchroniser</h1>
      <p className="muted">
        Sélectionnez les dossiers métiers à synchroniser localement. Les espaces
        sensibles « web uniquement » restent accessibles depuis Gestion mais ne
        sont jamais copiés sur le poste.
      </p>
      {loading && <p className="muted">Chargement des espaces depuis Gestion Drive…</p>}
      {error && (
        <div className="error" role="alert">
          {error}
          {usingLocalFallback && (
            <p style={{ margin: "0.5rem 0 0" }}>
              Mode hors ligne de secours affiché. La synchronisation réelle reprendra quand l’API sera joignable.
            </p>
          )}
        </div>
      )}
      <ul className="space-list">
        {spaces.map((space) => {
          const syncable = isSpaceSyncable(space);
          return (
            <li key={space.id} className={syncable ? "" : "space-disabled"}>
              <label>
                <input
                  type="checkbox"
                  disabled={!syncable}
                  checked={syncable && selected.includes(space.id)}
                  onChange={() => toggleSpace(space.id)}
                />
                <span className="space-name">{space.name}</span>
                <SpaceBadge space={space} />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button className="secondary" type="button" onClick={() => void loadSpaces()} disabled={loading}>
          Réessayer
        </button>
        <button onClick={onContinue} disabled={syncableSelected.length === 0}>
          Synchroniser {syncableSelected.length} espace(s)
        </button>
      </div>
    </section>
  );
}
