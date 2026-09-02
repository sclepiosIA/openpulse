import { useEffect, useState } from "react"
import { safeStorage } from "@/lib/safeStorage"

// Dark mode désactivé - type conservé pour compatibilité mais toujours "light"
type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(theme)
}

// Initialiser le thème dès le chargement du script (toujours light)
if (typeof window !== "undefined") {
  applyTheme("light")
}

export function useTheme() {
  // Toujours "light" - dark mode désactivé
  const [theme] = useState<Theme>("light")

  useEffect(() => {
    // Appliquer le thème au document (toujours light)
    applyTheme("light")
    
    // Sauvegarder dans localStorage
    safeStorage.setItem("theme", "light")
  }, [])

  // toggleTheme et setTheme ne font rien - dark mode désactivé
  const toggleTheme = () => {
    // No-op: dark mode is disabled
  }

  const setTheme = (_theme: Theme) => {
    // No-op: dark mode is disabled
  }

  return {
    theme,
    setTheme,
    toggleTheme
  }
}
