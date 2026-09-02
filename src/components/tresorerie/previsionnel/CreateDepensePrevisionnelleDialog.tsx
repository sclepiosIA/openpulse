 import { useState } from "react";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Textarea } from "@/components/ui/textarea";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { CalendarIcon, Loader2, Plus } from "lucide-react";
 import { format, addMonths, addQuarters, addYears } from "date-fns";
 import { fr } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 import { useTresorerieDepenses } from "@/hooks/tresorerie/useTresorerieDepenses";
 
 interface CreateDepensePrevisionnelleDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const RECURRENCE_OPTIONS = [
   { value: "ponctuelle", label: "Ponctuelle" },
   { value: "mensuelle", label: "Mensuelle (12 mois)" },
   { value: "trimestrielle", label: "Trimestrielle (4 trimestres)" },
   { value: "annuelle", label: "Annuelle" },
 ];
 
 const CATEGORIE_OPTIONS = [
   { value: "DEP_SALAIRES_NETS", label: "Salaires nets" },
   { value: "DEP_URSSAF", label: "URSSAF" },
   { value: "DEP_TVA", label: "TVA" },
   { value: "DEP_MARKETING", label: "Marketing" },
   { value: "DEP_DEPLACEMENT", label: "Déplacements" },
   { value: "DEP_LOGICIELS", label: "Logiciels & SaaS" },
   { value: "DEP_ASSURANCES", label: "Assurances" },
   { value: "DEP_FOURNITURES", label: "Fournitures" },
   { value: "DEP_AUTRES", label: "Autres" },
 ];
 
 export function CreateDepensePrevisionnelleDialog({ open, onOpenChange }: CreateDepensePrevisionnelleDialogProps) {
   const { createDepense, isCreating } = useTresorerieDepenses();
   
   const [libelle, setLibelle] = useState("");
   const [montant, setMontant] = useState("");
   const [date, setDate] = useState<Date | undefined>(undefined);
   const [recurrence, setRecurrence] = useState("ponctuelle");
   const [categorie, setCategorie] = useState("DEP_AUTRES");
   const [notes, setNotes] = useState("");
   const [aPayerPlusTard, setAPayerPlusTard] = useState(false);
 
   const resetForm = () => {
     setLibelle("");
     setMontant("");
     setDate(undefined);
     setRecurrence("ponctuelle");
     setCategorie("DEP_AUTRES");
     setNotes("");
     setAPayerPlusTard(false);
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!libelle || !montant) return;
     if (!aPayerPlusTard && !date) return;
 
     const montantValue = parseFloat(montant);
     
     // Générer les dates selon la récurrence
     const datesToCreate: Date[] = [];
     
     if (aPayerPlusTard) {
       // Utiliser une date marqueur pour "à payer plus tard"
       datesToCreate.push(new Date("1900-01-01"));
     } else if (date) {
       datesToCreate.push(date);
       
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
     }
 
     // Créer les dépenses
     for (const d of datesToCreate) {
       await createDepense({
        nom: libelle + (datesToCreate.length > 1 && d.getFullYear() !== 1900 ? ` (${format(d, "MMM yy", { locale: fr })})` : ""),
         montant: montantValue,
         date_prevue: format(d, "yyyy-MM-dd"),
         categorie_code: categorie,
         notes: notes || undefined,
        // Le statut "en_attente" sera utilisé par défaut dans le hook
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
             <Plus className="h-5 w-5 text-destructive" />
             Nouvelle dépense prévisionnelle
           </DialogTitle>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="libelle">Libellé *</Label>
             <Input
               id="libelle"
               value={libelle}
               onChange={(e) => setLibelle(e.target.value)}
               placeholder="Ex: Abonnement Cloud"
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
             <Label htmlFor="categorie">Catégorie</Label>
             <Select value={categorie} onValueChange={setCategorie}>
               <SelectTrigger id="categorie">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {CATEGORIE_OPTIONS.map((opt) => (
                   <SelectItem key={opt.value} value={opt.value}>
                     {opt.label}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           <div className="flex items-center space-x-2">
             <Checkbox
               id="a-payer-plus-tard"
               checked={aPayerPlusTard}
               onCheckedChange={(checked) => {
                 setAPayerPlusTard(checked === true);
                 if (checked) {
                   setDate(undefined);
                   setRecurrence("ponctuelle");
                 }
               }}
             />
             <Label htmlFor="a-payer-plus-tard" className="text-sm font-normal cursor-pointer">
               À payer plus tard (sans date)
             </Label>
           </div>
 
           {!aPayerPlusTard && (
             <>
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
             </>
           )}
 
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
               disabled={isCreating || !libelle || !montant || (!aPayerPlusTard && !date)}
               variant="destructive"
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