/**
 * Secteur d'activité : référentiels et vocabulaire métier.
 *
 * POURQUOI CE FICHIER EXISTE
 * La distribution portait, en dur, les référentiels d'un seul métier : la
 * typologie hospitalière française (`CH`, `CHU`, `GHT`, `ESPIC`, `HIA`), les
 * dix-neuf éditeurs de dossier patient informatisé, les treize régions de
 * France métropolitaine, et le vocabulaire commercial propre à son premier
 * exploitant (« Étude émise », « Dans les RDV post EME », « Autre compte /
 * GHT »). Ces listes ne sont pas des données : ce sont les valeurs proposées
 * par les filtres, l'import et les tableaux tant que la table `reference_data`
 * est vide — donc exactement ce que voit quelqu'un qui vient d'installer.
 *
 * Un cabinet d'architectes, une agence, un éditeur de logiciel n'ont rien à
 * faire d'un menu déroulant qui leur propose « CHU » et « ResUrgences ». Le
 * produit se présentait comme l'outil interne d'un autre.
 *
 * CE QUE FAIT CE FICHIER
 * Il sépare le moteur du métier. Les référentiels deviennent un *préréglage*
 * de secteur, choisi par `VITE_SECTEUR_METIER` :
 *
 *   - `generique` (défaut) : des listes qui conviennent à n'importe quelle
 *     activité de relation client ;
 *   - `sante-fr` : les listes historiques, à l'identique, pour un exploitant
 *     du secteur hospitalier français.
 *
 * Chaque liste reste surchargeable une à une, sans choisir de préréglage, par
 * une variable dédiée (valeurs séparées par des virgules). Un exploitant qui
 * ne se reconnaît dans aucun des deux secteurs n'a donc pas à en attendre un
 * troisième : il écrit ses propres listes.
 *
 * CE QUE CE FICHIER NE FAIT PAS
 * Il ne renomme rien dans le modèle de données. Les colonnes, les tables et
 * les politiques de sécurité continuent de parler d'« établissement » : ce
 * terme apparaît dans plus de cinq mille identifiants et dans les politiques
 * de sécurité au niveau ligne. Le renommer serait un autre chantier, à haut
 * risque et sans bénéfice pour l'utilisateur, qui ne voit que des libellés.
 * Ce sont les libellés qui sont paramétrables ici, via `lexique`.
 *
 * Voir `src/config/branding.ts`, qui applique la même approche à l'identité
 * visuelle et légale, et dont les conventions sont reprises telles quelles.
 */

/* ------------------------------------------------------------------------- *
 * Lecture d'environnement (mêmes conventions que branding.ts)
 * ------------------------------------------------------------------------- */

interface EnvSecteur {
  readonly VITE_SECTEUR_METIER?: string
  readonly VITE_REFERENTIEL_TYPES_ENTITE?: string
  readonly VITE_REFERENTIEL_SYSTEMES_EN_PLACE?: string
  readonly VITE_REFERENTIEL_ZONES?: string
  readonly VITE_REFERENTIEL_PALIERS?: string
  readonly VITE_REFERENTIEL_STATUTS_IMPORT?: string
  readonly VITE_LEXIQUE_ENTITE?: string
  readonly VITE_LEXIQUE_ENTITES?: string
  readonly VITE_LEXIQUE_GROUPE?: string
  readonly VITE_LEXIQUE_GROUPES?: string
  readonly VITE_LEXIQUE_SYSTEME_EN_PLACE?: string
}

function env(): EnvSecteur {
  // `import.meta.env` est absent des contextes de construction et de certains
  // exécuteurs d'épreuves ; l'accès protégé évite d'en faire une dépendance.
  try {
    return (import.meta.env ?? {}) as EnvSecteur
  } catch {
    return {}
  }
}

function texte(valeur: string | undefined, defaut: string): string {
  const nettoye = (valeur ?? '').trim()
  return nettoye.length > 0 ? nettoye : defaut
}

function liste(valeur: string | undefined, defaut: readonly string[]): readonly string[] {
  const entrees: string[] = (valeur ?? '')
    .split(',')
    .map((entree: string): string => entree.trim())
    .filter((entree: string): boolean => entree.length > 0)
  return entrees.length > 0 ? entrees : defaut
}

