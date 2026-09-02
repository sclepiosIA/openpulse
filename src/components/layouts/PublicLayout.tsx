import logo from "@/assets/marque/logo.png";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Header minimaliste */}
      

      
      
      {/* Contenu principal */}
      <main className="flex-1 w-full">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-muted py-4 px-6 text-center text-sm text-muted-foreground border-t">
        © 2025 OpenPulse - Tous droits réservés
      </footer>
    </div>);

}