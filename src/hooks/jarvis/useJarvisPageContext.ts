/**
 * useJarvisPageContext - Détection automatique du contexte de page pour Jarvis 7.0
 * 
 * Ce hook analyse l'URL courante et extrait automatiquement le contexte métier:
 * - Établissement en cours de visualisation
 * - Contact sélectionné
 * - Tâche ouverte
 * - Thread email affiché
 * - Sprint R&D actif
 * - etc.
 * 
 * Jarvis peut ainsi répondre à "Résume cet établissement" sans préciser lequel.
 */

import { useMemo, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types de contexte détectables
export type PageContextType = 
  | 'etablissement'
  | 'contact'
  | 'groupe'
  | 'partenaire'
  | 'tache'
  | 'email_thread'
  | 'facture'
  | 'sprint'
  | 'epic'
  | 'user_story'
  | 'support_ticket'
  | 'formation'
  | 'candidat'
  | 'employe'
  | 'calendar_event'
  | 'booking'
  | 'dashboard'
  | 'unknown';

export interface PageContextEntity {
  type: PageContextType;
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface JarvisPageContext {
  /** Type principal de la page */
  pageType: PageContextType;
  /** Module de l'application (crm, rh, tresorerie, etc.) */
  module: string;
  /** Entité principale détectée */
  primaryEntity: PageContextEntity | null;
  /** Entités secondaires liées */
  secondaryEntities: PageContextEntity[];
  /** URL complète */
  fullPath: string;
  /** Paramètres d'URL */
  params: Record<string, string>;
  /** Query string */
  query: Record<string, string>;
  /** Texte formaté pour injection dans le prompt */
  contextText: string;
  /** Indicateur de chargement */
  isLoading: boolean;
}

// Mapping des routes vers les types de contexte
const ROUTE_PATTERNS: Array<{
  pattern: RegExp;
  type: PageContextType;
  module: string;
  idGroup?: number;
}> = [
  { pattern: /^\/etablissements\/([a-f0-9-]+)/, type: 'etablissement', module: 'crm', idGroup: 1 },
  { pattern: /^\/etablissements$/, type: 'etablissement', module: 'crm' },
  { pattern: /^\/prospects/, type: 'etablissement', module: 'crm' },
  { pattern: /^\/deploiement/, type: 'etablissement', module: 'crm' },
  { pattern: /^\/production/, type: 'etablissement', module: 'crm' },
  { pattern: /^\/contacts\/([a-f0-9-]+)/, type: 'contact', module: 'crm', idGroup: 1 },
  { pattern: /^\/groupes\/([a-f0-9-]+)/, type: 'groupe', module: 'crm', idGroup: 1 },
  { pattern: /^\/partenaires\/([a-f0-9-]+)/, type: 'partenaire', module: 'crm', idGroup: 1 },
  { pattern: /^\/people/, type: 'employe', module: 'rh' },
  { pattern: /^\/tresorerie/, type: 'facture', module: 'tresorerie' },
  { pattern: /^\/emails/, type: 'email_thread', module: 'emails' },
  { pattern: /^\/rd/, type: 'sprint', module: 'rd' },
  { pattern: /^\/support/, type: 'support_ticket', module: 'support' },
  { pattern: /^\/formations/, type: 'formation', module: 'formations' },
  { pattern: /^\/calendrier/, type: 'calendar_event', module: 'calendrier' },
  { pattern: /^\/booking/, type: 'booking', module: 'booking' },
  { pattern: /^\/recrutement\/candidats\/([a-f0-9-]+)/, type: 'candidat', module: 'recrutement', idGroup: 1 },
  { pattern: /^\/recrutement/, type: 'candidat', module: 'recrutement' },
  { pattern: /^\/$/, type: 'dashboard', module: 'dashboard' },
];

export function useJarvisPageContext(): JarvisPageContext {
  const location = useLocation();
  const params = useParams();
  const [detectedId, setDetectedId] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<PageContextType>('unknown');
  const [detectedModule, setDetectedModule] = useState<string>('unknown');

  // Détecter le type de page et extraire l'ID
  useEffect(() => {
    const path = location.pathname;
    
    for (const route of ROUTE_PATTERNS) {
      const match = path.match(route.pattern);
      if (match) {
        setDetectedType(route.type);
        setDetectedModule(route.module);
        setDetectedId(route.idGroup ? match[route.idGroup] : null);
        return;
      }
    }
    
    setDetectedType('unknown');
    setDetectedModule('unknown');
    setDetectedId(null);
  }, [location.pathname]);

  // Parse query string
  const queryParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const result: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }, [location.search]);

  // Fetch entity details based on detected type and ID
  const { data: entityData, isLoading } = useQuery({
    queryKey: ['jarvis-page-context', detectedType, detectedId],
    queryFn: async (): Promise<PageContextEntity | null> => {
      if (!detectedId) return null;

      switch (detectedType) {
        case 'etablissement': {
          // Requête pour établissement
          const { data } = await supabase
            .from('etablissements')
            .select('id, nom, ville, statut, commercial_id, chef_projet_id, csm_id')
            .eq('id', detectedId)
            .maybeSingle();

          if (!data) return null;

          const metadata: Record<string, unknown> = {
            ville: data.ville,
            statut: data.statut,
          };

          // Fetch commercial si présent
          if (data.commercial_id) {
            const { data: commercial } = await supabase
              .from('profiles')
              .select('id, prenom, nom')
              .eq('id', data.commercial_id)
              .maybeSingle();
            if (commercial) metadata.commercial = commercial;
          }

          // Fetch chef_projet si présent
          if (data.chef_projet_id) {
            const { data: chefProjet } = await supabase
              .from('profiles')
              .select('id, prenom, nom')
              .eq('id', data.chef_projet_id)
              .maybeSingle();
            if (chefProjet) metadata.chef_projet = chefProjet;
          }

          // Fetch CSM si présent
          if (data.csm_id) {
            const { data: csm } = await supabase
              .from('profiles')
              .select('id, prenom, nom')
              .eq('id', data.csm_id)
              .maybeSingle();
            if (csm) metadata.csm = csm;
          }

          return {
            type: 'etablissement',
            id: data.id,
            name: data.nom || 'Sans nom',
            metadata,
          };
        }
        
        case 'contact': {
          const { data } = await supabase
            .from('contacts')
            .select('id, prenom, nom, email, fonction, etablissement_id')
            .eq('id', detectedId)
            .maybeSingle();

          if (!data) return null;

          const metadata: Record<string, unknown> = {
            email: data.email,
            fonction: data.fonction,
          };

          // Fetch établissement si présent
          if (data.etablissement_id) {
            const { data: etabl } = await supabase
              .from('etablissements')
              .select('id, nom')
              .eq('id', data.etablissement_id)
              .maybeSingle();
            if (etabl) metadata.etablissement = etabl;
          }

          return {
            type: 'contact',
            id: data.id,
            name: `${data.prenom || ''} ${data.nom || ''}`.trim() || 'Contact',
            metadata,
          };
        }
        
        case 'groupe': {
          const { data } = await supabase
            .from('groupes_etablissements')
            .select('id, nom, description')
            .eq('id', detectedId)
            .maybeSingle();
          return data ? {
            type: 'groupe',
            id: data.id,
            name: data.nom,
            metadata: { description: data.description }
          } : null;
        }

        case 'partenaire': {
          const { data } = await supabase
            .from('partenaires')
            .select('id, nom, type_partenaire')
            .eq('id', detectedId)
            .maybeSingle();
          return data ? {
            type: 'partenaire',
            id: data.id,
            name: data.nom,
            metadata: { type_partenaire: data.type_partenaire }
          } : null;
        }

        case 'candidat': {
          const { data } = await supabase
            .from('candidates')
            .select('id, prenom, nom, email, statut')
            .eq('id', detectedId)
            .maybeSingle();
          if (!data) return null;
          return {
            type: 'candidat',
            id: data.id,
            name: `${data.prenom || ''} ${data.nom || ''}`.trim() || 'Candidat',
            metadata: { email: data.email, statut: data.statut }
          };
        }
        
        default:
          return null;
      }
    },
    enabled: !!detectedId && ['etablissement', 'contact', 'groupe', 'partenaire', 'candidat'].includes(detectedType),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build context text for Jarvis prompt injection
  const contextText = useMemo(() => {
    const lines: string[] = [];
    
    lines.push(`PAGE ACTUELLE: ${detectedModule.toUpperCase()}`);
    lines.push(`URL: ${location.pathname}`);
    
    if (entityData) {
      lines.push(`\nENTITÉ EN COURS DE VISUALISATION:`);
      lines.push(`- Type: ${entityData.type}`);
      lines.push(`- Nom: ${entityData.name}`);
      lines.push(`- ID: ${entityData.id}`);
      
      if (entityData.metadata) {
        const meta = entityData.metadata as Record<string, unknown>;
        if (entityData.type === 'etablissement') {
          if (meta.ville) lines.push(`- Ville: ${meta.ville}`);
          if (meta.statut) lines.push(`- Statut: ${meta.statut}`);
          if (meta.groupe && typeof meta.groupe === 'object') {
            const groupe = meta.groupe as Record<string, unknown>;
            if (groupe?.nom) lines.push(`- Groupe: ${groupe.nom}`);
          }
          if (meta.commercial && typeof meta.commercial === 'object') {
            const c = meta.commercial as Record<string, unknown>;
            if (c?.prenom || c?.nom) lines.push(`- Commercial: ${c.prenom || ''} ${c.nom || ''}`);
          }
          if (meta.chef_projet && typeof meta.chef_projet === 'object') {
            const cp = meta.chef_projet as Record<string, unknown>;
            if (cp?.prenom || cp?.nom) lines.push(`- Chef de projet: ${cp.prenom || ''} ${cp.nom || ''}`);
          }
          if (meta.csm && typeof meta.csm === 'object') {
            const csm = meta.csm as Record<string, unknown>;
            if (csm?.prenom || csm?.nom) lines.push(`- CSM: ${csm.prenom || ''} ${csm.nom || ''}`);
          }
        } else if (entityData.type === 'contact') {
          if (meta.email) lines.push(`- Email: ${meta.email}`);
          if (meta.fonction) lines.push(`- Fonction: ${meta.fonction}`);
          if (meta.etablissement && typeof meta.etablissement === 'object') {
            const e = meta.etablissement as Record<string, unknown>;
            if (e?.nom) lines.push(`- Établissement: ${e.nom}`);
          }
        }
      }
    } else if (detectedType !== 'unknown' && detectedType !== 'dashboard') {
      lines.push(`\nModule ${detectedModule}: Aucune entité spécifique sélectionnée (vue liste)`);
    }
    
    // Ajouter les query params pertinents
    const relevantParams = Object.entries(queryParams).filter(([key]) => 
      !['_t', 'timestamp'].includes(key)
    );
    if (relevantParams.length > 0) {
      lines.push(`\nFILTRES/PARAMÈTRES:`);
      relevantParams.forEach(([key, value]) => {
        lines.push(`- ${key}: ${value}`);
      });
    }
    
    return lines.join('\n');
  }, [detectedModule, location.pathname, entityData, detectedType, queryParams]);

  return {
    pageType: detectedType,
    module: detectedModule,
    primaryEntity: entityData || null,
    secondaryEntities: [], // Could be expanded for related entities
    fullPath: location.pathname + location.search,
    params: params as Record<string, string>,
    query: queryParams,
    contextText,
    isLoading,
  };
}

/**
 * Hook simplifié pour obtenir uniquement le texte de contexte
 */
export function useJarvisContextText(): string {
  const { contextText } = useJarvisPageContext();
  return contextText;
}

/**
 * Hook pour vérifier si on est sur une page avec une entité spécifique
 */
export function useJarvisHasEntityContext(): boolean {
  const { primaryEntity } = useJarvisPageContext();
  return primaryEntity !== null;
}
