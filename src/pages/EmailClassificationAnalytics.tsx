import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailClassificationDashboard } from "@/components/email/EmailClassificationDashboard";
import { ExcludedDomainsManager } from "@/components/email/ExcludedDomainsManager";
import { useNavigate } from "react-router-dom";
import { BarChart, Settings, AlertCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Ban } from "lucide-react";

export default function EmailClassificationAnalytics() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-6 space-y-6 animate-fade-in">
      <div className="space-y-6">
        {/* Header simplifié */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <BarChart className="h-6 w-6 text-primary" />
              Analytics de Classification
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Performance de la classification automatique des emails
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/gestion-email-domains')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Gérer les domaines
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/emails')}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Voir les suggestions
            </Button>
          </div>
        </div>

        {/* Dashboard principal (contient déjà les stats et graphiques) */}
        <EmailClassificationDashboard />

        {/* Domaines exclus dans un accordéon */}
        <Accordion type="single" collapsible className="border rounded-lg">
          <AccordionItem value="excluded" className="border-0">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <Ban className="h-5 w-5 text-destructive" />
                <div className="text-left">
                  <p className="font-semibold">Domaines exclus</p>
                  <p className="text-sm text-muted-foreground">Masquer les newsletters et notifications</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <ExcludedDomainsManager />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Info card compacte */}
        <Card className="p-4 bg-muted/30">
          <h3 className="font-medium text-sm mb-2">Comment fonctionne la classification ?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">1. Extraction</span> — Domaines extraits des adresses email
            </div>
            <div>
              <span className="font-medium text-foreground">2. Matching</span> — Comparaison avec les associations configurées
            </div>
            <div>
              <span className="font-medium text-foreground">3. Classification</span> — Liaison automatique ou suggestion IA
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