/* ------------------------------------------------------------------------- *
 * Forme d'un secteur
 * ------------------------------------------------------------------------- */

/** Les mots que l'interface emploie pour désigner les objets du métier. */
export interface Lexique {
  /** L'entité principale suivie, au singulier. Ex. « Organisation ». */
  readonly entite: string
  /** La même, au pluriel. */
  readonly entites: string
  /** Le regroupement d'entités, au singulier. Ex. « Groupe ». */
  readonly groupe: string
  /** Le même, au pluriel. */
  readonly groupes: string
  /** Le système déjà en place chez l'entité, au singulier. */
  readonly systemeEnPlace: string
}

export interface Secteur {
  readonly cle: string
  readonly libelle: string
  readonly lexique: Lexique
  /** Types d'entité proposés (filtres, import, fiches). */
  readonly typesEntite: readonly string[]
  /** Solutions déjà en place chez l'entité (concurrence, existant). */
  readonly systemesEnPlace: readonly string[]
  /** Découpage géographique proposé aux filtres. */
  readonly zones: readonly string[]
  /** Paliers commerciaux. */
  readonly paliers: readonly string[]
  /**
   * Statuts acceptés à l'import. Volontairement plus large que le sélecteur de
   * pipeline : un import vient d'un tableur, dont les valeurs sont plus variées
   * que celles de l'interface.
   */
  readonly statutsImport: readonly string[]
  /**
   * Statuts du pipeline partagé (`PHASE_STATUTS`) que ce secteur n'emploie pas.
   *
   * Le pipeline lui-même n'est pas paramétrable : ses valeurs sont enregistrées
   * en base et indexent les styles d'affichage, donc les renommer renommerait
   * des données. Ce qui est paramétrable, c'est ce qu'on en *propose* : un
   * secteur qui ignore un statut ne le voit pas dans ses sélecteurs, mais une
   * ligne qui le porte déjà reste lisible et correctement colorée.
   */
  readonly statutsPipelineIgnores: readonly string[]
}

/* ------------------------------------------------------------------------- *
 * Préréglage neutre — le défaut
 * ------------------------------------------------------------------------- */

const SECTEUR_GENERIQUE: Secteur = {
  cle: 'generique',
  libelle: 'Générique (toute activité)',
  lexique: {
    entite: 'Organisation',
    entites: 'Organisations',
    groupe: 'Groupe',
    groupes: 'Groupes',
    systemeEnPlace: 'Solution en place',
  },
  typesEntite: [
    'Grand compte',
    'ETI',
    'PME',
    'TPE',
    'Secteur public',
    'Association',
    'Autre',
  ],
  systemesEnPlace: [
    'Aucune',
    'Solution interne',
    'Solution concurrente',
    'Autre',
    'Inconnue',
  ],
  // Un découpage qui vaut sur n'importe quel marché. Un exploitant national
  // remplace la liste par ses propres régions en une variable.
  zones: [
    'Europe',
    'Amérique du Nord',
    'Amérique latine',
    'Afrique',
    'Moyen-Orient',
    'Asie-Pacifique',
  ],
  paliers: ['Palier 1', 'Palier 2', 'Palier 3', 'Palier 4'],
  statutsImport: [
    'Prospect',
    'Contacté',
    'Attente RDV',
    'RDV pris',
    'Dans les RDV',
    'Attente post RDV',
    'Proposition émise',
    'Négociation',
    'Contractualisation',
    'Contractuel',
    'Conformité',
    'Déploiement',
    'Formation',
    'Go-Live',
    'Production',
    'Vendu',
    'Refus',
    'Reporté',
    'Bloqué',
    'Suspendu',
  ],
  // « Étude émise » et « Autre compte / GHT » viennent du métier hospitalier du
  // premier exploitant : une étude médico-économique, et un compte rattaché à
  // un groupement hospitalier de territoire. Sans équivalent ailleurs.
  statutsPipelineIgnores: ['Etude émise', 'Autre compte / GHT'],
}

/* ------------------------------------------------------------------------- *
 * Préréglage santé — les listes historiques, inchangées
 * ------------------------------------------------------------------------- */

