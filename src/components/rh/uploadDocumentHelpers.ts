import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeMonthToDate } from '@/lib/dateUtils';
import { debug } from '@/lib/debug';

export interface ParsedBulletinData {
  mois: string | null;
  salaire_brut: number | null;
  salaire_net: number | null;
  salaire_net_a_payer?: number | null;
  cotisations_salariales: number | null;
  cotisations_patronales: number | null;
  primes?: number | null;
  heures_supplementaires?: number | null;
  confidence: number;
  employe?: {
    nom: string | null;
    prenom: string | null;
    numero_securite_sociale?: string | null;
  };
}

export interface UploadResult {
  file: string;
  success: boolean;
  error?: string;
}

/** Formate un montant en euros, gère les valeurs null */
export function formatMontant(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return 'N/A';
  return `${montant.toFixed(2)} €`;
}

const normalizeString = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Trouve le profile_id correspondant au nom/prénom extrait du bulletin
 * Recherche flexible (insensible à la casse, accents, espaces)
 */
export async function findProfileByName(
  nom: string | null | undefined,
  prenom: string | null | undefined,
): Promise<string | null> {
  if (!nom || !prenom) {
    debug.warn('⚠️ Nom ou prénom manquant dans les données GPT');
    return null;
  }
  const nomNormalized = normalizeString(nom);
  const prenomNormalized = normalizeString(prenom);

  debug.log('🔍 Recherche employé:', { nom, prenom, nomNormalized, prenomNormalized });

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, nom, prenom')
    .eq('actif', true);

  if (error || !profiles || profiles.length === 0) {
    debug.error('❌ Erreur récupération profiles:', error);
    return null;
  }

  const matchingProfile = profiles.find((p) => {
    const pNom = normalizeString(p.nom || '');
    const pPrenom = normalizeString(p.prenom || '');
    return pNom === nomNormalized && pPrenom === prenomNormalized;
  });
  if (matchingProfile) {
    debug.log('✅ Employé trouvé:', matchingProfile);
    return matchingProfile.id;
  }

  const partialMatch = profiles.find((p) => {
    const pNom = normalizeString(p.nom || '');
    const pPrenom = normalizeString(p.prenom || '');
    return pPrenom === prenomNormalized && pNom.startsWith(nomNormalized);
  });
  if (partialMatch) {
    debug.log('⚠️ Correspondance partielle trouvée:', partialMatch);
    return partialMatch.id;
  }

  debug.warn('❌ Aucun employé trouvé pour:', { nom, prenom });
  return null;
}

/** Analyse d'un bulletin uploadé via parse-bulletin-salaire */
export async function analyzeBulletin(
  documentId: string,
  storagePath: string,
  profileId: string,
): Promise<ParsedBulletinData | null> {
  try {
    const { data: parseResult, error: parseError } = await supabase.functions.invoke(
      'parse-bulletin-salaire',
      { body: { document_id: documentId, storage_path: storagePath, profile_id: profileId } },
    );
    if (parseError || !parseResult?.success || !parseResult?.data) {
      throw new Error(parseError?.message || 'Analyse échouée');
    }
    return parseResult.data;
  } catch (error) {
    debug.error('Erreur analyse bulletin:', error);
    throw error;
  }
}

/** Crée automatiquement un salaire à partir des données extraites */
export async function createSalaireFromParsedData(
  parsedData: ParsedBulletinData,
  documentId: string,
  fallbackProfileId: string,
): Promise<void> {
  if (!parsedData.mois || parsedData.salaire_brut === null || parsedData.salaire_net === null) {
    throw new Error('Données manquantes');
  }
  const moisNormalized = normalizeMonthToDate(parsedData.mois);

  let targetProfileId = await findProfileByName(
    parsedData.employe?.nom,
    parsedData.employe?.prenom,
  );
  if (!targetProfileId) {
    debug.warn('⚠️ Employé non trouvé par nom, utilisation du profileId de la fiche');
    targetProfileId = fallbackProfileId;
  } else if (targetProfileId !== fallbackProfileId) {
    toast.warning('⚠️ Employé détecté différent de la fiche', {
      description: `Le bulletin concerne ${parsedData.employe?.prenom} ${parsedData.employe?.nom}`,
    });
  }

  const { data: docExists } = await supabase
    .from('rh_documents_employes')
    .select('id')
    .eq('id', documentId)
    .maybeSingle();
  const validDocumentId = docExists ? documentId : null;

  const { error } = await supabase.from('rh_salaires_mensuels').insert({
    profile_id: targetProfileId,
    mois: moisNormalized,
    salaire_brut: parsedData.salaire_brut,
    salaire_net: parsedData.salaire_net,
    net_paye: parsedData.salaire_net_a_payer,
    cotisations_salariales: parsedData.cotisations_salariales,
    cotisations_patronales: parsedData.cotisations_patronales,
    primes: parsedData.primes,
    heures_supplementaires: parsedData.heures_supplementaires,
    source_type: 'auto_bulletin',
    source_document_id: validDocumentId,
  });
  if (error) throw error;
}

/** Toast récapitulatif des uploads */
export function showUploadSummary(results: UploadResult[]): void {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  if (failCount === 0) {
    toast.success(`✅ ${successCount} bulletin(s) uploadé(s) et analysé(s) avec succès !`, {
      description: 'Les salaires ont été créés automatiquement.',
    });
  } else {
    toast.warning(`⚠️ ${successCount} réussis, ${failCount} échoués`, {
      description: results.filter((r) => !r.success).map((r) => `${r.file}: ${r.error}`).join('\n'),
    });
  }
}
