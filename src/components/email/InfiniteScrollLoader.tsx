import { Loader2 } from "lucide-react";

interface InfiniteScrollLoaderProps {
  isVisible: boolean;
  isLoading: boolean;
}

export function InfiniteScrollLoader({ isVisible, isLoading }: InfiniteScrollLoaderProps) {
  if (!isVisible) return <div className="h-4" />;

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
      {isLoading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm animate-pulse">Chargement des emails suivants...</p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground/70">
          Faites défiler pour charger plus d'emails
        </p>
      )}
    </div>
  );
}
