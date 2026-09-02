// Sidebar du shell Gestion Desktop : navigation entre modules.
// Drive reste le module par défaut ; Préférences est épinglé en bas.

import { APP_DEFINITIONS, PREFERENCES_APP } from "../apps/registry";
import type { AppId } from "../apps/registry";
import { useAppStore } from "../state/store";

function NavButton({
  id,
  icon,
  label,
  active,
  onSelect,
}: {
  id: AppId;
  icon: string;
  label: string;
  active: boolean;
  onSelect: (id: AppId) => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-item${active ? " sidebar-item-active" : ""}`}
      onClick={() => onSelect(id)}
      aria-current={active ? "page" : undefined}
    >
      <span className="sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sidebar-label">{label}</span>
    </button>
  );
}

export default function Sidebar() {
  const activeApp = useAppStore((s) => s.activeApp);
  const setActiveApp = useAppStore((s) => s.setActiveApp);

  return (
    <nav className="sidebar" aria-label="Modules Gestion Desktop">
      <div className="sidebar-brand">
        <span className="brand">Gestion Desktop</span>
        <span className="brand-sub">par OpenPulse</span>
      </div>
      <div className="sidebar-apps">
        {APP_DEFINITIONS.map((app) => (
          <NavButton
            key={app.id}
            id={app.id}
            icon={app.icon}
            label={app.label}
            active={activeApp === app.id}
            onSelect={setActiveApp}
          />
        ))}
      </div>
      <div className="sidebar-footer">
        <NavButton
          id={PREFERENCES_APP.id}
          icon={PREFERENCES_APP.icon}
          label={PREFERENCES_APP.label}
          active={activeApp === PREFERENCES_APP.id}
          onSelect={setActiveApp}
        />
      </div>
    </nav>
  );
}
