import { Mail, RefreshCw, Users, Sparkles, PenLine, Wrench, Send } from "lucide-react";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmailAccountConnection } from "./EmailAccountConnection";
import { EmailSignatureEditor } from "./EmailSignatureEditor";
import { ManualSyncButton } from "./ManualSyncButton";
import { FixThreadDatesButton } from "./FixThreadDatesButton";
import { PendingContactsValidation } from "./PendingContactsValidation";
import { BackfillContactsButton } from "./BackfillContactsButton";
import { CleanupInternalContactsButton } from "./CleanupInternalContactsButton";
import { ManualEmailAnalysisTrigger } from "./ManualEmailAnalysisTrigger";
import { RegenerateDetailedSummariesButton } from "./RegenerateDetailedSummariesButton";
import { MyTransfersSection } from "./MyTransfersSection";
import { usePendingContactsCount } from "@/hooks/crm/usePendingContactsCount";
import { Badge } from "@/components/ui/badge";

interface EmailSettingsSectionsProps {
  profileId?: string;
  initialSignature?: string;
}

export function EmailSettingsSections({ profileId, initialSignature }: EmailSettingsSectionsProps) {
  const { data: pendingCount = 0 } = usePendingContactsCount();

  return (
    <div className="space-y-6">
      {/* Section Comptes Email */}
      <SettingsSection
        title="Comptes Email"
        description="Connectez vos comptes IMAP/SMTP pour synchroniser vos emails"
        icon={<Mail className="h-5 w-5" />}
        badge="recommandé"
      >
        <EmailAccountConnection />
      </SettingsSection>

      {/* Section Signature Email */}
      {profileId && (
        <SettingsSection
          title="Signature Email"
          description="Personnalisez votre signature pour vos messages sortants"
          icon={<PenLine className="h-5 w-5" />}
        >
          <EmailSignatureEditor
            profileId={profileId}
            initialSignature={initialSignature || ""}
          />
        </SettingsSection>
      )}

      {/* Section Mes Transferts */}
      <SettingsSection
        title="Mes transferts"
        description="Gérez vos transferts de fichiers volumineux (jusqu'à 2 Go)"
        icon={<Send className="h-5 w-5" />}
      >
        <MyTransfersSection />
      </SettingsSection>

      {/* Accordion Outils & Maintenance */}
      <Accordion type="single" collapsible className="space-y-2">
        <AccordionItem value="maintenance" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-semibold">Outils & Maintenance</p>
                <p className="text-sm text-muted-foreground">
                  Synchronisation, contacts et analyses IA
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-6">
            {/* Synchronisation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Synchronisation</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <ManualSyncButton />
                <FixThreadDatesButton />
              </div>
            </div>

            {/* Gestion des Contacts */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Gestion des Contacts</span>
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="h-5">
                    {pendingCount}
                  </Badge>
                )}
              </div>
              <PendingContactsValidation />
              <div className="flex flex-wrap gap-2 mt-3">
                <BackfillContactsButton />
                <CleanupInternalContactsButton />
              </div>
            </div>

            {/* Analyses IA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>Analyses IA</span>
                <Badge variant="secondary" className="text-xs">Avancé</Badge>
              </div>
              <ManualEmailAnalysisTrigger />
              <RegenerateDetailedSummariesButton />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
