import { AppInstallPrompt } from "@/components/pwa/AppInstallPrompt";
import Booking from "@/pages/Booking";

export default function MobileBookingApp() {
  return (
    <>
      <AppInstallPrompt 
        appName="OpenPulse RDV" 
        appIcon="/plateforme-edition-uploads/2fbd5ec0-2474-43ef-adff-12f56a0b3572.png"
        themeColor="#0ea5e9"
      />
      <Booking isPWAMode={true} />
    </>
  );
}
