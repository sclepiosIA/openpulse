
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "./AuthProvider"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Vérifie si un cache de session existe dans sessionStorage (même expiré)
function hasSessionCache(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const cached = sessionStorage.getItem('supabase.auth.session')
    if (cached) {
      const parsed = JSON.parse(cached)
      return !!parsed?.session?.user
    }
  } catch {
    // ignore
  }
  return false
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [graceExpired, setGraceExpired] = useState(false)

  // Délai de grâce : si pas d'user mais cache existe, attendre 2s avant redirect
  useEffect(() => {
    if (!loading && !user && hasSessionCache()) {
      const timer = setTimeout(() => setGraceExpired(true), 2000)
      return () => clearTimeout(timer)
    }
    if (user) {
      setGraceExpired(false)
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Si pas d'user mais cache existe et grâce pas expirée, montrer le loader
  if (!user && hasSessionCache() && !graceExpired) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    const currentPath = location.pathname + location.search
    const authPath = `/auth?returnTo=${encodeURIComponent(currentPath)}`
    return <Navigate to={authPath} replace />
  }

  return <>{children}</>
}
