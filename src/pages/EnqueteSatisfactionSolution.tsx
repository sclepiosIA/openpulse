import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/**
 * Ancienne page d'enquête publique sans token.
 * Remplacée par les nouvelles enquêtes tokenisées (/enquete/satisfaction/:token).
 * Cette page redirige vers le dashboard d'enquêtes pour permettre au CSM de générer un lien.
 */
export default function EnqueteSatisfactionSolution() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      // Compat ascendante : si un ancien lien arrive avec ?token=…
      navigate(`/enquete/satisfaction/${token}`, { replace: true });
    }
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-bold">Enquête de satisfaction</h2>
          <p className="text-muted-foreground text-sm">
            Cette page nécessite un lien personnel envoyé par votre Customer Success Manager.
            Si vous avez reçu un email d'invitation, cliquez sur le bouton qu'il contient.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
