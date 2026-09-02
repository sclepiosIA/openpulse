/**
 * Copilot IA — Catalogue d'actions
 * Une seule source de vérité pour le slash menu, la floating bar, la sidebar copilot.
 */
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Wand2,
  Languages,
  Minimize2,
  Maximize2,
  FileText,
  ListTree,
  List,
  Table2,
  Highlighter,
  CheckCheck,
  Baby,
  ArrowRight,
  PenLine,
  Type,
  Feather,
  Scale,
  Megaphone,
  ListChecks,
  Calendar,
  Users,
  Lightbulb,
  BookOpen,
  Sigma,
} from "lucide-react";

export type CopilotSurface = "document" | "presentation" | "spreadsheet";

export interface CopilotAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "rewrite" | "tone" | "translate" | "generate" | "convert" | "extract" | "spreadsheet";
  /** true = agit uniquement sur la sélection ; false = requiert le doc entier */
  needsSelection: boolean;
  /** true = renvoie du JSON structuré (pas de remplacement inline direct) */
  structured?: boolean;
  /** true = insère à la position du curseur (draft/continue) */
  insertAtCursor?: boolean;
  surfaces: CopilotSurface[];
  shortcut?: string;
}

export const COPILOT_ACTIONS: CopilotAction[] = [
  // --- Rewrite ---
  {
    id: "rewrite",
    label: "Réécrire",
    description: "Améliorer la fluidité en conservant le sens",
    icon: Wand2,
    group: "rewrite",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "proofread",
    label: "Corriger",
    description: "Orthographe, grammaire, typographie française",
    icon: CheckCheck,
    group: "rewrite",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "shorten",
    label: "Raccourcir",
    description: "Diviser la longueur par deux environ",
    icon: Minimize2,
    group: "rewrite",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "expand",
    label: "Allonger",
    description: "Développer avec précisions utiles",
    icon: Maximize2,
    group: "rewrite",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "simplify",
    label: "Simplifier",
    description: "Pour un public non-expert",
    icon: Baby,
    group: "rewrite",
    needsSelection: true,
    surfaces: ["document"],
  },
  // --- Tone ---
  {
    id: "tone_formal",
    label: "Ton formel",
    description: "Institutionnel, respectueux",
    icon: Type,
    group: "tone",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "tone_direct",
    label: "Ton direct",
    description: "Concis, sans détours",
    icon: ArrowRight,
    group: "tone",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "tone_empathic",
    label: "Ton empathique",
    description: "Chaleureux, humain",
    icon: Feather,
    group: "tone",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "tone_legal",
    label: "Ton juridique",
    description: "Précis, contractuel",
    icon: Scale,
    group: "tone",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "tone_marketing",
    label: "Ton marketing",
    description: "Attractif mais sobre",
    icon: Megaphone,
    group: "tone",
    needsSelection: true,
    surfaces: ["document"],
  },
  // --- Translate ---
  {
    id: "translate",
    label: "Traduire",
    description: "FR ↔ EN / ES / DE / IT / AR",
    icon: Languages,
    group: "translate",
    needsSelection: true,
    surfaces: ["document"],
  },
  // --- Generate ---
  {
    id: "draft_from_prompt",
    label: "Rédiger depuis une consigne",
    description: "Génère un document complet",
    icon: PenLine,
    group: "generate",
    needsSelection: false,
    insertAtCursor: true,
    surfaces: ["document"],
  },
  {
    id: "continue_writing",
    label: "Continuer la rédaction",
    description: "Poursuit dans le même style",
    icon: Sparkles,
    group: "generate",
    needsSelection: false,
    insertAtCursor: true,
    surfaces: ["document"],
    shortcut: "Tab",
  },
  {
    id: "summarize_exec",
    label: "Résumé exécutif",
    description: "3-5 phrases, orienté décision",
    icon: FileText,
    group: "generate",
    needsSelection: false,
    surfaces: ["document"],
  },
  {
    id: "summarize_bullets",
    label: "Résumé en puces",
    description: "5-8 points clés",
    icon: List,
    group: "generate",
    needsSelection: false,
    surfaces: ["document"],
  },
  {
    id: "summarize_tldr",
    label: "TL;DR",
    description: "Une phrase",
    icon: Highlighter,
    group: "generate",
    needsSelection: false,
    surfaces: ["document"],
  },
  {
    id: "headline_suggest",
    label: "Suggérer 5 titres",
    description: "Choix de titres pour le document",
    icon: Lightbulb,
    group: "generate",
    needsSelection: false,
    structured: true,
    surfaces: ["document"],
  },
  // --- Convert ---
  {
    id: "to_table",
    label: "Convertir en tableau",
    description: "Structure en tableau HTML",
    icon: Table2,
    group: "convert",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "to_bullets",
    label: "Convertir en puces",
    description: "Liste à puces",
    icon: List,
    group: "convert",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "to_outline",
    label: "Convertir en plan",
    description: "Plan hiérarchisé",
    icon: ListTree,
    group: "convert",
    needsSelection: true,
    surfaces: ["document"],
  },
  {
    id: "explain",
    label: "Expliquer",
    description: "Explique le passage",
    icon: BookOpen,
    group: "convert",
    needsSelection: true,
    surfaces: ["document"],
  },
  // --- Extract ---
  {
    id: "extract_actions",
    label: "Extraire des actions",
    description: "Liste des tâches détectées",
    icon: ListChecks,
    group: "extract",
    needsSelection: false,
    structured: true,
    surfaces: ["document"],
  },
  {
    id: "extract_events",
    label: "Extraire des événements",
    description: "Dates et rendez-vous détectés",
    icon: Calendar,
    group: "extract",
    needsSelection: false,
    structured: true,
    surfaces: ["document"],
  },
  {
    id: "extract_contacts",
    label: "Extraire des contacts",
    description: "Personnes et coordonnées",
    icon: Users,
    group: "extract",
    needsSelection: false,
    structured: true,
    surfaces: ["document"],
  },
  // --- Spreadsheet ---
  {
    id: "formula_from_nl",
    label: "Formule depuis une demande",
    description: "Décris ce que tu veux, la formule est générée",
    icon: Sigma,
    group: "spreadsheet",
    needsSelection: false,
    structured: true,
    surfaces: ["spreadsheet"],
  },
  {
    id: "explain_formula",
    label: "Expliquer la formule",
    description: "Détaille une formule",
    icon: BookOpen,
    group: "spreadsheet",
    needsSelection: true,
    structured: true,
    surfaces: ["spreadsheet"],
  },
  {
    id: "fix_formula",
    label: "Réparer la formule",
    description: "Corrige une formule cassée",
    icon: Wand2,
    group: "spreadsheet",
    needsSelection: true,
    structured: true,
    surfaces: ["spreadsheet"],
  },
  {
    id: "insights",
    label: "Insights",
    description: "3-5 constats actionnables",
    icon: Lightbulb,
    group: "spreadsheet",
    needsSelection: false,
    structured: true,
    surfaces: ["spreadsheet"],
  },
];

export const COPILOT_GROUP_LABEL: Record<CopilotAction["group"], string> = {
  rewrite: "Réécrire",
  tone: "Changer le ton",
  translate: "Traduire",
  generate: "Générer",
  convert: "Convertir",
  extract: "Extraire",
  spreadsheet: "Tableur",
};

export const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" },
  { code: "de", label: "Allemand" },
  { code: "it", label: "Italien" },
  { code: "ar", label: "Arabe" },
  { code: "pt", label: "Portugais" },
  { code: "nl", label: "Néerlandais" },
  { code: "fr", label: "Français" },
];

export function getActionsForSurface(surface: CopilotSurface): CopilotAction[] {
  return COPILOT_ACTIONS.filter((a) => a.surfaces.includes(surface));
}

export function getActionById(id: string): CopilotAction | undefined {
  return COPILOT_ACTIONS.find((a) => a.id === id);
}
