import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";
import { usePeopleData } from "@/hooks/hr/usePeopleData";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TYPES_ABSENCE = [
  { value: 'Congés payés', label: 'Congés payés', color: 'bg-blue-500' },
  { value: 'Congé maladie', label: 'Congé maladie', color: 'bg-red-500' },
  { value: 'RTT', label: 'RTT', color: 'bg-green-500' },
  { value: 'Formation', label: 'Formation', color: 'bg-purple-500' },
  { value: 'Autre', label: 'Autre', color: 'bg-gray-500' },
];

const STATUTS = [
  { value: 'En attente', label: 'En attente' },
  { value: 'Validé', label: 'Validé' },
  { value: 'Refusé', label: 'Refusé' },
];

/** Type pour une absence sélectionnée dans le formulaire */
interface SelectedAbsence {
  id: string;
  profile_id: string;
  date_debut: string;
  date_fin: string;
  type_absence: string;
  motif?: string | null;
  statut: string;
}

export function RHPlanningAbsencesVisuel() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProfile, setFilterProfile] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<SelectedAbsence | null>(null);

  const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

  const { absences, isLoading, createAbsence, updateAbsence, deleteAbsence } = useRHAbsences(undefined, startDate, endDate);
  const { profiles } = usePeopleData();

  // Filtrer les absences
  const filteredAbsences = useMemo(() => {
    if (!absences) return [];
    
    return absences.filter(absence => {
      if (filterType !== 'all' && absence.type_absence !== filterType) return false;
      if (filterStatus !== 'all' && absence.statut !== filterStatus) return false;
      if (filterProfile !== 'all' && absence.profile_id !== filterProfile) return false;
      return true;
    });
  }, [absences, filterType, filterStatus, filterProfile]);

  // Identifier les dates avec absences pour le calendrier
  const datesWithAbsences = useMemo(() => {
    if (!filteredAbsences) return new Set<string>();
    
    const dates = new Set<string>();
    filteredAbsences.forEach(absence => {
      const start = new Date(absence.date_debut);
      const end = new Date(absence.date_fin);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.add(format(d, 'yyyy-MM-dd'));
      }
    });
    
    return dates;
  }, [filteredAbsences]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!absences) return { total: 0, enAttente: 0, valide: 0, thisMonth: 0 };
    
    return {
      total: absences.length,
      enAttente: absences.filter(a => a.statut === 'En attente').length,
      valide: absences.filter(a => a.statut === 'Validé').length,
      thisMonth: absences.filter(a => {
        const start = new Date(a.date_debut);
        return start.getMonth() === selectedDate.getMonth() && 
               start.getFullYear() === selectedDate.getFullYear();
      }).length,
    };
  }, [absences, selectedDate]);

  const getTypeColor = (type: string) => {
    const typeConfig = TYPES_ABSENCE.find(t => t.value === type);
    return typeConfig?.color || 'bg-gray-500';
  };

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, "default" | "destructive"> = {
      'En attente': 'default',
      'Validé': 'default',
      'Refusé': 'destructive',
    };
    return <Badge variant={variants[statut] || 'default'}>{statut}</Badge>;
  };

  const calculateDays = (dateDebut: string, dateFin: string) => {
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  /** Données du formulaire d'absence */
  interface AbsenceFormData {
    profile_id: string;
    date_debut: string;
    date_fin: string;
    type_absence: string;
    motif: string;
    statut: string;
  }

  const handleCreateOrUpdate = async (data: AbsenceFormData) => {
    try {
      if (selectedAbsence) {
        await updateAbsence({ id: selectedAbsence.id, ...data });
        toast.success("Absence mise à jour");
      } else {
        await createAbsence(data);
        toast.success("Absence créée");
      }
      setDialogOpen(false);
      setSelectedAbsence(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        debug.error(error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer cette absence ?")) {
      try {
        await deleteAbsence(id);
        toast.success("Absence supprimée");
      } catch (error) {
        if (import.meta.env.DEV) {
          debug.error(error);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planning des absences</CardTitle>
          <CardDescription>Gestion des congés et absences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={`rh-planning-skeleton-${i}`} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total absences</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.enAttente}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.valide}</p>
              <p className="text-sm text-muted-foreground">Validées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.thisMonth}</p>
              <p className="text-sm text-muted-foreground">Ce mois-ci</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <Select value={filterProfile} onValueChange={setFilterProfile}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Tous les collaborateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {profiles?.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.prenom} {profile.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Type d'absence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {TYPES_ABSENCE.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {STATUTS.map(statut => (
                    <SelectItem key={statut.value} value={statut.value}>
                      {statut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedAbsence(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Demander une absence
                </Button>
              </DialogTrigger>
              <DialogContent>
                <AbsenceForm
                  profiles={profiles || []}
                  absence={selectedAbsence}
                  onSubmit={handleCreateOrUpdate}
                  onCancel={() => {
                    setDialogOpen(false);
                    setSelectedAbsence(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Calendrier et liste */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendrier */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendrier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={fr}
              className="rounded-md border"
              modifiers={{
                hasAbsence: (date) => datesWithAbsences.has(format(date, 'yyyy-MM-dd'))
              }}
              modifiersStyles={{
                hasAbsence: {
                  fontWeight: 'bold',
                  backgroundColor: 'hsl(var(--primary) / 0.1)',
                }
              }}
            />
            
            {/* Légende */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Légende :</p>
              {TYPES_ABSENCE.map(type => (
                <div key={type.value} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                  <span className="text-sm">{type.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Liste des absences */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Absences du mois</CardTitle>
            <CardDescription>
              {format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAbsences && filteredAbsences.length > 0 ? (
                filteredAbsences.map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {absence.profiles?.prenom} {absence.profiles?.nom}
                        </p>
                        <Badge className={`${getTypeColor(absence.type_absence)} text-white`}>
                          {absence.type_absence}
                        </Badge>
                        {getStatusBadge(absence.statut)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Du {format(new Date(absence.date_debut), 'dd MMM', { locale: fr })} 
                        {' '}au {format(new Date(absence.date_fin), 'dd MMM yyyy', { locale: fr })}
                        {' '}• {calculateDays(absence.date_debut, absence.date_fin)} jour(s)
                      </p>
                      {absence.motif && (
                        <p className="text-sm text-muted-foreground italic">
                          {absence.motif}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {absence.statut === 'En attente' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAbsence({ id: absence.id, statut: 'Validé' })}
                          >
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAbsence({ id: absence.id, statut: 'Refusé' })}
                          >
                            Refuser
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedAbsence(absence);
                          setDialogOpen(true);
                        }}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(absence.id)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune absence pour cette période
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Props du formulaire d'absence */
interface AbsenceFormProps {
  profiles: Array<{ id: string; prenom?: string; nom?: string }>;
  absence: SelectedAbsence | null;
  onSubmit: (data: { profile_id: string; date_debut: string; date_fin: string; type_absence: string; motif: string; statut: string }) => void;
  onCancel: () => void;
}

// Formulaire de création/édition d'absence
function AbsenceForm({ profiles, absence, onSubmit, onCancel }: AbsenceFormProps) {
  const [formData, setFormData] = useState({
    profile_id: absence?.profile_id || '',
    date_debut: absence?.date_debut || '',
    date_fin: absence?.date_fin || '',
    type_absence: absence?.type_absence || 'Congés payés',
    motif: absence?.motif || '',
    statut: absence?.statut || 'En attente',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{absence ? 'Modifier l\'absence' : 'Demander une absence'}</DialogTitle>
        <DialogDescription>
          Remplissez les informations de l'absence
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="profile">Collaborateur</Label>
          <Select
            value={formData.profile_id}
            onValueChange={(value) => setFormData({ ...formData, profile_id: value })}
          >
            <SelectTrigger id="profile">
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.prenom} {profile.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_debut">Date de début</Label>
            <Input
              id="date_debut"
              type="date"
              value={formData.date_debut}
              onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_fin">Date de fin</Label>
            <Input
              id="date_fin"
              type="date"
              value={formData.date_fin}
              onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type d'absence</Label>
          <Select
            value={formData.type_absence}
            onValueChange={(value) => setFormData({ ...formData, type_absence: value })}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES_ABSENCE.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motif">Motif (optionnel)</Label>
          <Textarea
            id="motif"
            value={formData.motif}
            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
            placeholder="Raison de l'absence..."
            rows={3}
          />
        </div>

        {absence && (
          <div className="space-y-2">
            <Label htmlFor="statut">Statut</Label>
            <Select
              value={formData.statut}
              onValueChange={(value) => setFormData({ ...formData, statut: value })}
            >
              <SelectTrigger id="statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUTS.map(statut => (
                  <SelectItem key={statut.value} value={statut.value}>
                    {statut.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">
          {absence ? 'Mettre à jour' : 'Créer'}
        </Button>
      </DialogFooter>
    </form>
  );
}
