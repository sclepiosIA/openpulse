import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import marqueLogoIA from '@/assets/marque/logo.png'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { debug } from '@/lib/debug'
import { loadPdfLibs } from '@/lib/export/dynamicPdfImport'
import { PUBLIC_EMARGEMENT_URL } from '@/lib/emargementUrl'

export function StaticQRCode() {
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const formationUrl = PUBLIC_EMARGEMENT_URL

  const generateQRCode = useCallback(async () => {
    try {
      const url = await QRCode.toDataURL(formationUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeUrl(url)
    } catch (error) {
      debug.error('Erreur génération QR Code:', error)
      toast.error('Erreur lors de la génération du QR Code')
    }
  }, [formationUrl])

  useEffect(() => {
    void generateQRCode()
  }, [generateQRCode])

  const handleCopyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(formationUrl)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      debug.error('Erreur copie lien QR Code:', error)
      toast.error('Impossible de copier le lien')
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await loadPdfLibs()
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const primaryBlue = [30, 74, 122]
      const lightBlue = [138, 185, 216]
      const orange = [245, 166, 35]

      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.rect(0, 0, pageWidth, 45, 'F')

      const logoHeight = 12
      // Le rapport etait fixe a 1,5 alors que le lettrage est en 1920x447,
      // soit 4,3 : le logo sortait ecrase sur chaque PDF genere. La hauteur
      // est reduite d'autant pour que le bloc garde son encombrement.
      const logoWidth = logoHeight * (1920 / 447)
      doc.addImage(marqueLogoIA, 'PNG', (pageWidth - logoWidth) / 2, 12, logoWidth, logoHeight)

      doc.setFillColor(orange[0], orange[1], orange[2])
      doc.rect(0, 45, pageWidth, 3, 'F')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text("QR Code d'accès", pageWidth / 2, 70, { align: 'center' })
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text('Scannez ce code pour accéder à votre espace de formation', pageWidth / 2, 80, {
        align: 'center',
      })

      if (qrCodeUrl) {
        doc.setFillColor(200, 200, 200)
        doc.roundedRect(52, 92, 106, 106, 3, 3, 'F')
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(50, 90, 106, 106, 3, 3, 'F')
        doc.addImage(qrCodeUrl, 'PNG', 55, 95, 96, 96)
      }

      doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
      doc.roundedRect(20, 205, pageWidth - 40, 15, 2, 2, 'F')
      doc.setFontSize(9)
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.setFont('helvetica', 'bold')
      doc.text('URL :', pageWidth / 2, 212, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.text(formationUrl, pageWidth / 2, 217, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2])
      doc.text('Comment utiliser ce QR Code ?', 20, 235)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      ;[
        "1. Ouvrez l'appareil photo de votre smartphone",
        '2. Pointez-le vers le QR Code ci-dessus',
        '3. Appuyez sur la notification qui apparaît',
        '4. Vous serez automatiquement redirigé vers votre espace formation',
      ].forEach((instruction, index) => doc.text(instruction, 25, 245 + index * 7))

      doc.setFillColor(orange[0], orange[1], orange[2])
      doc.rect(0, pageHeight - 15, pageWidth, 2, 'F')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.setFont('helvetica', 'italic')
      doc.text(
        "OpenPulse - Une meilleure qualité d'organisation de votre activité",
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      )
      doc.save('marque-qrcode-formation.pdf')
      toast.success('PDF téléchargé avec succès')
    } catch (error) {
      debug.error('Erreur génération PDF QR Code:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-1">QR Code - Accès Formation</h3>
            <p className="text-sm text-muted-foreground">
              Scannez ce code pour accéder à l'espace de formation
            </p>
          </div>

          {qrCodeUrl && (
            <div className="bg-card p-4 rounded-lg shadow-sm">
              <img
                loading="lazy"
                decoding="async"
                src={qrCodeUrl}
                alt="QR Code Formation"
                className="w-64 h-64"
              />
            </div>
          )}

          <div className="w-full max-w-md space-y-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-xs truncate">{formationUrl}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0"
                aria-label="Copier le lien d'accès à la formation"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Télécharger en PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
