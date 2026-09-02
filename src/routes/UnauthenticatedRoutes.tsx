import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Auth, HealthCheck, SafeShell } from "./lazyPages";

interface Props {
  authPath: string;
}

export function UnauthenticatedRoutes({ authPath }: Props) {
  return (
    <main>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/__health" element={<HealthCheck />} />
          <Route path="/__safe" element={<SafeShell />} />
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          {/* /auth/reset-password est géré dans PublicRoutes */}
          <Route path="*" element={<Navigate to={authPath} replace />} />
        </Routes>
      </Suspense>
    </main>
  );
}
