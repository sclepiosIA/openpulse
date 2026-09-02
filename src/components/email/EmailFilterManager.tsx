import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/shared/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface EmailFilter {
  id: string;
  name: string;
  description: string | null;
  conditions: any;
  actions: any;
  is_active: boolean;
  priority: number;
}

export function EmailFilterManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditionField, setConditionField] = useState("from");
  const [conditionOperator, setConditionOperator] = useState("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("add_tag");
  const [actionValue, setActionValue] = useState("");
  const [priority, setPriority] = useState(0);

  const { data: filters, isLoading } = useQuery({
    queryKey: ['email-filters'],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from('email_filters')
        .select('id, profile_id, name, description, conditions, actions, priority, is_active, created_at, updated_at')
        .eq('profile_id', profile.id)
        .order('priority', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as EmailFilter[];
    },
  });

  const createFilter = useMutation({
    mutationFn: async (filter: Omit<EmailFilter, 'id'>) => {
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from('email_filters')
        .insert({
          name: filter.name,
          description: filter.description,
          conditions: filter.conditions,
          actions: filter.actions,
          is_active: filter.is_active,
          priority: filter.priority,
          profile_id: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Règle créée", description: "La règle de filtrage a été créée avec succès" });
      queryClient.invalidateQueries({ queryKey: ['email-filters'] });
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const updateFilter = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailFilter> & { id: string }) => {
      const { error } = await supabase
        .from('email_filters')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Règle mise à jour", description: "La règle a été modifiée avec succès" });
      queryClient.invalidateQueries({ queryKey: ['email-filters'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const deleteFilter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_filters')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Règle supprimée", description: "La règle a été supprimée avec succès" });
      queryClient.invalidateQueries({ queryKey: ['email-filters'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setConditionField("from");
    setConditionOperator("contains");
    setConditionValue("");
    setActionType("add_tag");
    setActionValue("");
    setPriority(0);
    setEditingFilter(null);
  };

  const handleSave = () => {
    const filterData = {
      name,
      description: description || null,
      conditions: {
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue,
      },
      actions: {
        type: actionType,
        value: actionValue,
      },
      priority,
      is_active: true,
    };

    if (editingFilter) {
      updateFilter.mutate({ id: editingFilter.id, ...filterData });
    } else {
      createFilter.mutate(filterData as any);
    }
  };

  const handleToggleActive = (filter: EmailFilter) => {
    updateFilter.mutate({ id: filter.id, is_active: !filter.is_active });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Règles de filtrage automatique</h3>
          <p className="text-sm text-muted-foreground">
            Automatisez le traitement de vos emails avec des règles personnalisées
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle règle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingFilter ? "Modifier la règle" : "Créer une règle de filtrage"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la règle</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Marquer les urgences"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de la règle..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={conditionField} onValueChange={setConditionField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="from">De</SelectItem>
                      <SelectItem value="to">À</SelectItem>
                      <SelectItem value="subject">Sujet</SelectItem>
                      <SelectItem value="body">Corps</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={conditionOperator} onValueChange={setConditionOperator}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contient</SelectItem>
                      <SelectItem value="equals">Égal à</SelectItem>
                      <SelectItem value="starts_with">Commence par</SelectItem>
                      <SelectItem value="ends_with">Se termine par</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="Valeur..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add_tag">Ajouter un tag</SelectItem>
                      <SelectItem value="archive">Archiver</SelectItem>
                      <SelectItem value="mark_spam">Marquer spam</SelectItem>
                      <SelectItem value="assign_etablissement">Assigner établissement</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Valeur de l'action..."
                    disabled={actionType === "archive" || actionType === "mark_spam"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priorité (0-100)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={!name || !conditionValue}>
                {editingFilter ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Chargement...</p>
      ) : filters && filters.length > 0 ? (
        <div className="grid gap-4">
          {filters.map((filter) => (
            <Card key={filter.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{filter.name}</CardTitle>
                      {filter.is_active ? (
                        <Badge variant="default">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                      <Badge variant="outline">Priorité: {filter.priority}</Badge>
                    </div>
                    {filter.description && (
                      <CardDescription className="mt-1">{filter.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Switch
                      checked={filter.is_active}
                      onCheckedChange={() => handleToggleActive(filter)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingFilter(filter);
                        setName(filter.name);
                        setDescription(filter.description || "");
                        setConditionField(filter.conditions.field);
                        setConditionOperator(filter.conditions.operator);
                        setConditionValue(filter.conditions.value);
                        setActionType(filter.actions.type);
                        setActionValue(filter.actions.value || "");
                        setPriority(filter.priority);
                        setIsCreateOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFilter.mutate(filter.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Si:</span> {filter.conditions.field}{" "}
                    {filter.conditions.operator} "{filter.conditions.value}"
                  </p>
                  <p>
                    <span className="font-medium">Alors:</span> {filter.actions.type}
                    {filter.actions.value && ` "${filter.actions.value}"`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune règle de filtrage configurée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Créez votre première règle pour automatiser le traitement de vos emails
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
