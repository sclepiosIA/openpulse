import React from "react"
import { Shield, Users, Briefcase, Headphones, Target } from "lucide-react"

// Types pour les rôles et équipes
export type AppRole = 'admin' | 'direction' | 'copil' | 'commercial' | 'chef_projet' | 'csm' | 'rh'
export type TeamType = 'direction' | 'technique' | 'csm' | 'commercial'

export interface UserFormData {
  prenom: string
  nom: string
  email: string
  role: AppRole
  password: string
  actif: boolean
}

// Configuration des rôles avec équipes
export const rolesConfig: Record<AppRole, {
  label: string
  team: TeamType
  color: string
  bgColor: string
  icon: React.ElementType
}> = {
  direction: {
    label: "Direction",
    team: 'direction',
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: Shield
  },
  copil: {
    label: "Comité de pilotage",
    team: 'direction',
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: Users
  },
  admin: {
    label: "Administrateur",
    team: 'direction',
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: Shield
  },
  rh: {
    label: "RH",
    team: 'direction',
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: Users
  },
  chef_projet: {
    label: "Chef de projet",
    team: 'technique',
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: Briefcase
  },
  csm: {
    label: "CSM",
    team: 'csm',
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: Headphones
  },
  commercial: {
    label: "Commercial",
    team: 'commercial',
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    icon: Target
  }
}

// Configuration des équipes
export const teamsConfig: Record<TeamType, {
  label: string
  color: string
  bgColor: string
  description: string
}> = {
  direction: {
    label: "Direction",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    description: "Accès complet à tous les modules"
  },
  technique: {
    label: "Technique",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Déploiement, R&D, Support"
  },
  csm: {
    label: "CSM",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    description: "Production, Santé client"
  },
  commercial: {
    label: "Commercial",
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    description: "Prospects, Pipeline commercial"
  }
}
