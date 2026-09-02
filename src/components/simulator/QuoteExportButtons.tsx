import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { QuoteResults, SimulationParams } from '@/types/simulator';
import { exportDevisPDF, exportDevisExcel } from '@/lib/simulator/exportDevisUtils';
import { toast } from 'sonner';
import { useCompanyInfo } from '@/hooks/shared/useAppConfig';

interface QuoteExportButtonsProps {
  results: QuoteResults;
  params: SimulationParams;
  etablissementNom?: string;
}

export function QuoteExportButtons({ results, params, etablissementNom }: QuoteExportButtonsProps) {
  const isPremierNiveau = results.configuration.valorisationLevel === 'premier';
  const hasReseller = results.configuration.resellerType !== null;
  const { data: companyInfo } = useCompanyInfo();
  const footerConfig = companyInfo ? { company_name: companyInfo.name, email: companyInfo.email } : undefined;

  const handleExportPDF = async (isPartnerExport: boolean) => {
    try {
      await exportDevisPDF({ results, params, etablissementNom, isPremierNiveau, isPartnerExport, footerConfig });
      toast.success(isPartnerExport ? 'PDF partenaire exporté avec succès' : 'PDF exporté avec succès');
    } catch (error) {
      debug.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  const handleExportExcel = (isPartnerExport: boolean) => {
    try {
      exportDevisExcel({ results, params, etablissementNom, isPremierNiveau, isPartnerExport, footerConfig });
      toast.success(isPartnerExport ? 'Excel partenaire exporté avec succès' : 'Excel exporté avec succès');
    } catch (error) {
      debug.error('Erreur export Excel:', error);
      toast.error('Erreur lors de l\'export Excel');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Export Client (sans détail partenaire) */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleExportPDF(false)}
        className="gap-2"
      >
        <FileDown className="h-4 w-4" />
        <span className="hidden sm:inline">Export PDF</span>
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleExportExcel(false)}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">Export Excel</span>
      </Button>
      
      {/* Export Partenaire (avec décomposition) - seulement si revendeur configuré */}
      {hasReseller && (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => handleExportPDF(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">PDF Partenaire</span>
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => handleExportExcel(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Excel Partenaire</span>
          </Button>
        </>
      )}
    </div>
  );
}
