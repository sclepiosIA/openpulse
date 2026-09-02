import { useTheme } from "@/hooks/shared/useTheme"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      visibleToasts={4}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success: "group-[.toaster]:border-success/30",
          error: "group-[.toaster]:border-destructive/40",
          warning: "group-[.toaster]:border-warning/30",
          info: "group-[.toaster]:border-primary/30",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
