import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTache } from '@/hooks/tasks/useCreateTache';
import { useCategories } from '@/hooks/catalogue/useCategories';
import { useActiveProfiles } from '@/hooks/profile/useProfiles';
import { useEtablissements } from '@/hooks/crm/useEtablissements';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { TaskPriority } from '@/types/gantt';

interface TaskQuickAddProps {
  defaultDate?: Date;
  defaultEtablissementId?: string;
  onSuccess?: () => void;
  /** If true, always show the form without toggle button */
  alwaysOpen?: boolean;
}

export function TaskQuickAdd({ defaultDate, defaultEtablissementId, onSuccess, alwaysOpen = false }: TaskQuickAddProps) {
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const [titre, setTitre] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [priorite, setPriorite] = useState<TaskPriority>('medium');
  const [responsableId, setResponsableId] = useState('');
  const [etablissementId, setEtablissementId] = useState(defaultEtablissementId || '');

  const createTache = useCreateTache();
  const { data: categories } = useCategories();
  const { data: profiles } = useActiveProfiles();
  const { data: etablissements } = useEtablissements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titre.trim() || !categorieId || !etablissementId) return;

    try {
      await createTache.mutateAsync({
        titre: titre.trim(),
        categorie_id: categorieId,
        etablissement_id: etablissementId,
        priorite,
        responsable_id: responsableId || undefined,
        echeance: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : undefined,
      });

      // Reset form
      setTitre('');
      setCategorieId('');
      setPriorite('medium');
      setResponsableId('');
      setEtablissementId(defaultEtablissementId || '');
      if (!alwaysOpen) {
        setIsOpen(false);
      }
      
      onSuccess?.();
    } catch (error) {
      debug.error('Error creating task:', error);
    }
  };

  if (!isOpen && !alwaysOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une tâche rapide
      </Button>
    );
  }

  // When alwaysOpen, render without Card wrapper (for use in Dialog)
  if (alwaysOpen) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Titre de la tâche *"
          value={titre}
          onChange={(e) => setTitre(e.target.value.slice(0, 255))}
          required
          maxLength={255}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-2">
          <Select value={categorieId} onValueChange={setCategorieId} required>
            <SelectTrigger>
              <SelectValue placeholder="Catégorie *" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorite} onValueChange={(v) => setPriorite(v as TaskPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="medium">Moyenne</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={etablissementId} onValueChange={setEtablissementId} required>
          <SelectTrigger>
            <SelectValue placeholder="Établissement *" />
          </SelectTrigger>
          <SelectContent>
            {etablissements?.map((etab) => (
              <SelectItem key={etab.id} value={etab.id}>
                {etab.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={responsableId || "__none__"} onValueChange={(v) => setResponsableId(v === "__none__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Responsable (optionnel)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucun</SelectItem>
            {profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.prenom} {profile.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="submit"
          disabled={createTache.isPending || !titre.trim() || !categorieId || !etablissementId}
          className="w-full"
        >
          Créer la tâche
        </Button>
      </form>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // A11y : permet de fermer le formulaire inline avec Escape (audit 28/05)
            if (e.key === 'Escape' && !alwaysOpen) {
              e.stopPropagation();
              setIsOpen(false);
            }
          }}
          className="space-y-3"
        >

          <div className="flex items-center justify-between">
            <h4 className="font-medium">Nouvelle tâche</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Input
            placeholder="Titre de la tâche *"
            value={titre}
            onChange={(e) => setTitre(e.target.value.slice(0, 255))}
            required
            maxLength={255}
          />

          <div className="grid grid-cols-2 gap-2">
            <Select value={categorieId} onValueChange={setCategorieId} required>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie *" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorite} onValueChange={(v) => setPriorite(v as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={etablissementId} onValueChange={setEtablissementId} required>
            <SelectTrigger>
              <SelectValue placeholder="Établissement *" />
            </SelectTrigger>
            <SelectContent>
              {etablissements?.map((etab) => (
                <SelectItem key={etab.id} value={etab.id}>
                  {etab.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsableId || "__none__"} onValueChange={(v) => setResponsableId(v === "__none__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Responsable (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucun</SelectItem>
              {profiles?.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.prenom} {profile.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createTache.isPending || !titre.trim() || !categorieId || !etablissementId}
              className="flex-1"
            >
              Créer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}