import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Users, 
  MessageSquare, 
  Check, 
  ExternalLink, 
  ArrowLeft,
  Share2,
  Lock,
  Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInfraUrls } from "@/hooks/shared/useAppConfig";

export default function ParametresVisioconference() {
  const navigate = useNavigate();
  const { jitsi_url } = useInfraUrls();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parametres')} aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Services de Visioconférence</h1>
          <p className="text-muted-foreground">
            Services disponibles pour créer des réunions depuis l'agenda
          </p>
        </div>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Compte partagé activé
              </p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Google Meet et Nextcloud Talk sont configurés via un compte administrateur partagé. 
                Tous les utilisateurs peuvent créer des réunions sans configuration individuelle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Services Disponibles
          </CardTitle>
          <CardDescription>
            Utilisez ces services lors de la création d'événements dans l'agenda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Jitsi Meet */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#17A3DB]/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-[#17A3DB]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Jitsi Meet</span>
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" /> Instantané
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Liens générés instantanément sur {jitsi_url.replace('https://', '')}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(jitsi_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ouvrir
            </Button>
          </div>

          {/* Google Meet */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00897B]/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-[#00897B]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Google Meet</span>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-0">
                    <Share2 className="h-3 w-3 mr-1" /> Partagé
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Créez des réunions Meet via le compte partagé
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Check className="h-3 w-3 mr-1" /> Disponible
            </Badge>
          </div>

          {/* Nextcloud Talk */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#0082C9]/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#0082C9]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Nextcloud Talk</span>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-0">
                    <Share2 className="h-3 w-3 mr-1" /> Partagé
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Créez des salles Talk via le compte partagé
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Check className="h-3 w-3 mr-1" /> Disponible
            </Badge>
          </div>

          {/* Microsoft Teams - Coming soon */}
          <div className="flex items-center justify-between p-4 border rounded-lg opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#6264A7]/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-[#6264A7]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Microsoft Teams</span>
                  <Badge variant="outline">
                    <Lock className="h-3 w-3 mr-1" /> Bientôt
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Intégration avec Microsoft 365
                </p>
              </div>
            </div>
          </div>

          {/* Zoom - Coming soon */}
          <div className="flex items-center justify-between p-4 border rounded-lg opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#2D8CFF]/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-[#2D8CFF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Zoom</span>
                  <Badge variant="outline">
                    <Lock className="h-3 w-3 mr-1" /> Bientôt
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Créez des réunions Zoom
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
