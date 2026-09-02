// Badge de politique de sync / sensibilité d'un espace.

import type { Space } from "../api/types";

export default function SpaceBadge({ space }: { space: Space }) {
  if (space.sync_policy === "web_only") {
    return <span className="badge badge-weblonly">web uniquement</span>;
  }
  if (space.sensitivity === "hds" || space.sensitivity === "dpo_restricted") {
    return <span className="badge badge-sensitive">sensible</span>;
  }
  if (space.sensitivity === "sensitive") {
    return <span className="badge badge-sensitive">sensible</span>;
  }
  return <span className="badge">{space.space_type}</span>;
}
