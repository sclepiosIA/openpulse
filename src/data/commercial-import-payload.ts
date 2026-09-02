/**
 * Jeu de donnees d'import commercial — OpenPulse.
 *
 * Ce fichier est un jeu de DEMONSTRATION entierement fictif. Aucun etablissement,
 * aucune personne et aucun domaine cite ici n'existe : les adresses de messagerie
 * utilisent les domaines reserves (RFC 2606 / RFC 6761) et les numeros de telephone
 * appartiennent aux plages francaises reservees a la fiction.
 *
 * Il alimente l'ecran `src/pages/ImportCommercialData.tsx`. La FORME est contractuelle :
 * memes interfaces exportees, meme fonction `commercialWeekToDate`, meme export
 * `commercialImportPayload`. Le volume est volontairement reduit (12 etablissements,
 * 6 partenaires) tout en couvrant plusieurs regions pour que la repartition affichee
 * par l'ecran reste lisible.
 */

export interface ImportContact {
  prenom: string;
  nom: string;
  email: string;
  fonction: string;
  telephone?: string;
}

export interface ImportEtablissement {
  nom: string;
  region: string;
  prochaine_action: string;
  date_prochaine_action: string;
  contacts: ImportContact[];
  notes?: string;
}

export interface ImportPartenaire {
  nom: string;
  type: string;
  sujet: string;
  prochaine_action: string;
  date_prochaine_action: string;
  contacts: ImportContact[];
}

export interface CommercialImportPayload {
  etablissements: ImportEtablissement[];
  partenaires: ImportPartenaire[];
}

// Convention commerciale historique 2026, distincte d'ISO-8601 :
// « Semaine 1 » commence au premier lundi de l'année (5 janvier), puis avance par pas de 7 jours.
// Le résultat est un date-only `YYYY-MM-DD`, calculé en UTC pour rester invariant selon le fuseau.
export function commercialWeekToDate(weekStr: string): string {
  const match = weekStr.match(/Semaine\s*(\d+)/i);
  if (match) {
    const week = parseInt(match[1], 10);
    const date = new Date(Date.UTC(2026, 0, 5 + (week - 1) * 7));
    return date.toISOString().slice(0, 10);
  }
  if (/sept/i.test(weekStr)) return '2026-09-01';
  if (/avr/i.test(weekStr)) return '2026-04-01';
  if (/mai/i.test(weekStr)) return '2026-05-01';
  if (/mars/i.test(weekStr)) return '2026-03-15';
  if (/juin/i.test(weekStr)) return '2026-06-01';
  // Specific dates
  const dateMatch = weekStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dateMatch) return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  return '2026-04-15'; // default
}

