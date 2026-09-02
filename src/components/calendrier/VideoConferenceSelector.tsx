import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  VideoOff,
  Users,
  MessageSquare,
  Link,
  Copy,
  ExternalLink,
  Check,
  Zap,
  Lock,
  Loader2,
  Share2,
  Heart,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createMarqueMeetRoom } from '@/services/calendrier/marqueMeet';
import { cn } from '@/lib/utils';
import {
  VideoProvider,
  VIDEO_PROVIDERS,
  detectProviderFromUrl,
  generateRoomId,
} from '@/types/calendar';
import { useToast } from '@/hooks/shared/use-toast';
import {
  useCreateGoogleMeetLink,
  useCreateNextcloudTalkLink,
} from '@/hooks/auth/useOAuthConnections';

interface VideoConferenceSelectorProps {
  value: string;
  onChange: (url: string) => void;
  eventTitle: string;
}

const PROVIDER_ICONS = {
  VideoOff,
  Video,
  Users,
  MessageSquare,
  Link,
  Heart,
};

export function VideoConferenceSelector({
  value,
  onChange,
  eventTitle,
}: VideoConferenceSelectorProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<VideoProvider>('none');
  const [customUrl, setCustomUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreatingMarque, setIsCreatingMarque] = useState(false);

  const createGoogleMeet = useCreateGoogleMeetLink();
  const createNextcloudTalk = useCreateNextcloudTalkLink();
  
  const isCreating = createGoogleMeet.isPending || createNextcloudTalk.isPending || isCreatingMarque;

  // Détecter le provider initial depuis l'URL existante
  // Ne pas reset à 'none' pendant la création d'un lien
  // Ne pas reset si un provider est déjà sélectionné (évite de perdre l'état pendant la génération)
  useEffect(() => {
    if (isCreating) return; // Ne pas interférer pendant la création
    
    if (value) {
      const detected = detectProviderFromUrl(value);
      setProvider(detected);
      if (detected === 'custom') {
        setCustomUrl(value);
      }
    }
    // Ne PAS reset à 'none' si value est vide mais qu'un provider est sélectionné
    // Le reset se fait uniquement via handleProviderChange('none')
  }, [value, isCreating]);

  const handleProviderChange = async (newProvider: VideoProvider) => {
    const providerConfig = VIDEO_PROVIDERS.find(p => p.id === newProvider);
    
    // Handle OpenPulse Meet - internal WebRTC
    if (newProvider === 'marque') {
      setProvider(newProvider);
      setIsCreatingMarque(true);
      try {
        const room = await createMarqueMeetRoom(eventTitle || 'Réunion');
        onChange(room.link);
      } catch (error) {
        debug.error('Error creating OpenPulse Meet:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de créer la salle OpenPulse Meet',
          variant: 'destructive',
        });
        setProvider('none');
      } finally {
        setIsCreatingMarque(false);
      }
      return;
    }
    
    // Handle Google Meet - uses shared admin account
    if (newProvider === 'meet') {
      setProvider(newProvider);
      try {
        const meetLink = await createGoogleMeet.mutateAsync({ title: eventTitle || 'Réunion' });
        onChange(meetLink);
      } catch (error) {
        setProvider('none');
      }
      return;
    }
    
    // Handle Nextcloud Talk - uses shared admin account
    if (newProvider === 'nextcloud') {
      setProvider(newProvider);
      try {
        const talkLink = await createNextcloudTalk.mutateAsync({ title: eventTitle || 'Réunion' });
        onChange(talkLink);
      } catch (error) {
        setProvider('none');
      }
      return;
    }
    
    // Block Teams/Zoom (not yet implemented)
    if (newProvider === 'teams' || newProvider === 'zoom') {
      toast({
        title: 'Fonctionnalité à venir',
        description: `L'intégration ${providerConfig?.name} sera disponible prochainement.`,
      });
      return;
    }
    
    setProvider(newProvider);
    
    if (newProvider === 'none') {
      onChange('');
      setCustomUrl('');
    } else if (newProvider === 'custom') {
      onChange(customUrl);
    } else if (newProvider === 'jitsi') {
      // Générer un lien Jitsi instantanément
      if (providerConfig) {
        const roomId = generateRoomId(eventTitle || 'reunion');
        const newUrl = providerConfig.generateLink(roomId);
        onChange(newUrl);
      }
    }
  };

  const handleCustomUrlChange = (url: string) => {
    setCustomUrl(url);
    if (provider === 'custom') {
      onChange(url);
    }
  };

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: 'Lien copié !' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpen = () => {
    if (value) {
      window.open(value, '_blank', 'noopener,noreferrer');
    }
  };

  const currentProvider = VIDEO_PROVIDERS.find(p => p.id === provider);
  const IconComponent = currentProvider ? PROVIDER_ICONS[currentProvider.icon as keyof typeof PROVIDER_ICONS] : VideoOff;

  // Helper to get connection status badge
  const getProviderBadge = (p: typeof VIDEO_PROVIDERS[0]) => {
    if (p.isInstant) {
      return (
        <Badge variant="secondary" className="ml-auto text-xs bg-green-500/10 text-green-600 border-0">
          <Zap className="h-3 w-3 mr-1" />
          Instantané
        </Badge>
      );
    }
    
    // OpenPulse Meet - internal
    if (p.id === 'marque') {
      return (
        <Badge variant="secondary" className="ml-auto text-xs bg-emerald-500/10 text-emerald-600 border-0">
          <Heart className="h-3 w-3 mr-1" />
          Interne
        </Badge>
      );
    }
    
    // Google Meet and Nextcloud - shared account, always available
    if (p.id === 'meet' || p.id === 'nextcloud') {
      return (
        <Badge variant="secondary" className="ml-auto text-xs bg-blue-500/10 text-blue-600 border-0">
          <Share2 className="h-3 w-3 mr-1" />
          Partagé
        </Badge>
      );
    }
    
    if (p.id === 'teams' || p.id === 'zoom') {
      return (
        <Badge variant="outline" className="ml-auto text-xs">
          <Lock className="h-3 w-3 mr-1" />
          Bientôt
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Video className="h-4 w-4" />
        Visioconférence
        {isCreating && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
      </Label>
      
      <Select 
        value={provider} 
        onValueChange={(v) => handleProviderChange(v as VideoProvider)}
        disabled={isCreating}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: currentProvider?.color || '#6B7280' }}
              />
              <IconComponent className="h-4 w-4" />
              <span>{currentProvider?.name || 'Aucune'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background">
          {VIDEO_PROVIDERS.map((p) => {
            const Icon = PROVIDER_ICONS[p.icon as keyof typeof PROVIDER_ICONS];
            const isDisabled = (p.id === 'teams' || p.id === 'zoom');
            
            return (
              <SelectItem 
                key={p.id} 
                value={p.id}
                className={cn(isDisabled && "opacity-60")}
              >
                <div className="flex items-center gap-2 w-full">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: p.color }}
                  />
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span>{p.name}</span>
                    {p.description && (
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    )}
                  </div>
                  {getProviderBadge(p)}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Champ personnalisé si custom */}
      {provider === 'custom' && (
        <Input
          placeholder="https://votre-lien-de-reunion.com"
          value={customUrl}
          onChange={(e) => handleCustomUrlChange(e.target.value)}
        />
      )}

      {/* Affichage du lien généré */}
      {value && provider !== 'none' && provider !== 'custom' && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0" 
            style={{ backgroundColor: currentProvider?.color }}
          />
          <span className="text-sm text-muted-foreground truncate flex-1">
            {value}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleCopy} aria-label="Valider">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleOpen} aria-label="Ouvrir le lien">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {provider === 'jitsi' && value && (
        <p className="text-xs text-green-600">
          ✓ Lien Jitsi prêt à l'emploi - partageable immédiatement
        </p>
      )}
      
      {provider === 'marque' && value && (
        <p className="text-xs text-green-600">
          ✓ Salle OpenPulse Meet créée (visio interne sécurisée)
        </p>
      )}
      
      {provider === 'meet' && value && (
        <p className="text-xs text-green-600">
          ✓ Lien Google Meet créé (compte partagé)
        </p>
      )}
      
      {provider === 'nextcloud' && value && (
        <p className="text-xs text-green-600">
          ✓ Salle Nextcloud Talk créée (compte partagé)
        </p>
      )}
    </div>
  );
}
