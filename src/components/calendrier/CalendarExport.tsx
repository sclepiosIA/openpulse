import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileText, Table } from 'lucide-react';
import { exportToICS } from '@/lib/calendarUtils';
import { useToast } from '@/hooks/shared/use-toast';

interface CalendarExportProps {
  tasks: any[];
  title?: string;
}

export function CalendarExport({ tasks, title = 'Calendrier' }: CalendarExportProps) {
  const { toast } = useToast();

  const handleExportICS = () => {
    exportToICS(tasks, title);
    toast({ title: 'Export réussi', description: 'Fichier .ics téléchargé' });
  };

  const handleExportCSV = () => {
    const headers = ['Titre', 'Description', 'Échéance', 'Statut', 'Priorité', 'Catégorie', 'Responsable'];
    const rows = tasks.map(t => [
      t.titre,
      t.description || '',
      t.echeance || '',
      t.statut || '',
      t.priorite || '',
      t.categories_taches?.nom || '',
      t.responsable ? `${t.responsable.prenom} ${t.responsable.nom}` : '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Export réussi', description: 'Fichier CSV téléchargé' });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exporter le calendrier</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <Button onClick={handleExportICS} className="w-full justify-start" variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Exporter en iCal (.ics)
          </Button>
          <Button onClick={handleExportCSV} className="w-full justify-start" variant="outline">
            <Table className="h-4 w-4 mr-2" />
            Exporter en CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}