export const commercialImportPayload: CommercialImportPayload = {
  etablissements: [
    // ==================== ILE-DE-FRANCE ====================
    {
      nom: "GHT Val d'Ombreuse",
      region: "Île-de-France",
      prochaine_action: "Action de relance téléphonique vers le secrétariat de la DSI",
      date_prochaine_action: commercialWeekToDate("Semaine 12"),
      contacts: [
        { prenom: "Claire", nom: "Berthier", email: "claire.berthier@ght-ombreuse.example.org", fonction: "DG" },
        { prenom: "Olivier", nom: "Fabre", email: "olivier.fabre@ght-ombreuse.example.org", fonction: "Chef des urgences et du SMUR" },
        { prenom: "Naïma", nom: "Bouchard", email: "naima.bouchard@ght-ombreuse.example.org", fonction: "Cheffe de projet applications médicales" },
        { prenom: "Yann", nom: "Delaunay", email: "yann.delaunay@ght-ombreuse.example.org", fonction: "Direction adjointe recherche", telephone: "06.39.98.70.71" },
      ],
      notes: "Compte pilote de démonstration — données entièrement fictives.",
    },
    {
      nom: "CH Villebrume",
      region: "Île-de-France",
      prochaine_action: "Action de relance mail multi-interlocuteurs",
      date_prochaine_action: commercialWeekToDate("Semaine 13"),
      contacts: [
        { prenom: "Hélène", nom: "Marchand", email: "helene.marchand@ch-villebrume.example.org", fonction: "Directrice des finances" },
        { prenom: "Pierre", nom: "Vasseur", email: "pierre.vasseur@ch-villebrume.example.org", fonction: "DSI" },
        { prenom: "Sonia", nom: "Leroux", email: "sonia.leroux@ch-villebrume.example.org", fonction: "Direction des soins" },
        { prenom: "Marc", nom: "Aubertin", email: "marc.aubertin@ch-villebrume.example.org", fonction: "Médecin DIM responsable de service", telephone: "01.99.00.10.11" },
        { prenom: "Léa", nom: "Perrin", email: "lea.perrin@ch-villebrume.example.org", fonction: "Cheffe de service des urgences" },
      ],
    },
    {
      nom: "CH Aubercourt",
      region: "Île-de-France",
      prochaine_action: "Point comptes en cours de closing/contractualisation",
      date_prochaine_action: "2026-03-16",
      contacts: [
        { prenom: "Julien", nom: "Mercier", email: "julien.mercier@ch-aubercourt.example.org", fonction: "Directeur de l'innovation" },
        { prenom: "Amélie", nom: "Rouault", email: "amelie.rouault@ch-aubercourt.example.org", fonction: "Cheffe du service DIM" },
        { prenom: "Bastien", nom: "Noguès", email: "bastien.nogues@ch-aubercourt.example.org", fonction: "Chef de service SAU", telephone: "01.99.00.10.12" },
      ],
    },
    // ==================== AUVERGNE-RHONE-ALPES ====================
    {
      nom: "CHU Montaubry",
      region: "Auvergne-Rhône-Alpes",
      prochaine_action: "Action de relance prise de nouvelles",
      date_prochaine_action: commercialWeekToDate("Semaine 16"),
      contacts: [
        { prenom: "Sophie", nom: "Grandjean", email: "sophie.grandjean@chu-montaubry.example.org", fonction: "DG" },
        { prenom: "Thibaut", nom: "Lemoine", email: "thibaut.lemoine@chu-montaubry.example.org", fonction: "DGA Animation territoriale" },
        { prenom: "Fanny", nom: "Cordier", email: "fanny.cordier@chu-montaubry.example.org", fonction: "Directrice des finances" },
        { prenom: "Rémi", nom: "Saulnier", email: "remi.saulnier@chu-montaubry.example.org", fonction: "Chef du service DIM" },
        { prenom: "Inès", nom: "Charpentier", email: "ines.charpentier@chu-montaubry.example.org", fonction: "DSI", telephone: "04.65.71.20.21" },
      ],
    },
    {
      nom: "CH Roqueverte",
      region: "Auvergne-Rhône-Alpes",
      prochaine_action: "Action de relance mail multi-interlocuteurs",
      date_prochaine_action: commercialWeekToDate("Semaine 19"),
      contacts: [
        { prenom: "Damien", nom: "Bourgeois", email: "damien.bourgeois@ch-roqueverte.example.org", fonction: "Secrétaire général & directeur référent" },
        { prenom: "Nadia", nom: "Fontaine", email: "nadia.fontaine@ch-roqueverte.example.org", fonction: "DAF" },
        { prenom: "Éric", nom: "Vallet", email: "eric.vallet@ch-roqueverte.example.org", fonction: "Responsable des TIM", telephone: "04.65.71.20.22" },
      ],
    },
    // ==================== HAUTS-DE-FRANCE ====================
    {
      nom: "GHT Rives de Vègre",
      region: "Hauts-de-France",
      prochaine_action: "Action de relance mail multi-interlocuteurs",
      date_prochaine_action: commercialWeekToDate("Semaine 13"),
      contacts: [
        { prenom: "Valérie", nom: "Thibault", email: "valerie.thibault@ght-vegre.example.org", fonction: "DG" },
        { prenom: "Antoine", nom: "Garnier", email: "antoine.garnier@ght-vegre.example.org", fonction: "RSI" },
        { prenom: "Karine", nom: "Delorme", email: "karine.delorme@ght-vegre.example.org", fonction: "DAF", telephone: "03.53.01.30.31" },
        { prenom: "Hugo", nom: "Barbier", email: "hugo.barbier@ght-vegre.example.org", fonction: "Médecin DIM" },
      ],
    },
    {
      nom: "CH Marnecourt",
      region: "Hauts-de-France",
      prochaine_action: "Compte fermé – à reprendre avec évolutions significatives",
      date_prochaine_action: commercialWeekToDate("sept."),
      contacts: [
        { prenom: "Estelle", nom: "Vidal", email: "estelle.vidal@ch-marnecourt.example.org", fonction: "Contact principal", telephone: "06.39.98.70.72" },
        { prenom: "Franck", nom: "Poirier", email: "franck.poirier@ch-marnecourt.example.org", fonction: "Chef de service des urgences" },
        { prenom: "Manon", nom: "Leblond", email: "manon.leblond@ch-marnecourt.example.org", fonction: "Médecin DIM" },
      ],
      notes: "Réouverture conditionnée à un changement de dossier patient.",
    },
    // ==================== NOUVELLE-AQUITAINE ====================
    {
      nom: "CHU Saint-Elme",
      region: "Nouvelle-Aquitaine",
      prochaine_action: "Action de relance mail vers la direction des finances (cc multi-interlocuteurs)",
      date_prochaine_action: commercialWeekToDate("Semaine 14"),
      contacts: [
        { prenom: "Guillaume", nom: "Rivière", email: "guillaume.riviere@chu-saintelme.example.org", fonction: "DSI" },
        { prenom: "Camille", nom: "Dubreuil", email: "camille.dubreuil@chu-saintelme.example.org", fonction: "DAF" },
        { prenom: "Samir", nom: "Benoît", email: "samir.benoit@chu-saintelme.example.org", fonction: "Chef de pôle urgences", telephone: "05.36.49.40.41" },
        { prenom: "Aurore", nom: "Lasserre", email: "aurore.lasserre@chu-saintelme.example.org", fonction: "Cheffe du pôle santé publique" },
      ],
    },
    {
      nom: "Clinique des Glycines",
      region: "Nouvelle-Aquitaine",
      prochaine_action: "Action de relance téléphonique vers la direction générale",
      date_prochaine_action: commercialWeekToDate("inconnu"),
      contacts: [
        { prenom: "Patrick", nom: "Chauvin", email: "patrick.chauvin@clinique-glycines.example.org", fonction: "Directeur général" },
        { prenom: "Élodie", nom: "Marty", email: "elodie.marty@clinique-glycines.example.org", fonction: "Responsable facturation", telephone: "05.36.49.40.42" },
      ],
    },
    // ==================== GRAND EST ====================
    {
      nom: "CH Lorgeval",
      region: "Grand Est",
      prochaine_action: "Action de relance mail multi-interlocuteurs",
      date_prochaine_action: commercialWeekToDate("Semaine 15"),
      contacts: [
        { prenom: "Nicolas", nom: "Béguin", email: "nicolas.beguin@ch-lorgeval.example.org", fonction: "DG" },
        { prenom: "Sarah", nom: "Lemarchand", email: "sarah.lemarchand@ch-lorgeval.example.org", fonction: "DSIN" },
        { prenom: "Bruno", nom: "Perret", email: "bruno.perret@ch-lorgeval.example.org", fonction: "Médecin responsable du service DIM", telephone: "03.53.01.30.32" },
      ],
    },
    {
      nom: "GHT Chandreux-Vaupré",
      region: "Grand Est",
      prochaine_action: "Atelier de cadrage médico-économique",
      date_prochaine_action: commercialWeekToDate("15.05.2026"),
      contacts: [
        { prenom: "Isabelle", nom: "Renaud", email: "isabelle.renaud@ght-chandreux.example.org", fonction: "DGA" },
        { prenom: "Xavier", nom: "Colin", email: "xavier.colin@ght-chandreux.example.org", fonction: "Chef de service des urgences adultes" },
        { prenom: "Farida", nom: "Amrani", email: "farida.amrani@ght-chandreux.example.org", fonction: "Médecin DIM responsable de service", telephone: "03.53.01.50.51" },
      ],
    },
    // ==================== BRETAGNE ====================
    {
      nom: "CH Pierrefosse",
      region: "Bretagne",
      prochaine_action: "Action de relance mail multi-interlocuteurs",
      date_prochaine_action: commercialWeekToDate("Semaine 18"),
      contacts: [
        { prenom: "Yves", nom: "Guilloux", email: "yves.guilloux@ch-pierrefosse.example.org", fonction: "Directeur délégué" },
        { prenom: "Morgane", nom: "Le Gall", email: "morgane.le-gall@ch-pierrefosse.example.org", fonction: "DSI", telephone: "02.61.91.60.61" },
        { prenom: "Alan", nom: "Corbel", email: "alan.corbel@ch-pierrefosse.example.org", fonction: "Chef de service SAU" },
      ],
    },
  ],
  // ==================== PARTENAIRES STRATÉGIQUES ====================
  partenaires: [
    {
      nom: "Consortium Achats Santé",
      type: "Commercial stratégique",
      sujet: "Centrale d'achat et référencement du secteur privé",
      prochaine_action: "Compte à réactiver à un stade de structuration plus avancé",
      date_prochaine_action: "2026-05-01",
      contacts: [
        { prenom: "Laurent", nom: "Vieira", email: "laurent.vieira@consortium-achats.example.org", fonction: "Directeur des systèmes d'information" },
      ],
    },
    {
      nom: "Hélianthe Conseil",
      type: "Cabinet conseil SI santé",
      sujet: "Levier d'accélération par les cabinets de conseil en SI de santé",
      prochaine_action: "Point d'étape partenarial",
      date_prochaine_action: "2026-04-17",
      contacts: [
        { prenom: "Delphine", nom: "Aubert", email: "delphine.aubert@helianthe-conseil.example.org", fonction: "Fondatrice", telephone: "06.39.98.70.73" },
        { prenom: "Maxence", nom: "Doré", email: "maxence.dore@helianthe-conseil.example.org", fonction: "Ingénieur e-santé" },
      ],
    },
    {
      nom: "Orenda Intégration",
      type: "Synergie dossier patient",
      sujet: "Synergie commerciale et intégration chez les établissements clients",
      prochaine_action: "Point comptes en cours de closing/contractualisation",
      date_prochaine_action: "2026-03-16",
      contacts: [
        { prenom: "Cédric", nom: "Maillard", email: "cedric.maillard@orenda-integration.example.com", fonction: "Directeur général" },
        { prenom: "Julie", nom: "Baron", email: "julie.baron@orenda-integration.example.com", fonction: "Directrice produit" },
      ],
    },
    {
      nom: "Fédération des Établissements de Démonstration",
      type: "Fédération hospitalière",
      sujet: "Levier d'accélération de la visibilité par une fédération",
      prochaine_action: "Point téléphonique sur la publication trimestrielle",
      date_prochaine_action: "2026-03-15",
      contacts: [
        { prenom: "Michel", nom: "Tanguy", email: "michel.tanguy@federation-etablissements.example.org", fonction: "Conseiller numérique de fédération" },
      ],
    },
    {
      nom: "Institut Public de la Performance",
      type: "Lobbying institutionnel",
      sujet: "Levier d'accélération de la visibilité par une agence publique",
      prochaine_action: "Point comptes en cours de closing/contractualisation",
      date_prochaine_action: "2026-03-16",
      contacts: [
        { prenom: "Agnès", nom: "Rollin", email: "agnes.rollin@institut-performance.example.org", fonction: "Directrice de l'institut" },
        { prenom: "Paul", nom: "Estève", email: "paul.esteve@institut-performance.example.org", fonction: "Pôle performance économique et IA", telephone: "06.39.98.70.74" },
      ],
    },
    {
      nom: "Réseau Santé Transfrontalier",
      type: "International",
      sujet: "Échanges avec des praticiens hospitaliers pour adapter la solution à un marché voisin",
      prochaine_action: "Point comptes en cours de closing/contractualisation",
      date_prochaine_action: "2026-03-16",
      contacts: [
        { prenom: "Anna", nom: "Verhoeven", email: "anna.verhoeven@reseau-sante.example.net", fonction: "Spécialiste en médecine interne" },
      ],
    },
  ],
};
