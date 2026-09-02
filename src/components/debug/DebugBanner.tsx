import { useState, useEffect } from "react";
import { safeStorage } from "@/lib/safeStorage";

export function DebugBanner() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

  useEffect(() => {
    setMounted(true);
    
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    
    const onPopState = () => setCurrentRoute(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const isDebugEnabled = import.meta.env.DEV ||
    safeStorage.getItem("debug") === "1" ||
    new URLSearchParams(window.location.search).get("debug") === "1";

  if (!isDebugEnabled) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black text-xs px-2 py-1 font-mono">
      App monté: {mounted ? "✓" : "⏳"} | Online: {online ? "oui" : "non"} | Route: {currentRoute}
    </div>
  );
}