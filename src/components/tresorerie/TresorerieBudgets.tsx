import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useTresorerieBudgets, CreateBudgetData } from "@/hooks/tresorerie/useTresorerieBudgets";
import { EditableCell } from "./EditableCell";
import {
  Plus,
  Target,
  AlertTriangle,
  CheckCircle,
  Copy,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { format, subMonths, addMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BUDGET_COLORS = {
  prevu: "hsl(217, 91%, 60%)",
  reel_ok: "hsl(142, 76%, 36%)",
  reel_alerte: "hsl(35, 91%, 50%)",
  reel_depasse: "hsl(0, 84%, 60%)",
};

export function TresorerieBudgets() {
  const [selectedMois, setSelectedMois] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBudget, setNewBudget] = useState<CreateBudgetData>({
    categorie_code: "",
    mois: selectedMois,
    montant_prevu: 0,
    montant_alerte: undefined,
  });

  const { 
    budgets, 
    categories,
    totaux, 
    isLoading, 
    createBudget, 
    updateBudget, 
    deleteBudget,
    duplicateBudgets,
    isCreating,
    isUpdating,
    isDuplicating
  } = useTresorerieBudgets(selectedMois);

  const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const handlePrevMonth = () => {
    const date = parseISO(selectedMois + "-01");
    setSelectedMois(format(subMonths(date, 1), "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const date = parseISO(selectedMois + "-01");
    setSelectedMois(format(addMonths(date, 1), "yyyy-MM"));
  };

  const handleCreate = () => {
    if (!newBudget.categorie_code || newBudget.montant_prevu <= 0) return;
    createBudget({ ...newBudget, mois: selectedMois });
    setDialogOpen(false);
    setNewBudget({ categorie_code: "", mois: selectedMois, montant_prevu: 0 });
  };

  const handleDuplicate = () => {
    const moisPrecedent = format(subMonths(parseISO(selectedMois + "-01"), 1), "yyyy-MM");
    duplicateBudgets(moisPrecedent);
  };

  // Catégories sans budget
  const categoriesSansBudget = useMemo(() => {
    const existingCodes = new Set(budgets.map(b => b.categorie_code));
    return categories.filter(c => !existingCodes.has(c.code));
  }, [budgets, categories]);

  // Données pour le graphique
  const chartData = useMemo(() => {
    return budgets.map(b => ({
      name: b.categorie?.nom || b.categorie_code.replace("DEP_", ""),
      prevu: b.montant_prevu,
      reel: b.montant_reel,
      pourcentage: b.pourcentage_utilise,
      est_depasse: b.est_depasse,
      est_alerte: b.est_alerte,
    }));
  }, [budgets]);

  const getProgressColor = (pourcentage: number, estDepasse: boolean, estAlerte: boolean) => {
    if (estDepasse) return "bg-red-500";
    if (estAlerte) return "bg-orange-500";
    return "bg-green-500";
  };

  const pourcentageGlobal = totaux.prevu > 0 ? (totaux.reel / totaux.prevu) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec sélection du mois */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 py-2 bg-muted rounded-lg min-w-[160px] text-center">
            <span className="font-semibold">
              {format(parseISO(selectedMois + "-01"), "MMMM yyyy", { locale: fr })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleDuplicate}
            disabled={isDuplicating}
          >
            <Copy className="h-4 w-4 mr-2" />
            Dupliquer mois précédent
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau budget mensuel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={newBudget.categorie_code}
                    onValueChange={(v) => setNewBudget({ ...newBudget, categorie_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesSansBudget.map(cat => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Budget prévu (€)</Label>
                    <Input
                      type="number"
                      step="100"
                      value={newBudget.montant_prevu || ""}
                      onChange={(e) => setNewBudget({ ...newBudget, montant_prevu: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seuil d'alerte (€)</Label>
                    <Input
                      type="number"
                      step="100"
                      value={newBudget.montant_alerte || ""}
                      onChange={(e) => setNewBudget({ ...newBudget, montant_alerte: parseFloat(e.target.value) || undefined })}
                      placeholder="80% automatique"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  Créer le budget
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Budget total</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.prevu)}</p>
              </div>
              <Target className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-green-500/20",
          pourcentageGlobal > 100 ? "bg-red-500/10" : pourcentageGlobal > 80 ? "bg-orange-500/10" : "bg-green-500/5"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dépensé</p>
                <p className={cn(
                  "text-2xl font-bold",
                  pourcentageGlobal > 100 ? "text-red-600" : pourcentageGlobal > 80 ? "text-orange-600" : "text-green-600"
                )}>
                  {formatMontant(totaux.reel)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <Progress 
              value={Math.min(pourcentageGlobal, 100)} 
              className={cn(
                "mt-2 h-2",
                pourcentageGlobal > 100 ? "[&>div]:bg-red-500" : pourcentageGlobal > 80 ? "[&>div]:bg-orange-500" : ""
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">{pourcentageGlobal.toFixed(0)}% utilisé</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reste</p>
                <p className={cn(
                  "text-2xl font-bold",
                  totaux.prevu - totaux.reel < 0 ? "text-red-600" : "text-green-600"
                )}>
                  {formatMontant(totaux.prevu - totaux.reel)}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-red-500/20",
          totaux.nbDepasse > 0 ? "bg-red-500/10" : "bg-red-500/5"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertes</p>
                <div className="flex items-center gap-2">
                  {totaux.nbDepasse > 0 && (
                    <Badge variant="destructive">{totaux.nbDepasse} dépassé{totaux.nbDepasse > 1 ? 's' : ''}</Badge>
                  )}
                  {totaux.nbAlerte > 0 && (
                    <Badge className="bg-orange-500">{totaux.nbAlerte} alerte{totaux.nbAlerte > 1 ? 's' : ''}</Badge>
                  )}
                  {totaux.nbDepasse === 0 && totaux.nbAlerte === 0 && (
                    <span className="text-sm text-green-600">Tout va bien ✓</span>
                  )}
                </div>
              </div>
              <AlertTriangle className={cn(
                "h-8 w-8",
                totaux.nbDepasse > 0 ? "text-red-500 animate-pulse" : "text-red-500/40"
              )} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique comparatif */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparaison prévu vs réel</CardTitle>
            <CardDescription>Vue graphique par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatMontant(value)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="prevu" name="Budget prévu" fill={BUDGET_COLORS.prevu} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="reel" name="Réel" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.est_depasse 
                            ? BUDGET_COLORS.reel_depasse 
                            : entry.est_alerte 
                              ? BUDGET_COLORS.reel_alerte 
                              : BUDGET_COLORS.reel_ok
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau détaillé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Détail par catégorie ({budgets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Budget prévu</TableHead>
                  <TableHead className="text-right">Réel</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead className="text-right">Seuil alerte</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Target className="h-8 w-8" />
                        <p>Aucun budget défini pour ce mois</p>
                        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Créer un budget
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  budgets.map((budget) => (
                    <TableRow 
                      key={budget.id} 
                      className={cn(
                        "group",
                        budget.est_depasse && "bg-red-50 dark:bg-red-950/20",
                        budget.est_alerte && !budget.est_depasse && "bg-orange-50 dark:bg-orange-950/20"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: budget.categorie?.couleur || '#6366f1' }}
                          />
                          <span className="font-medium">
                            {budget.categorie?.nom || budget.categorie_code.replace("DEP_", "")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <EditableCell
                          value={budget.montant_prevu}
                          onSave={(val) => updateBudget({ id: budget.id, updates: { montant_prevu: Number(val) } })}
                          type="currency"
                          formatDisplay={(v) => formatMontant(Number(v))}
                          disabled={isUpdating}
                          className="justify-end font-medium"
                        />
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        budget.est_depasse ? "text-red-600" : budget.est_alerte ? "text-orange-600" : "text-green-600"
                      )}>
                        {formatMontant(budget.montant_reel)}
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.min(budget.pourcentage_utilise, 100)} 
                              className={cn(
                                "h-2 flex-1",
                                budget.est_depasse ? "[&>div]:bg-red-500" : 
                                budget.est_alerte ? "[&>div]:bg-orange-500" : ""
                              )}
                            />
                            <span className={cn(
                              "text-xs font-medium min-w-[40px] text-right",
                              budget.est_depasse ? "text-red-600" : 
                              budget.est_alerte ? "text-orange-600" : "text-muted-foreground"
                            )}>
                              {budget.pourcentage_utilise.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <EditableCell
                          value={budget.montant_alerte}
                          onSave={(val) => updateBudget({ id: budget.id, updates: { montant_alerte: Number(val) || null } })}
                          type="currency"
                          formatDisplay={(v) => v ? formatMontant(Number(v)) : "80% auto"}
                          placeholder="80% auto"
                          disabled={isUpdating}
                          className="justify-end text-sm text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell>
                        {budget.est_depasse ? (
                          <Badge variant="destructive" className="animate-pulse">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Dépassé
                          </Badge>
                        ) : budget.est_alerte ? (
                          <Badge className="bg-orange-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Alerte
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteBudget(budget.id)} aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
