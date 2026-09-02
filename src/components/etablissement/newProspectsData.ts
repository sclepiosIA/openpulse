/**
 * Jeu de prospects a importer — OpenPulse.
 *
 * Donnees de DEMONSTRATION entierement fictives : ni les etablissements, ni les villes,
 * ni les adresses ne correspondent a des entites reelles. Aucun nom de produit tiers
 * n est cite : le champ `dpi` n utilise que les libelles generiques que
 * `ImportNewProspects.mapDPI` sait convertir (« Maison », « Autres lourd »,
 * « Autres web », « Inconnu ») ou `null`.
 *
 * La FORME est contractuelle : meme interface `ProspectData`, meme export `newProspects`.
 * Le volume est reduit a 12 entrees — au-dela de 10, l ecran d import affiche encore la
 * ligne « ... et N autres », ce qui garde la vue demontrable.
 *
 * Les libelles de `statut` doivent rester des cles connues de `mapStatut`, sinon
 * l import retombe silencieusement sur le statut « Prospect ».
 */

export interface ProspectData {
  nom: string;
  type: 'CH' | 'GHT' | 'CHU' | 'ESPIC' | 'Privé';
  statut: string;
  dpi: string | null;
  prix_unitaire_annuel: number | null;
  eta_signature: string | null;
  notes: string | null;
  ville: string;
  region: string;
  adresse?: string;
  code_postal?: string;
}

export const newProspects: ProspectData[] = [
  {
    nom: "CH Villebrume",
    type: "CH",
    statut: "I-Etude médico-éco émise",
    dpi: "Maison",
    prix_unitaire_annuel: 37510,
    eta_signature: "2026 T3",
    notes: "Contact entrant via le réseau régional",
    ville: "Villebrume",
    region: "Occitanie",
    adresse: "22 boulevard des Lices",
    code_postal: "81000"
  },
  {
    nom: "Hospices de Montaubry",
    type: "CH",
    statut: "I-Etude médico-éco émise",
    dpi: "Autres lourd",
    prix_unitaire_annuel: 21396,
    eta_signature: "2026 T2",
    notes: "Changement de dossier patient prévu",
    ville: "Montaubry",
    region: "Bourgogne-Franche-Comté",
    adresse: "1 rue de l'Hôpital",
    code_postal: "21200"
  },
  {
    nom: "Hospices Civils de Roqueverte",
    type: "CH",
    statut: "I-Etude médico-éco émise",
    dpi: "Autres web",
    prix_unitaire_annuel: 50266,
    eta_signature: "2026 T4",
    notes: null,
    ville: "Roqueverte",
    region: "Grand Est",
    adresse: "39 avenue de la Liberté",
    code_postal: "68024"
  },
  {
    nom: "CHRU de Saint-Elme",
    type: "CHU",
    statut: "H-Dans les rdvs",
    dpi: "Autres lourd",
    prix_unitaire_annuel: 74864,
    eta_signature: "2026 T3",
    notes: "Appel d'offres en préparation",
    ville: "Saint-Elme",
    region: "Grand Est",
    adresse: "rue du Morvan",
    code_postal: "54511"
  },
  {
    nom: "GHT Rives de Vègre / CH Aubercourt",
    type: "GHT",
    statut: "H-Dans les rdvs",
    dpi: "Autres web",
    prix_unitaire_annuel: 33219,
    eta_signature: null,
    notes: null,
    ville: "Aubercourt",
    region: "Normandie",
    adresse: "25 rue de la Boule",
    code_postal: "61100"
  },
  {
    nom: "CH Métropole Vaupré",
    type: "CH",
    statut: "G-Attente post rdv",
    dpi: "Inconnu",
    prix_unitaire_annuel: 90000,
    eta_signature: "2026 T3",
    notes: "Change de dossier patient 2026-2027",
    ville: "Vaupré",
    region: "Auvergne-Rhône-Alpes",
    adresse: "232 avenue de la Boisse",
    code_postal: "73026"
  },
  {
    nom: "CHI Lorgeval-Marnecourt",
    type: "CH",
    statut: "G-Attente post rdv",
    dpi: "Autres web",
    prix_unitaire_annuel: 70000,
    eta_signature: null,
    notes: null,
    ville: "Marnecourt",
    region: "Normandie",
    adresse: "1 rue de la Défense Passive",
    code_postal: "27400"
  },
  {
    nom: "CHU Pierrefosse",
    type: "CHU",
    statut: "F-RDV pris",
    dpi: null,
    prix_unitaire_annuel: null,
    eta_signature: "soon",
    notes: "Prise de contact par le groupement d'achat",
    ville: "Pierrefosse",
    region: "Bretagne",
    adresse: "2 rue Kléber",
    code_postal: "35033"
  },
  {
    nom: "Clinique des Glycines",
    type: "Privé",
    statut: "E-Attente rdv",
    dpi: "Inconnu",
    prix_unitaire_annuel: 42000,
    eta_signature: "2026 T4",
    notes: null,
    ville: "Chandreux",
    region: "Provence-Alpes-Côte d'Azur",
    adresse: "6 chemin des Vignes",
    code_postal: "13009"
  },
  {
    nom: "Hôpital Sainte-Aure",
    type: "ESPIC",
    statut: "F-RDV pris",
    dpi: "Autres lourd",
    prix_unitaire_annuel: 58500,
    eta_signature: "2026 T2",
    notes: "Dossier partagé avec le GHT voisin",
    ville: "Sainte-Aure",
    region: "Île-de-France",
    adresse: "10 rue de la Convention",
    code_postal: "75015"
  },
  {
    nom: "Centre de Soins de Fontenoy",
    type: "ESPIC",
    statut: "B-Reporté",
    dpi: "Inconnu",
    prix_unitaire_annuel: 20000,
    eta_signature: null,
    notes: "À reprendre au prochain exercice budgétaire",
    ville: "Fontenoy",
    region: "Centre-Val de Loire",
    adresse: "4 place de la Halle",
    code_postal: "45000"
  },
  {
    nom: "GHT Aure et Ombreuse",
    type: "GHT",
    statut: "C-Bloqué",
    dpi: null,
    prix_unitaire_annuel: 216000,
    eta_signature: null,
    notes: "Projet suspendu par la direction générale",
    ville: "Villebrume",
    region: "Occitanie",
    adresse: "18 avenue du Parc",
    code_postal: "81005"
  }
];
