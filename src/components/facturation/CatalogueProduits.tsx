import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  Check,
  X,
} from "lucide-react";
import { useCatalogueProduits } from "@/hooks/catalogue/useCatalogueProduits";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PRODUIT_TYPE_LABELS } from "@/types/facturation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CatalogueProduit } from "@/types/ui-states";

const produitSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  type: z.enum(['service', 'produit', 'licence', 'formation', 'maintenance']),
  prix_unitaire_ht: z.number().min(0, "Le prix doit être positif"),
  taux_tva: z.number().min(0).max(100),
  unite: z.string().default("unité"),
  est_actif: z.boolean().default(true),
});

type ProduitFormData = z.infer<typeof produitSchema>;

export function CatalogueProduits() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduit, setEditingProduit] = useState<CatalogueProduit | null>(null);
  const [deletingProduitId, setDeletingProduitId] = useState<string | null>(null);

  const { 
    produits, 
    createProduit, 
    updateProduit, 
    deleteProduit,
    isCreating,
    isUpdating,
    isDeleting 
  } = useCatalogueProduits();

  const form = useForm<ProduitFormData>({
    resolver: zodResolver(produitSchema),
    defaultValues: {
      code: "",
      nom: "",
      description: "",
      type: "service",
      prix_unitaire_ht: 0,
      taux_tva: 20,
      unite: "unité",
      est_actif: true,
    },
  });

  const filteredProduits = produits.filter(p => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        p.code.toLowerCase().includes(searchLower) ||
        p.nom.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const openEditForm = (produit: CatalogueProduit) => {
    setEditingProduit(produit);
    form.reset({
      code: produit.code,
      nom: produit.nom,
      description: produit.description || "",
      type: produit.type,
      prix_unitaire_ht: produit.prix_unitaire_ht,
      taux_tva: produit.taux_tva,
      unite: produit.unite || "unité",
      est_actif: produit.est_actif,
    });
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingProduit(null);
    form.reset({
      code: "",
      nom: "",
      description: "",
      type: "service",
      prix_unitaire_ht: 0,
      taux_tva: 20,
      unite: "unité",
      est_actif: true,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: ProduitFormData) => {
    try {
      const produitData = {
        ...data,
        description: data.description || null,
      };
      if (editingProduit) {
        await updateProduit({ id: editingProduit.id, ...produitData });
      } else {
        await createProduit(produitData);
      }
      setShowForm(false);
      setEditingProduit(null);
      form.reset();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!deletingProduitId) return;
    try {
      await deleteProduit(deletingProduitId);
      setDeletingProduitId(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Catalogue de produits & services
            </CardTitle>
            <Button size="sm" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-1" />
              Nouveau produit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Recherche */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code, nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead>Prix HT</TableHead>
                  <TableHead className="hidden sm:table-cell">TVA</TableHead>
                  <TableHead className="hidden lg:table-cell">Unité</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProduits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProduits.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.nom}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{PRODUIT_TYPE_LABELS[p.type]}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(p.prix_unitaire_ht)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.taux_tva}%</TableCell>
                      <TableCell className="hidden lg:table-cell">{p.unite}</TableCell>
                      <TableCell>
                        {p.est_actif ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditForm(p)} aria-label="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingProduitId(p.id)} aria-label="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduit ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="PROD-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PRODUIT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du produit ou service" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Description détaillée..." 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="prix_unitaire_ht"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix HT *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taux_tva"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TVA (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unité</FormLabel>
                      <FormControl>
                        <Input placeholder="unité, heure, mois..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="est_actif"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Produit actif</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Les produits inactifs n'apparaissent pas dans les sélections
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {editingProduit ? "Mettre à jour" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingProduitId}
        onOpenChange={(open) => !open && setDeletingProduitId(null)}
        title="Supprimer le produit"
        description="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  );
}
