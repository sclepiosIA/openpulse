import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw, QrCode } from "lucide-react";
import QRCodeLib from "qrcode";
import { loadPdfLibs } from "@/lib/export/dynamicPdfImport";
import { toast } from "sonner";
import { useEtablissementQRCode, useGenerateEtablissementQRToken } from "@/hooks/crm/useEtablissementQRCode";

interface Props {
  etablissementId: string;
  etablissementNom: string;
  slug: string;
}

export function EtablissementQRCodeManager({ etablissementId, etablissementNom, slug }: Props) {
  const { data: qrData, isLoading } = useEtablissementQRCode(etablissementId);
  const generateToken = useGenerateEtablissementQRToken();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const accessUrl = `${window.location.origin}/${slug}/acces-qr?token=${qrData?.qr_access_token || ''}`;

  useEffect(() => {
    if (qrData?.qr_access_token) {
      generateQRCode();
    }
  }, [qrData?.qr_access_token]);

  const generateQRCode = async () => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(accessUrl, {
        width: 300,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      debug.error("Error generating QR code:", error);
    }
  };

  const handleGenerate = () => {
    generateToken.mutate(etablissementId);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(accessUrl);
    toast.success("Lien copié !");
  };

  const handleDownloadPDF = async () => {
    try {
      // Dynamic import for bundle optimization
      const { jsPDF } = await loadPdfLibs();
      const pdf = new jsPDF();
      pdf.setFontSize(20);
      pdf.text("QR Code d'accès Formation", 105, 20, { align: "center" });
      pdf.setFontSize(14);
      pdf.text(etablissementNom, 105, 35, { align: "center" });
      
      const qrImage = await QRCodeLib.toDataURL(accessUrl, { width: 800 });
      pdf.addImage(qrImage, "PNG", 55, 50, 100, 100);
      
      pdf.setFontSize(10);
      pdf.text("Scannez pour accéder à l'espace formation", 105, 160, { align: "center" });
      
      pdf.save(`qr-code-${slug}.pdf`);
      toast.success("PDF téléchargé !");
    } catch (error) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const isExpired = qrData?.qr_access_expires_at 
    ? new Date(qrData.qr_access_expires_at) < new Date()
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code d'accès
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!qrData?.qr_access_token || isExpired ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {isExpired ? "Le QR code a expiré" : "Aucun QR code généré"}
            </p>
            <Button onClick={handleGenerate} disabled={generateToken.isPending}>
              {generateToken.isPending ? "Génération..." : "Générer un QR Code"}
            </Button>
          </div>
        ) : (
          <>
            {qrDataUrl && (
              <div className="flex justify-center">
                <img loading="lazy" decoding="async" src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Régénérer
              </Button>
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Copier le lien
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
