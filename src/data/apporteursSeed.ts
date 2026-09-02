/**
 * Donnees de demarrage de la page « Apporteurs d'affaires » — OpenPulse.
 *
 * Jeu de DEMONSTRATION entierement fictif. Les `partenaireId` correspondent aux
 * partenaires crees par `supabase/seed-demo.sql` : si le seed de demonstration est
 * applique, l ecran est coherent avec la base. Sur une instance sans le seed, les
 * cartes s affichent quand meme (le lien partenaire est alors simplement orphelin).
 *
 * A migrer vers une table Supabase quand la fonctionnalite sera stabilisee.
 */
import type { Apporteur } from '@/components/apporteurs/types'

export const apporteursSeed: Apporteur[] = [
  {
    id: 'boreale-systemes',
    partenaireId: '11111111-1111-4111-8111-111111111111',
    nom: 'Boréale Systèmes',
    typePartenariat: 'Éditeur de dossier patient (partenaire technique)',
    dateDebut: '2026-03-01',
    dateFin: '2029-03-01',
    statut: 'sain',
    metrics: {
      clientsApportes: 4,
      prospectsActifs: 6,
      tauxConversion: 40,
      arrGenere: 185000,
    },
    clients: [
      { nom: 'CH Villebrume', statut: 'signe', ca: 80_000 },
      { nom: 'Clinique du Vallon', statut: 'onboarding', ca: 45_000 },
      { nom: 'CH Roqueverte', statut: 'signe', ca: 65_000 },
      { nom: 'GHT Aure et Ombreuse', statut: 'signe', ca: 50_000 },
    ],
    prospects: [
      { nom: 'CHU Montaubry', stade: 'Négociation', ca: 120_000 },
      { nom: 'CH Pierrefosse', stade: 'RDV pris', ca: 90_000 },
      { nom: 'Clinique des Glycines', stade: 'Etude émise', ca: 70_000 },
    ],
    journal: [
      {
        date: '2026-06-24',
        resume:
          'Comité de pilotage trimestriel — alignement des feuilles de route produit pour le T3.',
      },
      {
        date: '2026-05-12',
        resume: "Introduction du CH Pierrefosse par l'équipe commerciale du partenaire, RDV planifié le 20/05.",
      },
      {
        date: '2026-04-03',
        resume:
          'Signature du CH Roqueverte (site déjà équipé par le partenaire) après 3 mois de négociation.',
      },
    ],
    exchanges: [
      {
        id: 'bs-ex-1',
        date: '2026-07-08',
        canal: 'Visio',
        resume: 'Point hebdomadaire pipeline — revue des 3 dossiers prioritaires',
      },
      {
        id: 'bs-ex-2',
        date: '2026-07-02',
        canal: 'Email',
        resume: 'Envoi de la proposition co-signée pour le CHU Montaubry',
      },
      {
        id: 'bs-ex-3',
        date: '2026-06-24',
        canal: 'RDV',
        resume: 'Comité de pilotage trimestriel — feuille de route T3',
      },
      {
        id: 'bs-ex-4',
        date: '2026-06-12',
        canal: 'Téléphone',
        resume: 'Débrief du RDV CH Pierrefosse, prochaine étape validée',
      },
    ],
    nextSteps: [
      {
        id: 'bs-ns-1',
        action: 'Relancer le CHU Montaubry — proposition finale',
        echeance: '2026-07-15',
        owner: 'Commercial',
      },
      {
        id: 'bs-ns-2',
        action: 'Organiser un atelier de vente conjointe pour le T3',
        echeance: '2026-07-22',
        owner: 'Partenariats',
      },
      {
        id: 'bs-ns-3',
        action: 'Envoyer le support marketing personnalisé',
        echeance: '2026-07-30',
        owner: 'Marketing',
      },
    ],
    nextStep: {
      action: 'Relance du CHU Montaubry — envoi de la proposition finale co-signée',
      echeance: '2026-07-15',
    },
  },
  {
    id: 'altiora-advisors',
    partenaireId: '22222222-2222-4222-8222-222222222222',
    nom: 'Altiora Advisors',
    typePartenariat: 'Intégrateur de dossier patient',
    dateDebut: '2025-02-15',
    statut: 'a_surveiller',
    metrics: {
      clientsApportes: 2,
      prospectsActifs: 3,
      tauxConversion: 25,
      arrGenere: 72000,
    },
    clients: [
      { nom: 'CH Lorgeval', statut: 'signe', ca: 60_000 },
      { nom: 'Polyclinique de Vaupré', statut: 'churne', ca: 0 },
    ],
    prospects: [
      { nom: 'CH Marnecourt', stade: 'Attente post RDV', ca: 50_000 },
      { nom: 'CHU Saint-Elme', stade: 'Prospect', ca: 80_000 },
    ],
    journal: [
      { date: '2026-06-30', resume: "Réunion tendue — baisse d'activité constatée sur le T2." },
      { date: '2026-05-20', resume: 'Perte de la Polyclinique de Vaupré (partie chez un concurrent).' },
    ],
    exchanges: [
      {
        id: 'aa-ex-1',
        date: '2026-07-02',
        canal: 'Visio',
        resume: "Réunion tendue — baisse d'activité constatée sur le T2",
      },
      {
        id: 'aa-ex-2',
        date: '2026-05-20',
        canal: 'Téléphone',
        resume: 'Perte de la Polyclinique de Vaupré (partie chez un concurrent)',
      },
    ],
    nextSteps: [
      {
        id: 'aa-ns-1',
        action: 'Atelier de repositionnement du partenariat',
        echeance: '2026-07-11',
        owner: 'Customer Success',
      },
      {
        id: 'aa-ns-2',
        action: 'Relancer le CH Marnecourt — nouvelle proposition',
        echeance: '2026-07-18',
        owner: 'Commercial',
      },
    ],
    nextStep: {
      action: 'Atelier de repositionnement du partenariat',
      echeance: '2026-07-11',
    },
  },
  {
    id: 'groupement-vesone',
    partenaireId: '33333333-3333-4333-8333-333333333333',
    nom: 'Groupement Vésone',
    typePartenariat: "Groupement d'achat hospitalier",
    dateDebut: '2026-05-10',
    statut: 'en_negociation',
    metrics: {
      clientsApportes: 0,
      prospectsActifs: 5,
      tauxConversion: 0,
      arrGenere: 0,
    },
    clients: [],
    prospects: [
      { nom: 'CH Aubercourt', stade: 'RDV pris', ca: 40_000 },
      { nom: 'CH Fontenoy', stade: 'Attente RDV', ca: 30_000 },
      { nom: 'GHT Rives de Vègre', stade: 'Prospect', ca: 25_000 },
    ],
    journal: [
      { date: '2026-06-18', resume: 'Cadrage commercial — accord de principe sur une commission de 8 %.' },
      { date: '2026-05-10', resume: "Signature du protocole d'accord de partenariat." },
    ],
    exchanges: [
      {
        id: 'gv-ex-1',
        date: '2026-06-18',
        canal: 'RDV',
        resume: 'Cadrage commercial — accord de principe sur une commission de 8 %',
      },
      {
        id: 'gv-ex-2',
        date: '2026-05-10',
        canal: 'Visio',
        resume: "Signature du protocole d'accord de partenariat",
      },
    ],
    nextSteps: [
      {
        id: 'gv-ns-1',
        action: 'Signature du contrat de partenariat définitif',
        echeance: '2026-07-25',
        owner: 'Direction',
      },
      {
        id: 'gv-ns-2',
        action: "Préparer l'atelier CH Aubercourt",
        echeance: '2026-07-28',
        owner: 'Commercial',
      },
    ],
    nextStep: {
      action: 'Signature du contrat de partenariat définitif',
      echeance: '2026-07-25',
    },
  },
]
