import { Button } from "@/components/ui/button";
import { Upload, Plus, FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RHQuickActionsProps {
  onUploadBulletin?: () => void;
  onUploadMultiple?: () => void;
  onAddSalaire?: () => void;
  onViewAll?: () => void;
  onExport?: () => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

export function RHQuickActions({ 
  onUploadBulletin,
  onUploadMultiple,
  onAddSalaire, 
  onViewAll,
  onExport,
  onReanalyze,
  isReanalyzing = false
}: RHQuickActionsProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {onUploadBulletin && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={onUploadBulletin}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Uploader un bulletin</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          )}

          {onUploadMultiple && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={onUploadMultiple}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">📥 Uploader plusieurs bulletins</span>
              <span className="sm:hidden">📥 Multi</span>
            </Button>
          )}
          
          {onAddSalaire && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onAddSalaire}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Saisir manuellement</span>
              <span className="sm:hidden">Manuel</span>
            </Button>
          )}

          {onReanalyze && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onReanalyze}
              disabled={isReanalyzing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isReanalyzing ? 'Réanalyse en cours...' : 'Réanalyser bulletins'}
              </span>
              <span className="sm:hidden">
                {isReanalyzing ? 'En cours...' : 'Réanalyser'}
              </span>
            </Button>
          )}

          {onViewAll && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onViewAll}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Voir tous les salaires</span>
              <span className="sm:hidden">Tout voir</span>
            </Button>
          )}

          {onExport && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onExport}
              className="flex items-center gap-2 ml-auto"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
