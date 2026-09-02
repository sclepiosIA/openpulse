import { Suspense } from "react";
import { AppInstallPrompt } from "@/components/pwa/AppInstallPrompt";
import { Loader2 } from "lucide-react";

import { lazyWithRetry } from "@/lib/lazyWithRetry";
const DocumentsPage = lazyWithRetry(() => import("@/components/documents/DocumentsPage"));

function FullPageLoader() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-page">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function MobileDocumentsApp() {
  return (
    <>
      <AppInstallPrompt 
        appName="OpenPulse Documents" 
        appIcon="/plateforme-edition-uploads/5c3660cd-a401-4996-88ec-b70e11fb5cc4.png"
      />
      <Suspense fallback={<FullPageLoader />}>
        <DocumentsPage isPWAMode />
      </Suspense>
    </>
  );
}
