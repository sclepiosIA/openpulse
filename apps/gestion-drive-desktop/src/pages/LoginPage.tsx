// Connexion Drive par la session Gestion déjà validée en MFA dans la PWA.

import { useState } from "react";

interface LoginPageProps {
  onUseGestionSession: () => Promise<void>;
}

export default function LoginPage({
  onUseGestionSession: reconnectWithGestionSession,
}: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUseGestionSession() {
    setError(null);
    setBusy(true);
    try {
      await reconnectWithGestionSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>Connexion</h1>
      <p className="muted">
        Connectez-vous avec votre compte Gestion. Vos espaces et droits d’accès seront chargés depuis Gestion Drive.
      </p>
      <p className="muted">
        L’authentification multifacteur est validée dans Gestion avant l’émission d’un jeton Drive
        dédié. Aucun mot de passe n’est transmis au client natif.
      </p>
      <div className="actions">
        <button type="button" onClick={handleUseGestionSession} disabled={busy}>
          {busy ? "Connexion…" : "Utiliser la session Gestion"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
