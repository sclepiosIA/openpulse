import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { invokeEdge } from '@/services/edgeFunctions';
import { toast } from 'sonner';
import type { CustomDashboard, DashboardFilters } from '@/types/report';

interface Props {
  dashboard: CustomDashboard;
  filters: DashboardFilters;
}

export function ExportMenu({ dashboard, filters }: Props) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setBusy(format);
    try {
      const data = await invokeEdge<{ url?: string }>('report-export', {
        dashboard_id: dashboard.id,
        format,
        filters,
      });
      const url = data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.success(`Export ${format.toUpperCase()} prêt`);
      } else {
        toast.error('URL d\'export indisponible');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur d\'export');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-2" />}
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" /> Export PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
