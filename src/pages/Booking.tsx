import { useState } from 'react'
import { useAuth } from '@/hooks/shared/useAuth'
import { PageDataState } from '@/components/common/PageDataState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import {
  Calendar,
  Clock,
  Plus,
  Settings,
  Link2,
  Copy,
  ExternalLink,
  Video,
  Phone,
  MapPin,
  Edit,
  Check,
  X,
  CalendarDays,
  CalendarCheck,
  BarChart3,
} from 'lucide-react'
import { format, addDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  useBookingTypes,
  useBookingPages,
  useBookingAvailabilitySlots,
  useUpcomingBookings,
  useBookings,
  useCreateBookingPage,
  useCreateAvailabilitySlot,
  useDeleteAvailabilitySlot,
  useUpdateBookingStatus,
} from '@/hooks/bookings/useBookings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { BookingPageEditDialog } from '@/components/booking/BookingPageEditDialog'
import { BookingActionsMenu } from '@/components/booking/BookingActionsMenu'
import type { BookingPage } from '@/types/booking'
import { cn } from '@/lib/utils'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' },
]

const STATUS_CONFIG = {
  pending: {
    label: 'En attente',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  confirmed: {
    label: 'Confirmé',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  cancelled: { label: 'Annulé', color: 'bg-destructive/10 text-destructive' },
  completed: { label: 'Terminé', color: 'bg-primary/10 text-primary' },
  no_show: { label: 'Absent', color: 'bg-muted text-muted-foreground' },
}

// Composant PageCard pour afficher une page de réservation
function PageCard({
  page,
  onCopyLink,
  onEdit,
}: {
  page: BookingPage
  onCopyLink: (slug: string) => void
  onEdit: () => void
}) {
  return (
    <div className="p-4 border rounded-xl bg-card/50 backdrop-blur-sm border-primary/10 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{page.title}</h3>
            <Badge variant={page.is_active ? 'default' : 'secondary'} className="rounded-full">
              {page.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{page.description}</p>
          <p className="text-sm font-mono mt-1 text-primary">/rdv/{page.slug}</p>

          {/* Infos supplémentaires */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              {page.default_video_provider || 'jitsi'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onCopyLink(page.slug)}
            title="Copier le lien"
            className="rounded-lg"
            aria-label="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => window.open(`/rdv/${page.slug}`, '_blank')}
            title="Ouvrir"
            className="rounded-lg"
            aria-label="Ouvrir le lien"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            title="Modifier"
            className="rounded-lg"
            aria-label="Modifier"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useIsMobile } from '@/hooks/ui/use-mobile'
import { BookingMobileHeader } from '@/components/booking/BookingMobileHeader'

interface BookingProps {
  isPWAMode?: boolean
}

export default function Booking({ isPWAMode = false }: BookingProps) {
  const { loading: authLoading } = useAuth()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [createPageOpen, setCreatePageOpen] = useState(false)
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [editingPage, setEditingPage] = useState<BookingPage | null>(null)
  const { data: bookingTypes = [] } = useBookingTypes(false)
  const { data: bookingPages = [] } = useBookingPages()
  const { data: availabilitySlots = [] } = useBookingAvailabilitySlots()
  const { data: upcomingBookings = [] } = useUpcomingBookings()
  const { data: allBookings = [] } = useBookings()
  const createPage = useCreateBookingPage()
  const createSlot = useCreateAvailabilitySlot()
  const deleteSlot = useDeleteAvailabilitySlot()
  const updateStatus = useUpdateBookingStatus()
  const [newPage, setNewPage] = useState({ slug: '', title: '', description: '' })
  const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '09:00', end_time: '18:00' })

  if (authLoading) {
    return (
      <PageDataState isLoading={true} isError={false}>
        <></>
      </PageDataState>
    )
  }

  const handleCreatePage = async () => {
    if (!newPage.slug || !newPage.title) {
      toast.error('Slug et titre requis')
      return
    }
    await createPage.mutateAsync({
      slug: newPage.slug.toLowerCase().replace(/\s+/g, '-'),
      title: newPage.title,
      description: newPage.description,
    })
    setNewPage({ slug: '', title: '', description: '' })
    setCreatePageOpen(false)
  }

  const handleCreateSlot = async () => {
    await createSlot.mutateAsync(newSlot)
    setAddSlotOpen(false)
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/rdv/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié !')
  }

  // Stats
  const pendingCount = allBookings.filter((b) => b.status === 'pending').length
  const confirmedCount = allBookings.filter((b) => b.status === 'confirmed').length
  const thisWeekCount = allBookings.filter((b) => {
    const start = parseISO(b.start_time)
    const now = new Date()
    const weekEnd = addDays(now, 7)
    return start >= now && start <= weekEnd
  }).length
  const activePagesCount = bookingPages.filter((p) => p.is_active).length

  const headerActions = (
    <div className="flex gap-2">
      <Dialog open={createPageOpen} onOpenChange={setCreatePageOpen}>
        <DialogTrigger asChild>
          <Button className="h-9 gap-2 bg-card text-primary hover:bg-card/90 rounded-lg shadow-md">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle page</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une page de réservation</DialogTitle>
            <DialogDescription>
              Créez une page publique pour permettre aux clients de réserver
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Slug (URL)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">/rdv/</span>
                <Input
                  value={newPage.slug}
                  onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                  placeholder="mon-calendrier"
                  className="rounded-lg"
                />
              </div>
            </div>
            <div>
              <Label>Titre</Label>
              <Input
                value={newPage.title}
                onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                placeholder="Réservez un RDV avec moi"
                className="rounded-lg"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newPage.description}
                onChange={(e) => setNewPage({ ...newPage, description: e.target.value })}
                placeholder="Choisissez un créneau qui vous convient..."
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatePageOpen(false)}
              className="rounded-lg"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreatePage}
              disabled={createPage.isPending}
              className="rounded-lg"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  const handleSearchClick = () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    document.dispatchEvent(event)
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-gradient-page">
      {/* Header - Mobile vs Desktop */}
      {isMobile ? (
        <BookingMobileHeader
          stats={{ pending: pendingCount, confirmed: confirmedCount, thisWeek: thisWeekCount }}
          onSearchClick={handleSearchClick}
          onCreatePage={() => setCreatePageOpen(true)}
          showGlobalNav={!isPWAMode}
        />
      ) : (
        <ImmersivePageHeader
          title="Prise de RDV"
          subtitle="Gérez vos créneaux et réservations"
          icon={CalendarCheck}
          stats={[
            { label: 'attente', value: pendingCount },
            { label: 'confirmés', value: confirmedCount, highlight: true },
            { label: 'semaine', value: thisWeekCount },
          ]}
          searchPlaceholder="Rechercher un RDV..."
          onSearchClick={handleSearchClick}
          actions={headerActions}
          variant="compact"
        />
      )}

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* KPIs - Premium style - compact on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="rounded-xl border-t-4 border-t-amber-500 bg-card/80 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-3 pb-2 md:pt-4 md:pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">En attente</p>
                  <p className="text-xl md:text-2xl font-bold">{pendingCount}</p>
                </div>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-t-4 border-t-emerald-500 bg-card/80 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-3 pb-2 md:pt-4 md:pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Confirmés</p>
                  <p className="text-xl md:text-2xl font-bold">{confirmedCount}</p>
                </div>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Check className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-t-4 border-t-blue-500 bg-card/80 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-3 pb-2 md:pt-4 md:pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                  <p className="text-xl md:text-2xl font-bold">{thisWeekCount}</p>
                </div>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-t-4 border-t-primary bg-card/80 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-3 pb-2 md:pt-4 md:pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pages actives</p>
                  <p className="text-xl md:text-2xl font-bold">{activePagesCount}</p>
                </div>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Link2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60 backdrop-blur-sm border border-primary/10 rounded-xl p-1">
            <TabsTrigger
              value="dashboard"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Tableau de bord</span>
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Réservations</span>
            </TabsTrigger>
            <TabsTrigger
              value="availability"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Disponibilités</span>
            </TabsTrigger>
            <TabsTrigger
              value="pages"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Link2 className="h-4 w-4" />
              Pages
            </TabsTrigger>
            <TabsTrigger
              value="types"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Types</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prochains RDV */}
              <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prochains RDV</CardTitle>
                  <CardDescription>Vos rendez-vous à venir</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {upcomingBookings.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Aucun RDV à venir</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="p-4 border rounded-xl bg-card/50 border-primary/10 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{booking.guest_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {booking.guest_email}
                                </p>
                              </div>
                              <Badge
                                className={cn(
                                  'rounded-full',
                                  STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG]?.color
                                )}
                              >
                                {STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG]?.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(parseISO(booking.start_time), 'PPP', { locale: fr })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {format(parseISO(booking.start_time), 'HH:mm')}
                              </span>
                            </div>
                            {booking.booking_type && (
                              <Badge variant="outline" className="rounded-full">
                                {booking.booking_type.name}
                              </Badge>
                            )}
                            <div className="pt-2 flex justify-end">
                              <BookingActionsMenu booking={booking as any} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Pages de réservation */}
              <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pages de réservation</CardTitle>
                  <CardDescription>Vos liens de réservation publics</CardDescription>
                </CardHeader>
                <CardContent>
                  {bookingPages.length === 0 ? (
                    <div className="text-center py-8">
                      <Link2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Aucune page créée</p>
                      <Button onClick={() => setCreatePageOpen(true)} className="rounded-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Créer une page
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookingPages.map((page) => (
                        <div
                          key={page.id}
                          className="p-4 border rounded-xl bg-card/50 border-primary/10"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{page.title}</p>
                              <p className="text-sm text-muted-foreground">/rdv/{page.slug}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => copyLink(page.slug)}
                                className="rounded-lg"
                                aria-label="Copier"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => window.open(`/rdv/${page.slug}`, '_blank')}
                                className="rounded-lg"
                                aria-label="Ouvrir le lien"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant={page.is_active ? 'default' : 'secondary'}
                              className="rounded-full"
                            >
                              {page.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="mt-4">
            <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Toutes les réservations</CardTitle>
                <CardDescription>Historique complet des réservations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {allBookings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune réservation</p>
                  ) : (
                    <div className="space-y-3">
                      {allBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-4 border rounded-xl bg-card/50 border-primary/10 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{booking.guest_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {booking.guest_email}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                className={cn(
                                  'rounded-full',
                                  STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG]?.color
                                )}
                              >
                                {STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG]?.label}
                              </Badge>
                              <BookingActionsMenu booking={booking as any} />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(parseISO(booking.start_time), 'PPP', { locale: fr })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(parseISO(booking.start_time), 'HH:mm')}
                            </span>
                          </div>
                          {booking.booking_type && (
                            <Badge variant="outline" className="rounded-full">
                              {booking.booking_type.name}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Availability Tab */}
          <TabsContent value="availability" className="mt-4">
            <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Disponibilités</CardTitle>
                    <CardDescription>Définissez vos créneaux disponibles</CardDescription>
                  </div>
                  <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un créneau
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajouter un créneau</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Jour</Label>
                          <Select
                            value={String(newSlot.day_of_week)}
                            onValueChange={(v) =>
                              setNewSlot({ ...newSlot, day_of_week: parseInt(v) })
                            }
                          >
                            <SelectTrigger className="rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day) => (
                                <SelectItem key={day.value} value={String(day.value)}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Début</Label>
                            <Input
                              type="time"
                              value={newSlot.start_time}
                              onChange={(e) =>
                                setNewSlot({ ...newSlot, start_time: e.target.value })
                              }
                              className="rounded-lg"
                            />
                          </div>
                          <div>
                            <Label>Fin</Label>
                            <Input
                              type="time"
                              value={newSlot.end_time}
                              onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                              className="rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setAddSlotOpen(false)}
                          className="rounded-lg"
                        >
                          Annuler
                        </Button>
                        <Button
                          onClick={handleCreateSlot}
                          disabled={createSlot.isPending}
                          className="rounded-lg"
                        >
                          Ajouter
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {availabilitySlots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun créneau défini</p>
                ) : (
                  <div className="space-y-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const daySlots = availabilitySlots.filter((s) => s.day_of_week === day.value)
                      if (daySlots.length === 0) return null
                      return (
                        <div
                          key={day.value}
                          className="flex items-center gap-4 p-3 border rounded-xl bg-card/50 border-primary/10"
                        >
                          <span className="font-medium w-24">{day.label}</span>
                          <div className="flex flex-wrap gap-2">
                            {daySlots.map((slot) => (
                              <Badge key={slot.id} variant="outline" className="gap-2 rounded-full">
                                {slot.start_time} - {slot.end_time}
                                <button
                                  onClick={() => deleteSlot.mutate(slot.id)}
                                  className="hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="mt-4">
            <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pages de réservation</CardTitle>
                    <CardDescription>Créez et gérez vos pages publiques</CardDescription>
                  </div>
                  <Button onClick={() => setCreatePageOpen(true)} className="rounded-lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvelle page
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bookingPages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucune page créée</p>
                ) : (
                  <div className="space-y-3">
                    {bookingPages.map((page) => (
                      <PageCard
                        key={page.id}
                        page={page}
                        onCopyLink={copyLink}
                        onEdit={() => setEditingPage(page)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Types Tab */}
          <TabsContent value="types" className="mt-4">
            <Card className="rounded-xl border-primary/10 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Types de RDV</CardTitle>
                <CardDescription>Configurez les différents types de rendez-vous</CardDescription>
              </CardHeader>
              <CardContent>
                {bookingTypes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun type de RDV configuré
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bookingTypes.map((type) => (
                      <div
                        key={type.id}
                        className="p-4 border rounded-xl bg-card/50 border-primary/10"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: type.color || '#3B82F6' }}
                              />
                              <p className="font-medium">{type.name}</p>
                              <Badge
                                variant={type.is_active ? 'default' : 'secondary'}
                                className="rounded-full"
                              >
                                {type.is_active ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {type.duration_minutes} min
                              </span>
                              <span className="flex items-center gap-1">
                                {type.location_type === 'video' && <Video className="h-3 w-3" />}
                                {type.location_type === 'phone' && <Phone className="h-3 w-3" />}
                                {type.location_type === 'in_person' && (
                                  <MapPin className="h-3 w-3" />
                                )}
                                {type.location_type || 'video'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Page Dialog */}
      {editingPage && (
        <BookingPageEditDialog
          page={editingPage}
          open={!!editingPage}
          onOpenChange={(open) => !open && setEditingPage(null)}
          allBookingTypes={bookingTypes}
        />
      )}
    </div>
  )
}
