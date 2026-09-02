/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de Gestion web (défaut : https://espace.exploitant.example.org). */
  readonly VITE_OPENPULSE_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
