import { supabase } from "@/integrations/supabase/client";
 import { useState } from "react";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Textarea } from "@/components/ui/textarea";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { CalendarIcon, Loader2, Plus } from "lucide-react";
 import { format, addMonths, addQuarters, addYears } from "date-fns";
 import { fr } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 import { useTresorerieRevenus } from "@/hooks/tresorerie/useTresorerieRevenus";
 import { useQuery } from "@tanstack/react-query";
 
 interface CreateRecettePrevisionnelleDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const RECURRENCE_OPTIONS = [
   { value: "ponctuelle", label: "Ponctuelle" },
   { value: "mensuelle", label: "Mensuelle (12 mois)" },
   { value: "trimestrielle", label: "Trimestrielle (4 trimestres)" },
   { value: "annuelle", label: "Annuelle" },
 ];
 
 const TYPE_REVENU_OPTIONS = [
   { value: "abonnement", label: "Abonnement" },
   { value: "licence", label: "Licence" },
   { value: "formation", label: "Formation" },
   { value: "consulting", label: "Consulting" },
   { value: "autre", label: "Autre" },
 ];
 
 export function CreateRecettePrevisionnelleDialog({ open, onOpenChange }: CreateRecettePrevisionnelleDialogProps) {
   const { createRevenu, isCreating } = useTresorerieRevenus();
   
   const [libelle, setLibelle] = useState("");
   const [montant, setMontant] = useState("");
   const [date, setDate] = useState<Date | undefined>(undefined);
   const [recurrence, setRecurrence] = useState("ponctuelle");
   const [typeRevenu, setTypeRevenu] = useState("autre");
   const [notes, setNotes] = useState("");
   const [etablissementId, setEtablissementId] = useState("");
 
   const { data: etablissements } = useQuery({
     queryKey: ["etablissements-for-recette"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("etablissements")
         .select("id, nom")
         .in("statut", ["Contractuel", "Production", "Déploiement", "Formation", "Go-Live"])
         .order("nom");
       if (error) throw error;
       return data || [];
     },
   });
 
   const resetForm = () => {
     setLibelle("");
     setMontant("");
     setDate(undefined);
     setRecurrence("ponctuelle");
     setTypeRevenu("autre");
     setNotes("");
     setEtablissementId("");
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!montant || !date) return;
 
     const montantValue = parseFloat(montant);
     
     // Générer les dates selon la récurrence
     const datesToCreate: Date[] = [date];
     
     if (recurrence === "mensuelle") {
       for (let i = 1; i < 12; i++) {
         datesToCreate.push(addMonths(date, i));
       }
     } else if (recurrence === "trimestrielle") {
       for (let i = 1; i < 4; i++) {
         datesToCreate.push(addQuarters(date, i));
       }
     } else if (recurrence === "annuelle") {
       datesToCreate.push(addYears(date, 1));
     }
 
     // Créer les revenus
     for (const d of datesToCreate) {
       await createRevenu({
         etablissement_id: etablissementId || undefined as unknown as string,
         mois: format(d, "yyyy-MM"),
         montant_prevu: montantValue,
         type_revenu: typeRevenu,
         notes: libelle + (datesToCreate.length > 1 ? ` (${format(d, "MMM yy", { locale: fr })})` : "") + (notes ? ` - ${notes}` : ""),
       });
     }
 
     resetForm();
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-[425px]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Plus className="h-5 w-5 text-emerald-600" />
             Nouvelle recette prévisionnelle
           </DialogTitle>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="libelle">Libellé *</Label>
             <Input
               id="libelle"
               value={libelle}
               onChange={(e) => setLibelle(e.target.value)}
               placeholder="Ex: Paiement client X"
               required
             />
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="montant">Montant (€) *</Label>
             <Input
               id="montant"
               type="number"
               step="0.01"
               min="0"
               value={montant}
               onChange={(e) => setMontant(e.target.value)}
               placeholder="0.00"
               required
             />
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="etablissement">Établissement (optionnel)</Label>
             <Select value={etablissementId} onValueChange={setEtablissementId}>
               <SelectTrigger id="etablissement">
                 <SelectValue placeholder="Sélectionner un établissement" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="">Aucun</SelectItem>
                 {etablissements?.map((etab) => (
                   <SelectItem key={etab.id} value={etab.id}>
                     {etab.nom}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="type">Type de revenu</Label>
             <Select value={typeRevenu} onValueChange={setTypeRevenu}>
               <SelectTrigger id="type">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {TYPE_REVENU_OPTIONS.map((opt) => (
                   <SelectItem key={opt.value} value={opt.value}>
                     {opt.label}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label>Date prévue *</Label>
             <Popover>
               <PopoverTrigger asChild>
                 <Button
                   variant="outline"
                   className={cn(
                     "w-full justify-start text-left font-normal",
                     !date && "text-muted-foreground"
                   )}
                 >
                   <CalendarIcon className="mr-2 h-4 w-4" />
                   {date ? format(date, "PPP", { locale: fr }) : "Sélectionner une date"}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                   mode="single"
                   selected={date}
                   onSelect={setDate}
                   locale={fr}
                   initialFocus
                 />
               </PopoverContent>
             </Popover>
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="recurrence">Récurrence</Label>
             <Select value={recurrence} onValueChange={setRecurrence}>
               <SelectTrigger id="recurrence">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {RECURRENCE_OPTIONS.map((opt) => (
                   <SelectItem key={opt.value} value={opt.value}>
                     {opt.label}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="notes">Notes</Label>
             <Textarea
               id="notes"
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Notes optionnelles..."
               rows={2}
             />
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Annuler
             </Button>
             <Button 
               type="submit" 
               disabled={isCreating || !libelle || !montant || !date}
               className="bg-emerald-600 hover:bg-emerald-700 text-white"
             >
               {isCreating ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Création...
                 </>
               ) : (
                 <>
                   <Plus className="h-4 w-4 mr-2" />
                   Créer
                 </>
               )}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }