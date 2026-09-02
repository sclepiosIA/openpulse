import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Calendar,
  Users,
  Video,
  Loader2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BookingPage, BookingType, VideoProvider } from '@/types/booking';
import { VIDEO_PROVIDERS as PROVIDERS } from '@/types/booking';
import {
  useUpdateBookingPage,
  useBookingPageTypes,
  useUpdateBookingPageTypes,
  useBookingPageHosts,
  useUpdateBookingPageHosts,
} from '@/hooks/bookings/useBookings';
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles';

interface BookingPageEditDialogProps {
  page: BookingPage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allBookingTypes: BookingType[];
}

export function BookingPageEditDialog({ 
  page, 
  open, 
  onOpenChange,
  allBookingTypes 
}: BookingPageEditDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState<Partial<BookingPage>>({});
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);

  const updatePage = useUpdateBookingPage();
  const { data: pageTypes = [], isLoading: loadingTypes } = useBookingPageTypes(page?.id);
  const { data: pageHosts = [], isLoading: loadingHosts } = useBookingPageHosts(page?.id);
  const { data: allProfiles = [] } = useActiveProfilesWithRoles();
  const updateTypes = useUpdateBookingPageTypes();
  const updateHosts = useUpdateBookingPageHosts();

  // Initialiser le formulaire quand la page change
  useEffect(() => {
    if (page) {
      setFormData({
        title: page.title,
        description: page.description,
        slug: page.slug,
        welcome_message: page.welcome_message,
        is_active: page.is_active,
        require_phone: page.require_phone,
        require_company: page.require_company,
        default_video_provider: page.default_video_provider || 'jitsi',
        theme_color: page.theme_color || '#3b82f6',
      });
    }
  }, [page]);

  // Reset quand le dialog s'ouvre/ferme
  useEffect(() => {
    if (!open) {
      setSelectedTypeIds([]);
      setSelectedHostIds([]);
    }
  }, [open]);

  // Initialiser les types sélectionnés (seulement si données disponibles)
  useEffect(() => {
    if (pageTypes && pageTypes.length > 0) {
      setSelectedTypeIds(pageTypes.map(pt => pt.booking_type_id));
    }
  }, [pageTypes]);

  // Initialiser les hosts sélectionnés (seulement si données disponibles)
  useEffect(() => {
    if (pageHosts && pageHosts.length > 0) {
      setSelectedHostIds(pageHosts.map(ph => ph.user_id));
    }
  }, [pageHosts]);

  const handleSave = async () => {
    if (!page) return;

    try {
      // 1. Mettre à jour les infos générales
      await updatePage.mutateAsync({
        id: page.id,
        ...formData,
      });

      // 2. Mettre à jour les types de RDV
      await updateTypes.mutateAsync({
        pageId: page.id,
        typeIds: selectedTypeIds,
      });

      // 3. Mettre à jour les co-hosts
      await updateHosts.mutateAsync({
        pageId: page.id,
        userIds: selectedHostIds,
      });

      toast.success('Page mise à jour');
      onOpenChange(false);
    } catch (error) {
      debug.error('Error saving page:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const toggleType = (typeId: string) => {
    setSelectedTypeIds(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const toggleHost = (userId: string) => {
    setSelectedHostIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!page) return null;

  const isSaving = updatePage.isPending || updateTypes.isPending || updateHosts.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Modifier la page de réservation</DialogTitle>
          <DialogDescription>
            Configurez les types de RDV, participants et options
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Général</span>
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Types RDV</span>
            </TabsTrigger>
            <TabsTrigger value="hosts" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Participants</span>
            </TabsTrigger>
            <TabsTrigger value="visio" className="gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Visio</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4 pr-4">
            {/* Onglet Général */}
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Réservez un RDV"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/rdv/</span>
                  <Input
                    id="slug"
                    value={formData.slug || ''}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="mon-calendrier"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de la page..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome">Message d'accueil</Label>
                <Textarea
                  id="welcome"
                  value={formData.welcome_message || ''}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Bienvenue ! Choisissez un créneau..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Page active</Label>
                  <p className="text-sm text-muted-foreground">Visible publiquement</p>
                </div>
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Téléphone requis</Label>
                  <p className="text-sm text-muted-foreground">Demander le numéro de téléphone</p>
                </div>
                <Switch
                  checked={formData.require_phone ?? false}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_phone: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Entreprise requise</Label>
                  <p className="text-sm text-muted-foreground">Demander le nom de l'entreprise</p>
                </div>
                <Switch
                  checked={formData.require_company ?? false}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_company: checked })}
                />
              </div>
            </TabsContent>

            {/* Onglet Types de RDV */}
            <TabsContent value="types" className="space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Sélectionnez les types de RDV proposés sur cette page
              </p>
              
              {loadingTypes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allBookingTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTypeIds.includes(type.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleType(type.id)}
                    >
                      <Checkbox 
                        checked={selectedTypeIds.includes(type.id)}
                        onCheckedChange={() => toggleType(type.id)}
                      />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: type.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{type.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {type.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {type.duration_minutes} min
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {type.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {selectedTypeIds.length > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {selectedTypeIds.length} type(s) sélectionné(s)
                </p>
              )}
            </TabsContent>

            {/* Onglet Participants */}
            <TabsContent value="hosts" className="space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Sélectionnez les membres de l'équipe qui participent aux RDV
              </p>

              {loadingHosts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allProfiles.map((profile) => (
                    <div
                      key={profile.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedHostIds.includes(profile.user_id) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleHost(profile.user_id)}
                    >
                      <Checkbox 
                        checked={selectedHostIds.includes(profile.user_id)}
                        onCheckedChange={() => toggleHost(profile.user_id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile.prenom?.[0]}{profile.nom?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile.prenom} {profile.nom}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {profile.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {selectedHostIds.length > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {selectedHostIds.length} participant(s) sélectionné(s)
                </p>
              )}
            </TabsContent>

            {/* Onglet Visio */}
            <TabsContent value="visio" className="space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Choisissez le type de visioconférence par défaut pour les RDV
              </p>

              <div className="space-y-2">
                <Label>Provider de visioconférence</Label>
                <Select
                  value={formData.default_video_provider || 'jitsi'}
                  onValueChange={(value: VideoProvider) => 
                    setFormData({ ...formData, default_video_provider: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          {provider.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg mt-4">
                <h4 className="font-medium mb-2">À propos des providers</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Jitsi Meet</strong> : Lien instantané, pas de compte requis</li>
                  <li>• <strong>Google Meet</strong> : Nécessite intégration Google</li>
                  <li>• <strong>OpenPulse Meet</strong> : Notre solution intégrée</li>
                  <li>• <strong>Nextcloud Talk</strong> : Pour utilisateurs Nextcloud</li>
                  <li>• <strong>Teams/Zoom</strong> : Lien manuel à fournir</li>
                </ul>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
