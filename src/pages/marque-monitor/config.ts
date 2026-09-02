import { Brain, Globe, Mail, MessageSquare, Monitor, Shield } from 'lucide-react'
import type { MonitorSource } from '@/hooks/monitoring/useMonitorLogs'

export const SOURCE_CONFIG: Record<
  MonitorSource,
  { label: string; icon: React.ElementType; color: string }
> = {
  frontend: {
    label: 'Frontend',
    icon: Monitor,
    color: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  ai: { label: 'IA', icon: Brain, color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  email_sync: { label: 'Email', icon: Mail, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  api: { label: 'API', icon: Globe, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  security: {
    label: 'Sécurité',
    icon: Shield,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  feedback: {
    label: 'Feedback',
    icon: MessageSquare,
    color: 'bg-rose-100 text-rose-700 border-rose-200',
  },
}

export const SEVERITY_CONFIG = {
  critical: { label: 'Critique', class: 'bg-red-100 text-red-800 border-red-200' },
  error: { label: 'Erreur', class: 'bg-orange-100 text-orange-800 border-orange-200' },
  warning: { label: 'Avertissement', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  info: { label: 'Info', class: 'bg-blue-100 text-blue-800 border-blue-200' },
} as const
