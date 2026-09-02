import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Bug, X } from "lucide-react";
import { safeStorage } from "@/lib/safeStorage";

export function DiagnosticsOverlay() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const isDebugEnabled = import.meta.env.DEV ||
    safeStorage.getItem("debug") === "1" ||
    new URLSearchParams(window.location.search).get("debug") === "1";

  if (!isDebugEnabled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!open ? (
        <button
          aria-label="Ouvrir le diagnostic"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs shadow hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Bug className="h-3.5 w-3.5" /> Diag
        </button>
      ) : (
        <div className="w-80 rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="text-xs font-medium">Diagnostics</div>
            <button
              aria-label="Fermer le diagnostic"
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Route</span>
              <span className="font-mono">{pathname}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auth chargé</span>
              <span>{loading ? "en cours" : "ok"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Utilisateur</span>
              <span className="truncate max-w-[180px]">
                {user ? user.email ?? user.id : "aucun"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">En ligne</span>
              <span className={online ? "text-green-600" : "text-red-600"}>
                {online ? "oui" : "non"}
              </span>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <button
                onClick={() => {
                  safeStorage.clear();
                  if ("serviceWorker" in navigator) {
                    navigator.serviceWorker
                      .getRegistrations()
                      .then((registrations) => {
                        registrations.forEach((registration) =>
                          registration.unregister()
                        );
                      });
                  }
                  window.location.reload();
                }}
                className="w-full text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
              >
                Hard Reset (cache + SW)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