const SECTEUR_SANTE_FR: Secteur = {
  cle: 'sante-fr',
  libelle: 'Santé — établissements français',
  lexique: {
    entite: 'Établissement',
    entites: 'Établissements',
    groupe: 'Groupe',
    groupes: 'Groupes',
    systemeEnPlace: 'DPI',
  },
  typesEntite: ['CH', 'CHU', 'GHT', 'ESPIC', 'Privé', 'Clinique', 'HIA'],
  systemesEnPlace: [
    'Hopital Manager', 'ORBIS', 'Care4U', 'Easily', 'Axigate', 'ResUrgences',
    'Terminal Urgences', 'Sillage', 'Cerner', 'UrQual', 'TrakCare', 'DxCare',
    'Xtreme Santé', 'M-Crossway', 'Mediburn', 'Maincare', 'Autre Lourd',
    'Autre Web', 'Inconnu',
  ],
  zones: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne',
    'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France',
    'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie',
    'Pays de la Loire', "Provence-Alpes-Côte d'Azur",
  ],
  // Orthographe historique conservée : ces valeurs sont comparées à des
  // données déjà enregistrées, les corriger renommerait des lignes existantes.
  paliers: ['Pallier 1', 'Pallier 2', 'Pallier 3', 'Pallier 4'],
  statutsImport: [
    'Prospect', 'Refus', 'Reporté', 'Bloqué', 'Autre compte / GHT', 'Contacté',
    'Attente RDV', 'RDV pris', 'Attente post RDV', 'Dans les RDV',
    'Etude émise', 'Dans les RDV post EME', 'Négociation', 'Contractualisation',
    'Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live',
    'Production', 'Suspendu',
  ],
  statutsPipelineIgnores: [],
}

/* ------------------------------------------------------------------------- *
 * Résolution
 * ------------------------------------------------------------------------- */

export const SECTEURS: Readonly<Record<string, Secteur>> = {
  generique: SECTEUR_GENERIQUE,
  'sante-fr': SECTEUR_SANTE_FR,
}

export const SECTEUR_PAR_DEFAUT = 'generique'

/**
 * Le secteur demandé, ou le secteur générique si la clé est inconnue.
 *
 * Une clé inconnue ne fait pas échouer le démarrage : elle retombe sur le
 * neutre. Refuser de démarrer parce qu'une variable d'affichage est mal
 * orthographiée coûterait plus cher que d'afficher des listes génériques.
 */
export function resoudreSecteur(cle: string | undefined): Secteur {
  const demande = texte(cle, SECTEUR_PAR_DEFAUT)
  return SECTEURS[demande] ?? SECTEUR_GENERIQUE
}

const BASE: Secteur = resoudreSecteur(env().VITE_SECTEUR_METIER)

/**
 * Le secteur effectif : le préréglage choisi, puis chaque liste et chaque mot
 * remplacés un à un par leur variable dédiée si elle est renseignée.
 */
export const SECTEUR: Secteur = {
  cle: BASE.cle,
  libelle: BASE.libelle,
  lexique: {
    entite: texte(env().VITE_LEXIQUE_ENTITE, BASE.lexique.entite),
    entites: texte(env().VITE_LEXIQUE_ENTITES, BASE.lexique.entites),
    groupe: texte(env().VITE_LEXIQUE_GROUPE, BASE.lexique.groupe),
    groupes: texte(env().VITE_LEXIQUE_GROUPES, BASE.lexique.groupes),
    systemeEnPlace: texte(
      env().VITE_LEXIQUE_SYSTEME_EN_PLACE,
      BASE.lexique.systemeEnPlace,
    ),
  },
  typesEntite: liste(env().VITE_REFERENTIEL_TYPES_ENTITE, BASE.typesEntite),
  systemesEnPlace: liste(
    env().VITE_REFERENTIEL_SYSTEMES_EN_PLACE,
    BASE.systemesEnPlace,
  ),
  zones: liste(env().VITE_REFERENTIEL_ZONES, BASE.zones),
  paliers: liste(env().VITE_REFERENTIEL_PALIERS, BASE.paliers),
  statutsImport: liste(
    env().VITE_REFERENTIEL_STATUTS_IMPORT,
    BASE.statutsImport,
  ),
  statutsPipelineIgnores: BASE.statutsPipelineIgnores,
}

/** Raccourci de lecture : les mots du métier. */
export const LEXIQUE: Lexique = SECTEUR.lexique
