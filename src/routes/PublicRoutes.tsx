import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import {
  ResetPassword,
  EnqueteSatisfactionSolution,
  EnqueteCES,
  EnqueteSatisfaction,
  EnqueteSuiviCSM,
  ForumPostDetail,
  PublicBooking,
  MobileAppsInstall,
  MobileAppInstallPage,
  FormPublic,
  DpoExemple,
  PublicLinkPlaceholder,
  MentionsLegales,
  PolitiqueConfidentialite,
  PublicTransfer,
} from './lazyPages'

export function PublicRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* Pages d'installation PWA (publiques, sans layout) */}
        <Route path="/m/:app/install" element={<MobileAppInstallPage />} />
        <Route path="/m/install" element={<MobileAppsInstall />} />

        {/* Reset password */}
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Autres routes publiques avec layout */}
        <Route
          path="/enquete-satisfaction-solution"
          element={
            <PublicLayout>
              <EnqueteSatisfactionSolution />
            </PublicLayout>
          }
        />
        <Route
          path="/rdv/:slug"
          element={
            <PublicLayout>
              <PublicBooking />
            </PublicLayout>
          }
        />
        <Route
          path="/rdv"
          element={
            <PublicLinkPlaceholder
              title="Prise de rendez-vous"
              description="Le lien de prise de rendez-vous nécessite un identifiant fourni par votre interlocuteur OpenPulse"
            />
          }
        />
        <Route path="/f/:slug" element={<FormPublic />} />
        <Route
          path="/f"
          element={
            <PublicLinkPlaceholder
              title="Formulaire public"
              description="Ce formulaire nécessite un identifiant fourni par votre interlocuteur OpenPulse"
            />
          }
        />
        <Route
          path="/dpo-exemple"
          element={
            <PublicLayout>
              <DpoExemple />
            </PublicLayout>
          }
        />
        <Route
          path="/mentions-legales"
          element={
            <PublicLayout>
              <MentionsLegales />
            </PublicLayout>
          }
        />
        <Route
          path="/politique-confidentialite"
          element={
            <PublicLayout>
              <PolitiqueConfidentialite />
            </PublicLayout>
          }
        />
        <Route
          path="/test"
          element={
            <PublicLinkPlaceholder
              title="Page de test"
              description="Cette URL est réservée aux tests internes OpenPulse"
            />
          }
        />
        <Route path="/transfer/:token" element={<PublicTransfer />} />

        {/* Nouvelles enquêtes publiques tokenisées (refonte) */}
        <Route path="/enquete/ces/:token" element={<EnqueteCES />} />
        <Route path="/enquete/satisfaction/:token" element={<EnqueteSatisfaction />} />
        <Route path="/enquete/suivi-csm/:token" element={<EnqueteSuiviCSM />} />
      </Routes>
    </Suspense>
  )
}
