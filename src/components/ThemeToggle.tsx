import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/shared/useTheme"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-secondary w-full justify-start"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 flex-shrink-0" />
      ) : (
        <Sun className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="font-medium">
        {theme === "light" ? "Mode sombre" : "Mode clair"}
      </span>
    </Button>
  )
}