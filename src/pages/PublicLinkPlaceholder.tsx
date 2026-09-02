import { Link2 } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
}

export default function PublicLinkPlaceholder({
  title = "Lien spécifique requis",
  description = "Cette page nécessite un identifiant fourni par votre interlocuteur OpenPulse Merci d'utiliser le lien complet qui vous a été transmis.",
}: Props) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Link2 className="w-6 h-6 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <a
          href="https://exploitant.example.org"
          className="inline-block text-sm text-primary hover:underline"
        >
          Retour au site OpenPulse
        </a>
      </div>
    </main>
  );
}
