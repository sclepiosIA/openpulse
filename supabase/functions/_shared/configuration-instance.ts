/**
 * Lecture de la configuration d'instance depuis les fonctions de bord.
 *
 * POURQUOI CE FICHIER EXISTE
 * Plusieurs fonctions portaient leur propre bloc `COMPANY_INFO` en dur, avec des
 * valeurs de gabarit : raison sociale d'exemple, SIRET inventé, adresse fictive.
 * Ces valeurs partaient sur les devis et les factures produits par CHAQUE
 * instance installée. Un adoptant émettait donc des documents comptables au nom
 * d'une société qui n'existe pas, avec un identifiant d'entreprise fabriqué —
 * et rien ne le lui disait.
 *
 * L'administrateur renseigne ces valeurs une fois, dans l'assistant de premier
 * lancement, sous la clé `company_info` d'`app_config`. Ce module les relit.
 *
 * COMPORTEMENT EN CAS D'ABSENCE
 * Aucune valeur n'est inventée. Un champ non renseigné rend une chaîne vide, ce
 * qui laisse un trou visible sur le document — un trou se remarque et se
 * corrige, un SIRET plausible mais faux ne se remarque pas.
 */
import { createClient } from '@supabase/supabase-js'

export interface InformationsSociete {
  name: string
  address: string
  city: string
  siret: string
  siren: string
  tvaIntracom: string
  email: string
  phone: string
  website: string
  iban: string
  bic: string
}

const VIDE: InformationsSociete = {
  name: '',
  address: '',
  city: '',
  siret: '',
  siren: '',
  tvaIntracom: '',
  email: '',
  phone: '',
  website: '',
  iban: '',
  bic: '',
}

/**
 * Informations de l'organisation qui exploite cette instance.
 *
 * @param client client Supabase déjà construit, s'il en existe un dans
 *   l'appelant — évite d'en ouvrir un second pour une seule lecture.
 */
export async function lireInformationsSociete(
  client?: ReturnType<typeof createClient>
): Promise<InformationsSociete> {
  const supabase =
    client ??
    createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'company_info')
      .maybeSingle()

    // Une lecture qui échoue ne doit pas empêcher la production du document :
    // mieux vaut un document incomplet, dont le trou se voit, qu'une erreur qui
    // prive l'utilisateur de son devis.
    if (error || !data?.value) return VIDE

    const v = data.value as Record<string, unknown>
    const texte = (cle: string): string => {
      const brut = v[cle]
      return typeof brut === 'string' ? brut.trim() : ''
    }

    return {
      name: texte('name'),
      address: texte('address'),
      city: texte('city'),
      siret: texte('siret'),
      // Le SIREN se déduit du SIRET quand il n'est pas saisi : ce sont ses neuf
      // premiers chiffres, par construction.
      siren: texte('siren') || texte('siret').replace(/\s/g, '').slice(0, 9),
      tvaIntracom: texte('tva_intracom'),
      email: texte('email'),
      phone: texte('phone'),
      website: texte('website'),
      iban: texte('iban'),
      bic: texte('bic'),
    }
  } catch {
    return VIDE
  }
}

/**
 * Rend la valeur, ou une mention explicite si elle manque.
 *
 * Sur un document comptable, une ligne vide passe inaperçue à la relecture
 * alors qu'elle rend la facture non conforme. La mention, elle, se voit.
 */
export function ouAConfigurer(valeur: string, quoi: string): string {
  return valeur || `[à renseigner : ${quoi}]`
}
