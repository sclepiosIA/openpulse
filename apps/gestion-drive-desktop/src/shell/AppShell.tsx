// Shell Gestion Desktop : sidebar de modules + zone de contenu.
// Drive est le module natif ; les autres sont des placeholders reliés
// à Gestion web en attendant leur intégration (plan §4 phase 1).

import Sidebar from "./Sidebar";
import NotificationCenter from "./NotificationCenter";
import DriveApp from "../apps/DriveApp";
import PlaceholderApp from "../apps/PlaceholderApp";
import PreferencesApp from "../apps/PreferencesApp";
import { getAppDefinition } from "../apps/registry";
import { useAppStore } from "../state/store";

export default function AppShell() {
  const activeApp = useAppStore((s) => s.activeApp);

  return (
    <div className="shell">
      <Sidebar />
      <main className="shell-content">
        <div className="shell-topbar">
          <NotificationCenter />
        </div>
        {activeApp === "drive" && <DriveApp />}
        {activeApp === "preferences" && <PreferencesApp />}
        {activeApp !== "drive" && activeApp !== "preferences" && (
          <PlaceholderApp app={getAppDefinition(activeApp)} />
        )}
      </main>
    </div>
  );
}
